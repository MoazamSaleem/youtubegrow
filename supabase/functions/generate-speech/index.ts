import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deductCreditsWithAmount, refundCredits } from "../_shared/credits.ts";
import { requireMinimumPlan } from "../_shared/subscription.ts";
import {
  buildElevenLabsVoiceSettings,
  calculateSpeechCreditCost,
  getOutputFormatConfig,
  getSpeechCreditComplexity,
  getVoiceLabel,
  MAX_TTS_CHARACTERS,
  normalizeMood,
  normalizeOutputFormat,
  normalizeStyle,
  clampSpeechSpeed,
} from "../_shared/text-to-speech.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isMissingTtsRelationError = (error: { code?: string; message?: string; details?: string } | null | undefined) => {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("tts_generations") ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("schema cache")
  );
};

const isMissingTtsBucketError = (message?: string | null) => {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("bucket") && normalized.includes("not found");
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

    if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Supabase environment variables are not configured" }), {
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const {
      data: userData,
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("generate-speech auth error:", userError?.message ?? userError);
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

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId.trim() : "";
    const providedVoiceLabel =
      typeof body?.voiceLabel === "string" ? body.voiceLabel.trim() : "";
    const mood = normalizeMood(body?.mood);
    const style = normalizeStyle(body?.style);
    const speed = clampSpeechSpeed(Number(body?.speed));
    const outputFormat = normalizeOutputFormat(body?.outputFormat);
    const elevenLabsKey =
      Deno.env.get("ELEVEN_LABS_API") ??
      Deno.env.get("ELEVENLABS_API_KEY") ??
      "";

    if (!text) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!voiceId) {
      return new Response(JSON.stringify({ error: "Voice selection is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const charCount = text.length;
    if (charCount > MAX_TTS_CHARACTERS) {
      return new Response(
        JSON.stringify({
          error: `Text to speech supports up to ${MAX_TTS_CHARACTERS} characters per generation.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!elevenLabsKey) {
      return new Response(JSON.stringify({
        error: "Text to speech is not configured. Set ELEVEN_LABS_API in Supabase secrets.",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creditsUsed = calculateSpeechCreditCost(charCount);
    const complexity = getSpeechCreditComplexity(charCount);
    const voiceLabel = getVoiceLabel(voiceId, providedVoiceLabel);

    const creditCheck = await deductCreditsWithAmount(
      user.id,
      creditsUsed,
      "generate-speech",
      `Text to Speech - ${charCount} chars`,
      complexity
    );

    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const { data: insertedGeneration, error: insertError } = await supabaseAdmin
      .from("tts_generations")
      .insert({
        user_id: user.id,
        text_input: text,
        voice_id: voiceId,
        voice_label: voiceLabel,
        mood,
        style,
        speed,
        output_format: outputFormat,
        char_count: charCount,
        credits_used: creditsUsed,
        status: "processing",
        created_at: now,
      })
      .select("*")
      .single();

    if (insertError || !insertedGeneration) {
      await refundCredits(user.id, creditsUsed, "Text to speech save failed - refund");
      return new Response(JSON.stringify({
        error: isMissingTtsRelationError(insertError)
          ? "Text to speech database is not configured. Apply the TTS migration before generating speech."
          : "Failed to create speech job",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generationId = insertedGeneration.id;
    const outputConfig = getOutputFormatConfig(outputFormat);
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputConfig.query}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: buildElevenLabsVoiceSettings({
            mood,
            style,
            speed,
          }),
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      await supabaseAdmin
        .from("tts_generations")
        .update({
          status: "failed",
          error_message: errorText || "Failed to generate speech",
        })
        .eq("id", generationId);
      await refundCredits(user.id, creditsUsed, "Text to speech provider error - refund");
      return new Response(JSON.stringify({ error: "Failed to generate speech" }), {
        status: elevenLabsResponse.status >= 400 && elevenLabsResponse.status < 500
          ? elevenLabsResponse.status
          : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBytes = new Uint8Array(await elevenLabsResponse.arrayBuffer());
    const filePath = `${user.id}/${generationId}.${outputFormat}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("tts-audio")
      .upload(filePath, audioBytes, {
        contentType: outputConfig.contentType,
        upsert: true,
      });

    if (uploadError) {
      await supabaseAdmin
        .from("tts_generations")
        .update({
          status: "failed",
          error_message: uploadError.message,
        })
        .eq("id", generationId);
      await refundCredits(user.id, creditsUsed, "Text to speech upload failed - refund");
      return new Response(JSON.stringify({
        error: isMissingTtsBucketError(uploadError.message)
          ? "Text to speech storage is not configured. Apply the TTS migration before generating speech."
          : "Failed to store generated audio",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("tts-audio").getPublicUrl(filePath);

    const completedAt = new Date().toISOString();
    const { data: generation, error: updateError } = await supabaseAdmin
      .from("tts_generations")
      .update({
        status: "completed",
        audio_path: filePath,
        audio_url: publicUrl,
        completed_at: completedAt,
        error_message: null,
      })
      .eq("id", generationId)
      .select("*")
      .single();

    if (updateError || !generation) {
      await refundCredits(user.id, creditsUsed, "Text to speech completion save failed - refund");
      return new Response(JSON.stringify({ error: "Failed to finalize generated audio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        generation,
        remainingCredits: creditCheck.currentBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Text to speech error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
