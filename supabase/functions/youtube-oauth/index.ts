import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
        body = await req.json();
      } catch {
        body = null;
      }
    }
    if (!action && body?.action) {
      action = body.action;
    }
    
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(JSON.stringify({ 
        error: "YouTube OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({
        error: "Supabase service role not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      }), {
        status: 500,
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
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
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
      
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: channelData.refresh_token,
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
      
      await supabase
        .from("youtube_channels")
        .update({
          access_token: tokens.access_token,
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
      
      const { data: channelData, error: fetchError } = await supabase
        .from("youtube_channels")
        .select("access_token, refresh_token, token_expires_at")
        .eq("user_id", userId)
        .eq("channel_id", channelId)
        .single();
      
      if (fetchError || !channelData) {
        return new Response(JSON.stringify({ error: "Channel not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      let accessToken = channelData.access_token;
      
      // Check if token needs refresh
      if (channelData.token_expires_at && new Date(channelData.token_expires_at) < new Date()) {
        if (!channelData.refresh_token) {
          return new Response(JSON.stringify({ error: "Refresh token missing" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: channelData.refresh_token,
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
        accessToken = tokens.access_token;

        await supabase
          .from("youtube_channels")
          .update({
            access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq("user_id", userId)
          .eq("channel_id", channelId);
      }
      
      // Fetch analytics from YouTube Analytics API
      const analyticsUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      analyticsUrl.searchParams.set("ids", `channel==${channelId}`);
      analyticsUrl.searchParams.set("startDate", startDate || "2024-01-01");
      analyticsUrl.searchParams.set("endDate", endDate || new Date().toISOString().split("T")[0]);
      analyticsUrl.searchParams.set("metrics", "views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration");
      analyticsUrl.searchParams.set("dimensions", "day");
      analyticsUrl.searchParams.set("sort", "day");
      
      const analyticsResponse = await fetch(analyticsUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (!analyticsResponse.ok) {
        const error = await analyticsResponse.text();
        console.error("Analytics fetch error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch analytics" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const analytics = await analyticsResponse.json();
      
      return new Response(JSON.stringify({ analytics }), {
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
