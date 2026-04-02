import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAndDeductCredits, refundCredits } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, style, channelNiche } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: "Topic is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get authorization header for user verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check subscription and usage limits
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single();

    const plan = subscription?.plan || "free";
    
    // Plan limits for thumbnails
    const thumbnailLimits: Record<string, number> = {
      free: 0,
      basic: 0,
      pro: 5,
      advanced: -1, // unlimited
    };

    const dailyLimit = thumbnailLimits[plan] ?? 0;

    if (dailyLimit === 0) {
      return new Response(
        JSON.stringify({ error: "Thumbnail generation is not available on your plan. Please upgrade to Pro or Advanced." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check today's usage
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await supabase
      .from("usage_tracking")
      .select("thumbnails_generated")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    const currentUsage = usage?.thumbnails_generated || 0;

    if (dailyLimit !== -1 && currentUsage >= dailyLimit) {
      return new Response(
        JSON.stringify({ error: `Daily thumbnail limit reached (${dailyLimit}/day). Upgrade to Advanced for unlimited.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check and deduct AI credits (thumbnails are expensive)
    const creditCheck = await checkAndDeductCredits(user.id, "generate-thumbnail", "extensive");
    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const THUMBNAIL_AI_API = Deno.env.get("ANALYSIS_AI_API");
    const THUMBNAIL_PROMPT_ID = "pmpt_69724b66d1e88197a387d3a65c2fd0c40e4cdde79801def6";
    if (!THUMBNAIL_AI_API) {
      console.error("ANALYSIS_AI_API is not configured");
      await refundCredits(user.id, creditCheck.cost!, "AI service not configured - refund");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt for thumbnail generation
    const stylePrompts: Record<string, string> = {
      dramatic: "dramatic lighting, high contrast, bold colors, cinematic",
      minimal: "clean, minimalist, simple design, modern, sleek",
      vibrant: "bright colors, energetic, eye-catching, dynamic",
      professional: "professional, polished, corporate, clean",
      playful: "fun, cartoon-style, bright, whimsical",
    };

    const styleDescription = stylePrompts[style] || stylePrompts.vibrant;
    
    const { data: competitorAnalyses } = await supabase
      .from("competitor_analysis_results")
      .select("analysis")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const competitorText = competitorAnalyses?.length
      ? JSON.stringify(competitorAnalyses.map((item) => item.analysis)).slice(0, 3000)
      : "";

    const promptInput = [
      `Topic: ${topic}`,
      `Style: ${styleDescription}`,
      channelNiche ? `Channel niche: ${channelNiche}` : undefined,
      competitorText ? `Competitor analysis: ${competitorText}` : undefined,
      "Aspect ratio: 16:9",
      "No text in image",
      "High CTR, bold visual elements",
    ].filter(Boolean).join("\n");

    const promptResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${THUMBNAIL_AI_API}`,
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
      return new Response(
        JSON.stringify({ error: "Failed to generate thumbnail prompt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const promptData = await promptResponse.json();
    const promptContent =
      promptData.output_text ||
      promptData.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) =>
        item.content?.map((part) => (part.type === "output_text" ? part.text : undefined))
      ).find(Boolean);

    if (!promptContent) {
      await refundCredits(user.id, creditCheck.cost!, "Thumbnail prompt empty - refund");
      return new Response(
        JSON.stringify({ error: "Failed to generate thumbnail prompt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const thumbnailPrompt = promptContent.trim();

    console.log("Generating thumbnail with prompt:", thumbnailPrompt);

    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${THUMBNAIL_AI_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1.5",
        prompt: thumbnailPrompt,
        size: "1536x1024",
        quality: "medium",
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("OpenAI image error:", imageResponse.status, errorText);
      
      // Refund credits on error
      await refundCredits(user.id, creditCheck.cost!, "AI gateway error - refund");
      
      if (imageResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (imageResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate thumbnail" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await imageResponse.json();
    const b64Image = data.data?.[0]?.b64_json;
    const imageUrl = b64Image ? `data:image/png;base64,${b64Image}` : undefined;
    const textResponse = thumbnailPrompt;

    if (!imageUrl) {
      console.error("No image in response:", data);
      await refundCredits(user.id, creditCheck.cost!, "No image generated - refund");
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update usage tracking
    const { error: upsertError } = await supabase
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

    console.log("Thumbnail generated successfully");

    return new Response(
      JSON.stringify({
        imageUrl,
        description: textResponse,
        usage: {
          used: currentUsage + 1,
          limit: dailyLimit === -1 ? "unlimited" : dailyLimit,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
