import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireMinimumPlan } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const parseLabels = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const normalized = Object.entries(parsed).reduce<Record<string, string>>((result, [key, raw]) => {
      if (typeof raw === "string" && raw.trim()) {
        result[key] = raw.trim();
      }
      return result;
    }, {});

    return Object.keys(normalized).length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

const collectFiles = (formData: FormData) => {
  const entries = [...formData.getAll("files"), ...formData.getAll("files[]")];
  return entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
};

const getElevenLabsErrorMessage = (raw: string, fallback: string) => {
  if (!raw.trim()) return fallback;

  try {
    const parsed = JSON.parse(raw) as {
      detail?: unknown;
      error?: string;
      message?: string;
    };

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }

    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }

    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail.trim();
    }

    if (parsed.detail && typeof parsed.detail === "object") {
      const detail = parsed.detail as {
        message?: string;
        type?: string;
        status?: string;
      };

      if (
        detail.type === "payment_required" ||
        detail.status === "can_not_use_instant_voice_cloning"
      ) {
        return "The configured ElevenLabs API key cannot update instant voice clones on its current plan. Upgrade the ElevenLabs workspace to a paid plan with instant voice cloning, or replace ELEVEN_LABS_API with a key that already has that feature.";
      }

      if (typeof detail.message === "string" && detail.message.trim()) {
        return detail.message.trim();
      }
    }
  } catch {
    // Fall back to the raw upstream text below.
  }

  return raw.trim() || fallback;
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
    const elevenLabsKey =
      Deno.env.get("ELEVEN_LABS_API") ??
      Deno.env.get("ELEVENLABS_API_KEY") ??
      "";

    if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Supabase environment variables are not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!elevenLabsKey) {
      return new Response(JSON.stringify({
        error: "Voice cloning is not configured. Set ELEVEN_LABS_API in Supabase secrets.",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const userClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: userData,
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("update-tts-voice auth error:", userError?.message ?? userError);
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;

    const accessResponse = await requireMinimumPlan({
      supabaseClient: userClient,
      userId: user.id,
      minimumPlan: "pro",
      corsHeaders,
      message: "Voice cloning requires an active Pro or Advanced subscription.",
    });
    if (accessResponse) {
      return accessResponse;
    }

    const formData = await req.formData();
    const voiceId =
      typeof formData.get("voiceId") === "string" ? String(formData.get("voiceId")).trim() : "";
    const name = typeof formData.get("name") === "string" ? String(formData.get("name")).trim() : "";
    const description =
      typeof formData.get("description") === "string" ? String(formData.get("description")).trim() : "";
    const removeBackgroundNoise = String(formData.get("remove_background_noise") ?? "false") === "true";
    const labels = parseLabels(formData.get("labels"));
    const files = collectFiles(formData);

    if (!voiceId) {
      return new Response(JSON.stringify({ error: "Voice selection is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "Voice name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("name", name);
    upstreamForm.append("remove_background_noise", removeBackgroundNoise ? "true" : "false");
    if (description) {
      upstreamForm.append("description", description);
    }
    if (labels) {
      upstreamForm.append("labels", JSON.stringify(labels));
    }
    files.forEach((file) => {
      upstreamForm.append("files", file, file.name);
    });

    const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}/edit`, {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsKey,
      },
      body: upstreamForm,
    });

    const responseText = await elevenLabsResponse.text();
    if (!elevenLabsResponse.ok) {
      return new Response(JSON.stringify({
        error: getElevenLabsErrorMessage(responseText, "Failed to update voice"),
      }), {
        status: elevenLabsResponse.status >= 400 && elevenLabsResponse.status < 500
          ? elevenLabsResponse.status
          : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      status: "ok",
      voiceId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
