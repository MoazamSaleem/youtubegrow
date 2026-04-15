import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAndDeductCredits, refundCredits } from "../_shared/credits.ts";
import { getActiveSubscriptionPlan, requireMinimumPlan } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const THUMBNAIL_PROMPT_ID = "pmpt_69724b66d1e88197a387d3a65c2fd0c40e4cdde79801def6";
const THUMBNAIL_IMAGE_MODEL = "gpt-image-1";

const extractOutputText = (data: any) => {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const content = data?.output
    ?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) =>
      item.content?.map((part) => (part.type === "output_text" ? part.text : undefined))
    )
    .filter(Boolean)
    .join("");

  return typeof content === "string" && content.trim() ? content.trim() : null;
};

const extractProviderErrorMessage = (raw: string, fallback: string) => {
  if (!raw.trim()) return fallback;

  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        message?: string;
        type?: string;
        code?: string;
      };
      message?: string;
      detail?: string;
    };

    if (typeof parsed.error?.message === "string" && parsed.error.message.trim()) {
      return parsed.error.message.trim();
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail.trim();
    }
  } catch {
    // Fall back to the raw response below.
  }

  return raw.trim() || fallback;
};

const getCurrentThumbnailUsage = async (userClient: ReturnType<typeof createClient>, userId: string, date: string) => {
  const { data, error } = await userClient
    .from("usage_tracking")
    .select("thumbnails_generated, created_at")
    .eq("user_id", userId)
    .eq("date", date)
    .order("thumbnails_generated", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0]?.thumbnails_generated || 0;
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

    const { topic, style, channelNiche, updatePrompt } = await req.json();

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const thumbnailAiApi =
      Deno.env.get("OPENAI_API_KEY") ??
      Deno.env.get("ANALYSIS_AI_API") ??
      "";

    if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceKey)) {
      console.error("Supabase environment variables are not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
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
      console.error("generate-thumbnail auth error:", userError?.message ?? userError);
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
      message: "Thumbnail generation requires an active Pro or Advanced subscription.",
    });
    if (accessResponse) {
      return accessResponse;
    }

    const plan = await getActiveSubscriptionPlan(userClient, user.id);
    const thumbnailLimits: Record<string, number> = {
      pro: 5,
      advanced: -1,
    };
    const dailyLimit = plan ? thumbnailLimits[plan] ?? 0 : 0;

    if (dailyLimit === 0) {
      return new Response(
        JSON.stringify({ error: "Thumbnail generation is not available on your plan. Please upgrade to Pro or Advanced." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const currentUsage = await getCurrentThumbnailUsage(userClient, user.id, today);
    if (dailyLimit !== -1 && currentUsage >= dailyLimit) {
      return new Response(
        JSON.stringify({ error: `Daily thumbnail limit reached (${dailyLimit}/day). Upgrade to Advanced for unlimited.` }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const creditCheck = await checkAndDeductCredits(user.id, "generate-thumbnail", "extensive");
    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!thumbnailAiApi) {
      console.error("Neither OPENAI_API_KEY nor ANALYSIS_AI_API is configured");
      await refundCredits(user.id, creditCheck.cost!, "AI service not configured - refund");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stylePrompts: Record<string, string> = {
      dramatic: "dramatic lighting, high contrast, bold colors, cinematic",
      minimal: "clean, minimalist, simple design, modern, sleek",
      vibrant: "bright colors, energetic, eye-catching, dynamic",
      professional: "professional, polished, corporate, clean",
      playful: "fun, cartoon-style, bright, whimsical",
    };

    const styleDescription = stylePrompts[style] || stylePrompts.vibrant;
    const { data: competitorAnalyses } = await userClient
      .from("competitor_analysis_results")
      .select("analysis")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const competitorText = competitorAnalyses?.length
      ? JSON.stringify(competitorAnalyses.map((item) => item.analysis)).slice(0, 3000)
      : "";

    const promptInput = [
      `Topic: ${topic.trim()}`,
      `Style: ${styleDescription}`,
      channelNiche ? `Channel niche: ${channelNiche}` : undefined,
      updatePrompt && typeof updatePrompt === "string" && updatePrompt.trim()
        ? `User update request: ${updatePrompt.trim()}`
        : undefined,
      competitorText ? `Competitor analysis: ${competitorText}` : undefined,
      "Aspect ratio: 16:9",
      "No text in image",
      "High CTR, bold visual elements",
    ].filter(Boolean).join("\n");

    const promptResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${thumbnailAiApi}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: { id: THUMBNAIL_PROMPT_ID },
        input: promptInput,
      }),
    });

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error("Thumbnail prompt error:", promptResponse.status, errorText);
      await refundCredits(user.id, creditCheck.cost!, "Thumbnail prompt error - refund");

      if (promptResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if ([401, 402, 403].includes(promptResponse.status)) {
        return new Response(
          JSON.stringify({ error: extractProviderErrorMessage(errorText, "AI API key error. Please check your OpenAI API key and billing status.") }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: extractProviderErrorMessage(errorText, "Failed to generate thumbnail prompt") }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const promptData = await promptResponse.json();
    const promptContent = extractOutputText(promptData);

    if (!promptContent) {
      await refundCredits(user.id, creditCheck.cost!, "Thumbnail prompt empty - refund");
      return new Response(JSON.stringify({ error: "Failed to generate thumbnail prompt" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thumbnailPrompt = promptContent.trim();

    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${thumbnailAiApi}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: THUMBNAIL_IMAGE_MODEL,
        prompt: thumbnailPrompt,
        size: "1536x1024",
        quality: "medium",
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("OpenAI image error:", imageResponse.status, errorText);
      await refundCredits(user.id, creditCheck.cost!, "Thumbnail image error - refund");

      if (imageResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if ([401, 402, 403].includes(imageResponse.status)) {
        return new Response(
          JSON.stringify({ error: extractProviderErrorMessage(errorText, "AI API key error. Please check your OpenAI API key and billing status.") }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: extractProviderErrorMessage(errorText, "Failed to generate thumbnail") }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const imageData = await imageResponse.json();
    const b64Image = imageData.data?.[0]?.b64_json;
    const imageUrl = b64Image ? `data:image/png;base64,${b64Image}` : undefined;

    if (!imageUrl) {
      console.error("No image in response:", imageData);
      await refundCredits(user.id, creditCheck.cost!, "No image generated - refund");
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertError } = await userClient
      .from("usage_tracking")
      .upsert(
        {
          user_id: user.id,
          date: today,
          thumbnails_generated: currentUsage + 1,
        },
        {
          onConflict: "user_id,date",
        }
      );

    if (upsertError) {
      console.error("Failed to update usage:", upsertError);
    }

    return new Response(
      JSON.stringify({
        imageUrl,
        description: thumbnailPrompt,
        usage: {
          used: currentUsage + 1,
          limit: dailyLimit === -1 ? "unlimited" : dailyLimit,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
