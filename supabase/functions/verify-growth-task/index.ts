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

const encryptToken = async (token: string) => {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
};

const parseNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const compare = (actual: number, operator: string, target: number) => {
  switch (operator) {
    case ">":
      return actual > target;
    case ">=":
      return actual >= target;
    case "==":
      return actual === target;
    case "<=":
      return actual <= target;
    case "<":
      return actual < target;
    default:
      return actual >= target;
  }
};

const dateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const { taskId, taskType } = await req.json();

    if (!taskId || !taskType) {
      return new Response(JSON.stringify({ error: "Missing taskId or taskType" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: channelData } = await supabase
      .from("youtube_channels")
      .select("channel_id, access_token, refresh_token, token_expires_at, is_primary")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!channelData?.access_token || !channelData.channel_id) {
      return new Response(JSON.stringify({ error: "No YouTube channel connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = await decryptToken(channelData.access_token);
    if (channelData.token_expires_at && new Date(channelData.token_expires_at) < new Date()) {
      if (!channelData.refresh_token) {
        return new Response(JSON.stringify({ error: "YouTube authorization expired. Reconnect your channel." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const refreshToken = await decryptToken(channelData.refresh_token);
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to refresh YouTube token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        .eq("channel_id", channelData.channel_id);
    }

    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelData.channel_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!channelResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch channel stats" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channelJson = await channelResponse.json();
    const channel = channelJson.items?.[0];
    const stats = channel?.statistics ?? {};
    const uploadsPlaylist = channel?.contentDetails?.relatedPlaylists?.uploads;

    const metricValue = async (metric: string, windowDays?: number | null) => {
      if (metric === "subscribers") return parseNumber(stats.subscriberCount) ?? 0;
      if (metric === "videos") return parseNumber(stats.videoCount) ?? 0;
      if (metric === "views_total") return parseNumber(stats.viewCount) ?? 0;

      if (metric === "uploads_30d") {
        if (!uploadsPlaylist) return 0;
        const uploadsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylist}&maxResults=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!uploadsResponse.ok) return 0;
        const uploadsJson = await uploadsResponse.json();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const items = uploadsJson.items || [];
        return items.filter((item: any) => new Date(item.snippet?.publishedAt) >= cutoff).length;
      }

      const days = windowDays ?? (metric === "watch_minutes_365" ? 365 : 28);
      const startDate = dateOffset(days);
      const endDate = new Date().toISOString().split("T")[0];
      const metricsMap: Record<string, string> = {
        views_28d: "views",
        watch_minutes_365: "estimatedMinutesWatched",
        avg_view_duration_28d: "averageViewDuration",
        subscribers_gained_28d: "subscribersGained",
      };
      const metricKey = metricsMap[metric];
      if (!metricKey) return 0;

      const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      url.searchParams.set("ids", `channel==${channelData.channel_id}`);
      url.searchParams.set("startDate", startDate);
      url.searchParams.set("endDate", endDate);
      url.searchParams.set("metrics", metricKey);
      url.searchParams.set("dimensions", "day");
      url.searchParams.set("sort", "day");

      const analyticsResponse = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!analyticsResponse.ok) return 0;
      const analytics = await analyticsResponse.json();
      const rows = analytics.rows || [];

      if (metric === "avg_view_duration_28d") {
        if (rows.length === 0) return 0;
        const sum = rows.reduce((acc: number, row: number[]) => acc + (row?.[1] ?? 0), 0);
        return sum / rows.length;
      }

      return rows.reduce((acc: number, row: number[]) => acc + (row?.[1] ?? 0), 0);
    };

    let metric = "";
    let operator = ">=";
    let target = 0;
    let windowDays: number | null = null;

    if (taskType === "ai") {
      const { data: task } = await supabase
        .from("user_growth_tasks")
        .select("verification_metric, verification_operator, verification_threshold, verification_window_days")
        .eq("id", taskId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!task?.verification_metric || task.verification_threshold == null) {
        return new Response(JSON.stringify({ error: "Task is missing verification criteria" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      metric = task.verification_metric;
      operator = task.verification_operator || ">=";
      target = Number(task.verification_threshold);
      windowDays = task.verification_window_days;
    } else {
      const { data: task } = await supabase
        .from("growth_tasks")
        .select("title")
        .eq("id", taskId)
        .maybeSingle();
      const title = task?.title?.toLowerCase() ?? "";
      if (title.includes("1000 subscribers")) {
        metric = "subscribers";
        target = 1000;
      } else if (title.includes("100 subscribers")) {
        metric = "subscribers";
        target = 100;
      } else if (title.includes("first video")) {
        metric = "videos";
        target = 1;
      } else if (title.includes("publish 10 videos")) {
        metric = "videos";
        target = 10;
      } else if (title.includes("4000 watch hours")) {
        metric = "watch_minutes_365";
        target = 240000;
      } else {
        return new Response(
          JSON.stringify({ error: "This task cannot be verified via YouTube API." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const actual = await metricValue(metric, windowDays);
    const verified = compare(actual, operator, target);
    if (!verified) {
      return new Response(
        JSON.stringify({ verified: false, metric, actual, target, operator }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    if (taskType === "ai") {
      await supabase
        .from("user_growth_tasks")
        .update({ verified_at: now })
        .eq("id", taskId)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("user_task_progress")
        .upsert({
          user_id: userId,
          task_id: taskId,
          verified_at: now,
          last_completed_at: now,
        });
    }

    return new Response(
      JSON.stringify({ verified: true, metric, actual, target, operator }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verify growth task error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
