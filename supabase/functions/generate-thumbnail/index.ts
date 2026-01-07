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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
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
    
    const thumbnailPrompt = `Create a YouTube thumbnail for a video about: "${topic}". 
Style: ${styleDescription}. 
${channelNiche ? `Channel niche: ${channelNiche}.` : ""}
The thumbnail should be 16:9 aspect ratio, eye-catching, designed to maximize click-through rate.
Include bold visual elements that convey the topic at a glance.
NO text or words in the image - only visual elements.
Ultra high resolution, professional quality YouTube thumbnail.`;

    console.log("Generating thumbnail with prompt:", thumbnailPrompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: thumbnailPrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
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

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = data.choices?.[0]?.message?.content;

    if (!imageUrl) {
      console.error("No image in response:", data);
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
