import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const { channelNiche, channelDescription, targetAudience, analysis, realtime, count = 5 } = await req.json();
    
    // Input validation
    if (channelNiche && channelNiche.length > 500) {
      return new Response(JSON.stringify({ error: "Channel niche too long (max 500 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channelDescription && channelDescription.length > 2000) {
      return new Response(JSON.stringify({ error: "Channel description too long (max 2000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validCount = Math.min(Math.max(1, count), 10);

    // Check and deduct credits
    const creditCheck = await checkAndDeductCredits(userId, "generate-topics", "basic");
    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const TOPICS_AI_API = Deno.env.get("ANALYSIS_AI_API");
    const TOPICS_PROMPT_ID = "pmpt_697103d685108194a3edc19439377cfc0cc1cefa95a01e1b";
    
    if (!TOPICS_AI_API) {
      console.error("ANALYSIS_AI_API is not configured");
      await refundCredits(userId, creditCheck.cost!, "AI service not configured - refund");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisText = analysis ? JSON.stringify(analysis).slice(0, 4000) : "";
    const realtimeText = realtime ? JSON.stringify(realtime).slice(0, 4000) : "";
    const promptInput = [
      "Instruction: Deeply analyze the channel using realtime data (recent videos, performance, topics) and saved analysis before generating topics. Do not base topics on the channel name.",
      `Channel Niche: ${channelNiche || "General"}`,
      `Channel Description: ${channelDescription || "Not specified"}`,
      `Target Audience: ${targetAudience || "General audience"}`,
      analysisText ? `Channel analysis: ${analysisText}` : undefined,
      realtimeText ? `Realtime channel data: ${realtimeText}` : undefined,
      `Count: ${validCount}`,
    ].filter(Boolean).join("\n");

    const { data: competitorAnalyses } = await supabaseClient
      .from("competitor_analysis_results")
      .select("analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const competitorText = competitorAnalyses?.length
      ? JSON.stringify(competitorAnalyses.map((item) => item.analysis)).slice(0, 3000)
      : "";

    const promptInputWithCompetitor = [
      promptInput,
      competitorText ? `Competitor analysis: ${competitorText}` : undefined,
    ].filter(Boolean).join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOPICS_AI_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: { id: TOPICS_PROMPT_ID },
        input: promptInputWithCompetitor,
      }),
    });

    if (!response.ok) {
      await refundCredits(userId, creditCheck.cost!, "Topics AI error - refund");
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Topics AI error:", response.status, errorText);
      throw new Error("Failed to generate topics");
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

    const parseTopicsPayload = (text: string) => {
      try {
        return JSON.parse(text);
      } catch {
        const fencedJson = text.match(/```json\s*([\s\S]*?)\s*```/i);
        if (fencedJson?.[1]) {
          return JSON.parse(fencedJson[1]);
        }
        const fenced = text.match(/```\s*([\s\S]*?)\s*```/);
        if (fenced?.[1]) {
          return JSON.parse(fenced[1]);
        }
        const loose = text.match(/\{[\s\S]*\}/);
        if (loose?.[0]) {
          return JSON.parse(loose[0]);
        }
        throw new Error("Failed to parse topics response");
      }
    };

    const topics = parseTopicsPayload(content);

    return new Response(JSON.stringify(topics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-topics:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
