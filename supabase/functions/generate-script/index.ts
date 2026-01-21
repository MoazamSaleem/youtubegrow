import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deductCreditsWithAmount, refundCredits } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log('Authenticated user:', userId);

    const { topic, targetAudience, tone, duration, includeHook, includeCTA } = await req.json();
    
    // Input validation
    if (!topic || typeof topic !== 'string' || topic.length > 500) {
      return new Response(JSON.stringify({ error: "Topic is required (max 500 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetAudience && targetAudience.length > 500) {
      return new Response(JSON.stringify({ error: "Target audience too long (max 500 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseCost = 30;
    const creditCheck = await deductCreditsWithAmount(
      userId,
      baseCost,
      "generate-script",
      "Generate Script - base",
      "basic"
    );
    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SCRIPT_AI_API = Deno.env.get("ANALYSIS_AI_API");
    const SCRIPT_PROMPT_ID = "pmpt_697104a1f81081959648d3217603f4280678275f8ef01952";
    
    if (!SCRIPT_AI_API) {
      console.error("ANALYSIS_AI_API is not configured");
      await refundCredits(userId, creditCheck.cost!, "AI service not configured - refund");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const promptInput = [
      `Topic: ${topic}`,
      `Target Audience: ${targetAudience || "General YouTube viewers"}`,
      `Tone: ${tone || "Engaging and informative"}`,
      `Estimated Duration: ${duration || "8-10"} minutes`,
      includeHook ? "Include a strong hook in the first 10 seconds" : undefined,
      includeCTA ? "Include call-to-action for likes, comments, and subscriptions" : undefined,
    ].filter(Boolean).join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SCRIPT_AI_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: { id: SCRIPT_PROMPT_ID },
        input: promptInput,
      }),
    });

    if (!response.ok) {
      await refundCredits(userId, creditCheck.cost!, "Script AI error - refund");
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Script AI error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to generate script" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content =
      data.output_text ||
      data.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) =>
        item.content?.map((part) => (part.type === "output_text" ? part.text : undefined))
      ).find(Boolean);
    
    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse script response");
    }
    
    const script = JSON.parse(jsonMatch[0]);

    const scriptText = [
      script.hook,
      script.introduction,
      ...(Array.isArray(script.sections) ? script.sections.map((section: { content?: string }) => section.content) : []),
      script.conclusion,
      script.callToAction,
    ]
      .filter(Boolean)
      .join("\n");

    const shortLimit = 2500;
    const extraChunkSize = 1000;
    const extraChunkCost = 10;
    const extraChunks = Math.max(0, Math.ceil((scriptText.length - shortLimit) / extraChunkSize));
    const totalCost = baseCost + extraChunks * extraChunkCost;
    const additionalCost = totalCost - baseCost;

    if (additionalCost > 0) {
      const additional = await deductCreditsWithAmount(
        userId,
        additionalCost,
        "generate-script",
        `Generate Script - length (${scriptText.length} chars)`,
        "standard"
      );
      if (!additional.success) {
        await refundCredits(userId, baseCost, "Insufficient credits for script length - refund");
        return new Response(JSON.stringify({ error: additional.error || "Insufficient credits" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ script, creditsUsed: totalCost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Script generation error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
