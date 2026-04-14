import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireMinimumPlan } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ElevenLabsVoice {
  voice_id?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  preview_url?: string | null;
  labels?: Record<string, string | undefined> | null;
  samples?: Array<{
    sample_id?: string;
  }> | null;
  is_owner?: boolean | null;
}

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
        voices: [],
        configured: false,
        warning: "ELEVEN_LABS_API is not configured. Showing preset voices only.",
      }), {
        status: 200,
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
      console.error("list-tts-voices auth error:", userError?.message ?? userError);
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
      message: "Text to speech requires an active Pro or Advanced subscription.",
    });
    if (accessResponse) {
      return accessResponse;
    }

    const url = new URL("https://api.elevenlabs.io/v2/voices");
    url.searchParams.set("page_size", "100");
    url.searchParams.set("include_total_count", "false");

    const elevenLabsResponse = await fetch(url, {
      headers: {
        "xi-api-key": elevenLabsKey,
      },
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      return new Response(JSON.stringify({
        voices: [],
        configured: elevenLabsResponse.status !== 401 && elevenLabsResponse.status !== 403,
        warning:
          elevenLabsResponse.status === 401 || elevenLabsResponse.status === 403
            ? "The ElevenLabs API key is invalid or unavailable. Showing preset voices only."
            : "Unable to sync ElevenLabs voices right now. Showing preset voices only.",
        details: errorText || "Failed to load voices from ElevenLabs",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await elevenLabsResponse.json();
    const voices = Array.isArray(payload?.voices) ? payload.voices as ElevenLabsVoice[] : [];

    const mappedVoices = voices
      .map((voice) => {
        const id = typeof voice.voice_id === "string" ? voice.voice_id.trim() : "";
        const label = typeof voice.name === "string" ? voice.name.trim() : "";
        if (!id || !label) return null;

        const gender = typeof voice.labels?.gender === "string" ? voice.labels.gender : null;
        const accent = typeof voice.labels?.accent === "string" ? voice.labels.accent : null;
        const language = typeof voice.labels?.language === "string" ? voice.labels.language : null;
        const age = typeof voice.labels?.age === "string" ? voice.labels.age : null;
        const category = typeof voice.category === "string" ? voice.category : "premade";
        const description = typeof voice.description === "string" ? voice.description.trim() : "";

        return {
          id,
          label,
          description,
          category,
          previewUrl: typeof voice.preview_url === "string" ? voice.preview_url : null,
          gender,
          accent,
          language,
          age,
          isOwner: Boolean(voice.is_owner),
          sampleCount: Array.isArray(voice.samples) ? voice.samples.length : 0,
        };
      })
      .filter((voice): voice is NonNullable<typeof voice> => voice !== null)
      .sort((left, right) => left.label.localeCompare(right.label));

    return new Response(JSON.stringify({ voices: mappedVoices, configured: true, warning: null }), {
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
