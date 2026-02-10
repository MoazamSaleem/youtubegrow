import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const toBase64 = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value));

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

const getEncryptionKey = async () => {
  const keyBase64 = Deno.env.get("OAUTH_ENCRYPTION_KEY_BASE64") ?? "";
  if (!keyBase64) {
    throw new Error("OAUTH_ENCRYPTION_KEY_BASE64 is not set");
  }
  const rawKey = fromBase64(keyBase64);
  if (rawKey.length !== 32) {
    throw new Error("OAUTH_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  }
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const encryptToken = async (token: string) => {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
};

const decryptToken = async (encrypted: string) => {
  const [ivBase64, dataBase64] = encrypted.split(":");
  if (!ivBase64 || !dataBase64) {
    throw new Error("Invalid encrypted token format");
  }
  const key = await getEncryptionKey();
  const iv = fromBase64(ivBase64);
  const data = fromBase64(dataBase64);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
};

interface ChannelTokenData {
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

// deno-lint-ignore no-explicit-any
const getChannelAccessToken = async (
  supabase: any,
  userId: string,
  channelId: string,
  clientId: string,
  clientSecret: string
): Promise<string> => {
  const { data: channelData, error: fetchError } = await supabase
    .from("youtube_channels")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("channel_id", channelId)
    .single();

  const typedData = channelData as ChannelTokenData | null;

  if (fetchError || !typedData?.access_token) {
    throw new Error("Channel not found");
  }

  let accessToken = await decryptToken(typedData.access_token);
  if (typedData.token_expires_at && new Date(typedData.token_expires_at) < new Date()) {
    if (!typedData.refresh_token) {
      throw new Error("Refresh token missing");
    }

    const refreshToken = await decryptToken(typedData.refresh_token);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokens = await tokenResponse.json();
    accessToken = tokens.access_token;
    const encryptedAccessToken = await encryptToken(tokens.access_token);

    await supabase
      .from("youtube_channels")
      .update({
        access_token: encryptedAccessToken,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq("user_id", userId)
      .eq("channel_id", channelId);
  }

  return accessToken;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action");
    let body: any = null;
    if (req.method !== "GET") {
      try {
        const raw = await req.text();
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = null;
          }
        }
      } catch {
        body = null;
      }
    }
    if (!action && body?.action) {
      action = body.action;
    }
    if (!action && body && typeof body === "object") {
      if (body.code && body.redirectUri && body.userId) {
        action = "callback";
      } else if (body.redirectUri && body.state) {
        action = "auth-url";
      } else if (body.channelId && body.userId) {
        action = body.startDate || body.endDate ? "analytics" : "channel-context";
      }
    }
    
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(JSON.stringify({ 
        error: "YouTube OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({
        error: "Supabase keys not configured. Please set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "auth-url") {
      // Generate OAuth URL
      const { redirectUri, state } = body ?? {};
      if (!redirectUri || !state) {
        return new Response(JSON.stringify({ error: "Missing redirectUri or state" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const scopes = [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
        "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
      ].join(" ");
      
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("state", state);
      
      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      // Handle OAuth callback
      const { code, redirectUri, userId } = body ?? {};
      if (!userId || authData.user.id !== userId) {
        return new Response(JSON.stringify({ error: "User mismatch" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      
      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Token exchange error:", error);
        return new Response(JSON.stringify({ error: "Failed to exchange authorization code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const tokens = await tokenResponse.json();
      const encryptedAccessToken = await encryptToken(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token
        ? await encryptToken(tokens.refresh_token)
        : null;
      
      // Get channel info
      const channelResponse = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );
      
      if (!channelResponse.ok) {
        const error = await channelResponse.text();
        console.error("Channel fetch error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch channel info" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];
      
      if (!channel) {
        return new Response(JSON.stringify({ error: "No YouTube channel found for this account" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Store channel in database
      const { error: upsertError } = await supabase
        .from("youtube_channels")
        .upsert({
          user_id: userId,
          channel_id: channel.id,
          channel_name: channel.snippet.title,
          thumbnail_url: channel.snippet.thumbnails?.default?.url,
          channel_url: `https://youtube.com/channel/${channel.id}`,
          subscriber_count: parseInt(channel.statistics.subscriberCount) || 0,
          video_count: parseInt(channel.statistics.videoCount) || 0,
          view_count: parseInt(channel.statistics.viewCount) || 0,
          is_primary: true,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        }, {
          onConflict: "user_id,channel_id",
        });
      
      if (upsertError) {
        console.error("Database error:", upsertError);
        return new Response(JSON.stringify({ error: "Failed to save channel" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        channel: {
          id: channel.id,
          name: channel.snippet.title,
          thumbnail: channel.snippet.thumbnails?.default?.url,
          subscribers: channel.statistics.subscriberCount,
          videos: channel.statistics.videoCount,
          views: channel.statistics.viewCount,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh") {
      // Refresh access token
      const { channelId, userId } = body ?? {};
      if (!userId || authData.user.id !== userId) {
        return new Response(JSON.stringify({ error: "User mismatch" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data: channelData, error: fetchError } = await supabase
        .from("youtube_channels")
        .select("refresh_token")
        .eq("user_id", userId)
        .eq("channel_id", channelId)
        .single();
      
      if (fetchError || !channelData?.refresh_token) {
        return new Response(JSON.stringify({ error: "Channel not found or no refresh token" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const refreshToken = await decryptToken(channelData.refresh_token);
      
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      
      if (!tokenResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to refresh token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const tokens = await tokenResponse.json();
      const encryptedAccessToken = await encryptToken(tokens.access_token);
      
      await supabase
        .from("youtube_channels")
        .update({
          access_token: encryptedAccessToken,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq("user_id", userId)
        .eq("channel_id", channelId);
      
      return new Response(JSON.stringify({ success: true, accessToken: tokens.access_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analytics") {
      // Fetch analytics data
      const { channelId, userId, startDate, endDate } = body ?? {};
      if (!channelId) {
        return new Response(JSON.stringify({ error: "Missing channelId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!userId || authData.user.id !== userId) {
        return new Response(JSON.stringify({ error: "User mismatch" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      let accessToken = "";
      try {
        accessToken = await getChannelAccessToken(supabase, userId, channelId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Channel not found";
        const isAuthIssue = [
          "Refresh token missing",
          "Failed to refresh token",
          "Invalid encrypted token format",
          "OAUTH_ENCRYPTION_KEY_BASE64",
        ].some((needle) => message.includes(needle));
        return new Response(
          JSON.stringify({
            error: isAuthIssue
              ? "YouTube authorization expired. Please reconnect your channel."
              : message,
          }),
          {
            status: isAuthIssue ? 401 : 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // Fetch analytics from YouTube Analytics API
      const buildAnalyticsUrl = (metrics: string, ids: string) => {
        const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
        url.searchParams.set("ids", ids);
        url.searchParams.set("startDate", startDate || "2024-01-01");
        url.searchParams.set("endDate", endDate || new Date().toISOString().split("T")[0]);
        url.searchParams.set("metrics", metrics);
        url.searchParams.set("dimensions", "day");
        url.searchParams.set("sort", "day");
        return url;
      };

      const idsForChannel = `channel==${channelId}`;
      const idsForMine = "channel==MINE";

      let analyticsUrl = buildAnalyticsUrl(
        "views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,estimatedRevenue",
        idsForChannel
      );
      
      let analyticsResponse = await fetch(analyticsUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (!analyticsResponse.ok) {
        const errorText = await analyticsResponse.text();
        console.error("Analytics fetch error:", errorText);
        const lowered = errorText.toLowerCase();
        const isUnauthorized = lowered.includes("insufficient") || lowered.includes("unauthorized");
        const isForbidden = lowered.includes("forbidden");
        if (isUnauthorized) {
          analyticsUrl = buildAnalyticsUrl(
            "views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration",
            idsForChannel
          );
          analyticsResponse = await fetch(analyticsUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } else if (isForbidden) {
          analyticsUrl = buildAnalyticsUrl(
            "views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration",
            idsForMine
          );
          analyticsResponse = await fetch(analyticsUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }

        if (!analyticsResponse.ok) {
          const fallbackText = await analyticsResponse.text().catch(() => "");
          const combined = [errorText, fallbackText].filter(Boolean).join(" ");
          const combinedLower = combined.toLowerCase();
          const shouldReconnect =
            combinedLower.includes("invalid credentials") ||
            combinedLower.includes("unauthorized") ||
            combinedLower.includes("insufficient");
          const possibleMismatch = combinedLower.includes("forbidden");
          return new Response(JSON.stringify({
            error: shouldReconnect
              ? "YouTube authorization expired or missing analytics permission. Please reconnect your channel."
              : possibleMismatch
              ? "YouTube Analytics access is forbidden for this channel. Make sure the linked Google account owns the channel."
              : "Failed to fetch analytics",
            details: combined ? combined.slice(0, 500) : undefined,
          }), {
            status: shouldReconnect ? 401 : 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      
      const analytics = await analyticsResponse.json();
      
      return new Response(JSON.stringify({ analytics }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "channel-context") {
      const { channelId, userId } = body ?? {};
      if (!userId || authData.user.id !== userId) {
        return new Response(JSON.stringify({ error: "User mismatch" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let accessToken = "";
      try {
        accessToken = await getChannelAccessToken(supabase, userId, channelId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Channel not found";
        const isAuthIssue = [
          "Refresh token missing",
          "Failed to refresh token",
          "Invalid encrypted token format",
          "OAUTH_ENCRYPTION_KEY_BASE64",
        ].some((needle) => message.includes(needle));
        return new Response(
          JSON.stringify({
            error: isAuthIssue
              ? "YouTube authorization expired. Please reconnect your channel."
              : message,
          }),
          {
            status: isAuthIssue ? 401 : 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const channelResponse = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!channelResponse.ok) {
        const error = await channelResponse.text();
        console.error("Channel context error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch channel context" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];
      const description = channel?.snippet?.description ?? "";
      const title = channel?.snippet?.title ?? "";
      const channelStats = channel?.statistics
        ? {
          subscriberCount: Number(channel.statistics.subscriberCount || 0),
          viewCount: Number(channel.statistics.viewCount || 0),
          videoCount: Number(channel.statistics.videoCount || 0),
        }
        : null;
      const uploadsPlaylist = channel?.contentDetails?.relatedPlaylists?.uploads;
      let recentVideos: Array<{
        id: string;
        title: string;
        description: string;
        tags?: string[];
        publishedAt?: string;
        viewCount?: number;
        likeCount?: number;
        commentCount?: number;
        topicCategories?: string[];
        topicIds?: string[];
      }> = [];

      if (uploadsPlaylist) {
        const uploadsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylist}&maxResults=10`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (uploadsResponse.ok) {
          const uploads = await uploadsResponse.json();
          const items = uploads.items || [];
          const videoIds = items
            .map((item: any) => item?.contentDetails?.videoId)
            .filter((videoId: string) => Boolean(videoId));

          if (videoIds.length > 0) {
            const videosResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,topicDetails&id=${videoIds.join(",")}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (videosResponse.ok) {
              const videosData = await videosResponse.json();
              recentVideos = (videosData.items || []).map((video: any) => ({
                id: video.id,
                title: video?.snippet?.title ?? "",
                description: video?.snippet?.description ?? "",
                tags: video?.snippet?.tags ?? [],
                publishedAt: video?.snippet?.publishedAt ?? undefined,
                viewCount: Number(video?.statistics?.viewCount || 0),
                likeCount: Number(video?.statistics?.likeCount || 0),
                commentCount: Number(video?.statistics?.commentCount || 0),
                topicCategories: video?.topicDetails?.topicCategories ?? [],
                topicIds: video?.topicDetails?.relevantTopicIds ?? [],
              }));
            } else {
              recentVideos = items
                .map((item: any) => ({
                  id: item?.contentDetails?.videoId ?? "",
                  title: item?.snippet?.title ?? "",
                  description: item?.snippet?.description ?? "",
                  publishedAt: item?.snippet?.publishedAt ?? undefined,
                }))
                .filter((video: any) => Boolean(video.title));
            }
          }
        }
      }

      return new Response(JSON.stringify({
        channel: { title, description, stats: channelStats },
        recentVideos,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("YouTube OAuth error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
