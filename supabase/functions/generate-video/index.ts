import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deductCreditsWithAmount, refundCredits } from "../_shared/credits.ts";
import { requireMinimumPlan } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COST_PER_10_SECONDS = 80;
const MIN_DURATION_SECONDS = 10;
const MAX_DURATION_SECONDS = 120;
const STYLES = new Set(["cinematic", "documentary", "animated", "realistic", "product", "vertical-short"]);
const VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
const CAPTION_THEMES = new Set(["viral_pop", "minimal", "hormozi", "mrbeast"]);

const clampDuration = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_DURATION_SECONDS;
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, Math.round(numeric)));
};

const calculateCredits = (durationSeconds: number) =>
  Math.ceil(durationSeconds / 10) * COST_PER_10_SECONDS;

const normalizeStyle = (value: unknown) =>
  typeof value === "string" && STYLES.has(value) ? value : "vertical-short";

const joinUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

const parseProviderResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
};

const absoluteProviderUrl = (base: string, value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return joinUrl(base, value);
};

const isMissingVideoRelationError = (error: { code?: string; message?: string; details?: string } | null | undefined) => {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("text_to_video_generations") ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("schema cache")
  );
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
    const providerEndpoint =
      Deno.env.get("TEXT_TO_VIDEO_ENDPOINT") ??
      Deno.env.get("TEXT_TO_VIDEO_API_BASE") ??
      "";
    const providerApiKey = Deno.env.get("TEXT_TO_VIDEO_API_KEY") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessResponse = await requireMinimumPlan({
      supabaseClient: supabaseAdmin,
      userId: userData.user.id,
      minimumPlan: "basic",
      corsHeaders,
      message: "Text to video requires an active Basic, Pro, or Advanced subscription.",
    });
    if (accessResponse) return accessResponse;

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "generate";

    if (action === "status") {
      const generationId = typeof body?.generationId === "string" ? body.generationId : "";
      if (!generationId) {
        return new Response(JSON.stringify({ error: "Generation id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: generationRecord, error: generationError } = await supabaseAdmin
        .from("text_to_video_generations")
        .select("*")
        .eq("id", generationId)
        .eq("user_id", userData.user.id)
        .single();

      if (generationError || !generationRecord) {
        return new Response(JSON.stringify({ error: "Video generation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (
        generationRecord.status !== "processing" ||
        !generationRecord.provider_job_id ||
        !providerEndpoint
      ) {
        return new Response(JSON.stringify({ generation: generationRecord }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const statusResponse = await fetch(joinUrl(providerEndpoint, `/api/renders/${generationRecord.provider_job_id}`), {
        headers: providerApiKey ? { Authorization: `Bearer ${providerApiKey}` } : {},
      });
      const statusPayload = await parseProviderResponse(statusResponse);

      if (!statusResponse.ok) {
        return new Response(JSON.stringify({
          error: typeof statusPayload.detail === "string"
            ? statusPayload.detail
            : typeof statusPayload.raw === "string"
              ? statusPayload.raw
              : "Failed to check render status",
        }), {
          status: statusResponse.status >= 400 && statusResponse.status < 500 ? statusResponse.status : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const providerStatus = typeof statusPayload.status === "string" ? statusPayload.status : "processing";
      const finalVideoUrl = absoluteProviderUrl(providerEndpoint, statusPayload.final_video_url);
      const nextStatus = providerStatus === "completed"
        ? "completed"
        : providerStatus === "failed"
          ? "failed"
          : "processing";

      const { data: updatedGeneration, error: updateStatusError } = await supabaseAdmin
        .from("text_to_video_generations")
        .update({
          status: nextStatus,
          video_url: finalVideoUrl,
          provider_response: statusPayload,
          completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
          error_message: nextStatus === "failed"
            ? (typeof statusPayload.error === "string" ? statusPayload.error : "Render failed")
            : null,
        })
        .eq("id", generationId)
        .select("*")
        .single();

      if (updateStatusError || !updatedGeneration) {
        return new Response(JSON.stringify({
          error: updateStatusError?.message || "Failed to update render status",
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ generation: updatedGeneration }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const durationSeconds = clampDuration(body?.durationSeconds);
    const aspectRatio =
      body?.aspectRatio === "16:9" || body?.aspectRatio === "1:1" ? body.aspectRatio : "9:16";
    const style = normalizeStyle(body?.style);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const voice = typeof body?.voice === "string" && VOICES.has(body.voice) ? body.voice : "nova";
    const captionTheme =
      typeof body?.captionTheme === "string" && CAPTION_THEMES.has(body.captionTheme)
        ? body.captionTheme
        : "viral_pop";

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!providerEndpoint) {
      return new Response(JSON.stringify({
        error: "Text to video is not configured. Set TEXT_TO_VIDEO_ENDPOINT to your Youtube-Shorts-Maker backend base URL.",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creditsUsed = calculateCredits(durationSeconds);
    const creditCheck = await deductCreditsWithAmount(
      userData.user.id,
      creditsUsed,
      "generate-video",
      `Text to Video - ${durationSeconds}s`,
      durationSeconds <= 10 ? "basic" : durationSeconds <= 30 ? "standard" : "extensive"
    );

    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: insertedGeneration, error: insertError } = await supabaseAdmin
      .from("text_to_video_generations")
      .insert({
        user_id: userData.user.id,
        prompt,
        style,
        aspect_ratio: aspectRatio,
        duration_seconds: durationSeconds,
        credits_used: creditsUsed,
        status: "processing",
      })
      .select("*")
      .single();

    if (insertError || !insertedGeneration) {
      await refundCredits(userData.user.id, creditsUsed, "Text to video save failed - refund");
      return new Response(JSON.stringify({
        error: isMissingVideoRelationError(insertError)
          ? "Text to video database is not configured. Apply the text-to-video migration before generating video."
          : insertError?.message || "Failed to create video job",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generatedProjectResponse = await fetch(joinUrl(providerEndpoint, "/api/projects/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(providerApiKey ? { Authorization: `Bearer ${providerApiKey}` } : {}),
      },
      body: JSON.stringify({
        title: title || prompt.slice(0, 60) || "Text to Video",
        script: prompt,
        aspect: aspectRatio,
        voice,
        caption_theme: captionTheme || (style === "documentary" ? "minimal" : "viral_pop"),
      }),
    });

    const generatedProject = await parseProviderResponse(generatedProjectResponse);

    if (!generatedProjectResponse.ok) {
      await supabaseAdmin
        .from("text_to_video_generations")
        .update({
          status: "failed",
          error_message: typeof generatedProject.detail === "string"
            ? generatedProject.detail
            : typeof generatedProject.raw === "string"
              ? generatedProject.raw
              : "Failed to generate video project",
        })
        .eq("id", insertedGeneration.id);
      await refundCredits(userData.user.id, creditsUsed, "Text to video provider error - refund");
      return new Response(JSON.stringify({
        error: typeof generatedProject.detail === "string"
          ? generatedProject.detail
          : typeof generatedProject.raw === "string"
            ? generatedProject.raw
            : "Failed to generate video project",
      }), {
        status: generatedProjectResponse.status >= 400 && generatedProjectResponse.status < 500 ? generatedProjectResponse.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerProjectId = typeof generatedProject.id === "string" ? generatedProject.id : null;
    if (!providerProjectId) {
      await supabaseAdmin
        .from("text_to_video_generations")
        .update({ status: "failed", error_message: "Video provider did not return a project id" })
        .eq("id", insertedGeneration.id);
      await refundCredits(userData.user.id, creditsUsed, "Text to video provider response error - refund");
      return new Response(JSON.stringify({ error: "Video provider did not return a project id" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const renderResponse = await fetch(joinUrl(providerEndpoint, "/api/renders"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(providerApiKey ? { Authorization: `Bearer ${providerApiKey}` } : {}),
      },
      body: JSON.stringify({
        project_id: providerProjectId,
        fps: 30,
        out_format: "mp4",
      }),
    });
    const renderPayload = await parseProviderResponse(renderResponse);

    if (!renderResponse.ok) {
      await supabaseAdmin
        .from("text_to_video_generations")
        .update({
          status: "failed",
          provider_response: { project: generatedProject, render: renderPayload },
          error_message: typeof renderPayload.detail === "string"
            ? renderPayload.detail
            : typeof renderPayload.raw === "string"
              ? renderPayload.raw
              : "Failed to start video render",
        })
        .eq("id", insertedGeneration.id);
      await refundCredits(userData.user.id, creditsUsed, "Text to video render start error - refund");
      return new Response(JSON.stringify({
        error: typeof renderPayload.detail === "string"
          ? renderPayload.detail
          : typeof renderPayload.raw === "string"
            ? renderPayload.raw
            : "Failed to start video render",
      }), {
        status: renderResponse.status >= 400 && renderResponse.status < 500 ? renderResponse.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerJobId = typeof renderPayload.job_id === "string" ? renderPayload.job_id : null;

    const { data: generation, error: updateError } = await supabaseAdmin
      .from("text_to_video_generations")
      .update({
        status: "processing",
        video_url: null,
        provider_job_id: providerJobId,
        provider_response: { project: generatedProject, render: renderPayload },
        completed_at: null,
        error_message: null,
      })
      .eq("id", insertedGeneration.id)
      .select("*")
      .single();

    if (updateError || !generation) {
      await refundCredits(userData.user.id, creditsUsed, "Text to video completion save failed - refund");
      return new Response(JSON.stringify({
        error: updateError?.message || "Failed to finalize generated video",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      generation,
      remainingCredits: creditCheck.currentBalance,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Text to video error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
