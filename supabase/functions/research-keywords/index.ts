import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAndDeductCredits, refundCredits } from "../_shared/credits.ts";
import { requireMinimumPlan } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4 || 4)), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceKey)) {
      console.error("Supabase keys are not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    let userId = userData?.user?.id;

    if (!userId) {
      const payload = decodeJwtPayload(token);
      const expectedIss = `${supabaseUrl}/auth/v1`;
      if (payload?.sub && payload?.iss === expectedIss) {
        userId = payload.sub as string;
      } else {
        console.error("Auth error:", userError?.message || userError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    console.log('Authenticated user:', userId);

    const accessResponse = await requireMinimumPlan({
      supabaseClient,
      userId,
      minimumPlan: "basic",
      corsHeaders,
      message: "Keyword research requires an active Basic, Pro, or Advanced subscription.",
    });
    if (accessResponse) {
      return accessResponse;
    }

    const { query, niche, analysis, realtime, existingKeywords, count = 10 } = await req.json();
    
    // Input validation
    if (!query || typeof query !== 'string' || query.length > 200) {
      return new Response(JSON.stringify({ error: "Query is required (max 200 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (niche && niche.length > 200) {
      return new Response(JSON.stringify({ error: "Niche too long (max 200 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validCount = Math.min(Math.max(1, count), 20);

    // Check and deduct credits
    const creditCheck = await checkAndDeductCredits(userId, "research-keywords", "basic");
    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const KEYWORDS_AI_API = Deno.env.get("ANALYSIS_AI_API");
    const KEYWORDS_PROMPT_ID = "pmpt_6970b50a6950819098a5e397fbbede7104f6cbb1c8b31a6c";
    
    if (!KEYWORDS_AI_API) {
      console.error("ANALYSIS_AI_API is not configured");
      await refundCredits(userId, creditCheck.cost!, "AI service not configured - refund");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisText = analysis ? JSON.stringify(analysis).slice(0, 4000) : "";
    const { data: competitorAnalyses } = await supabaseClient
      .from("competitor_analysis_results")
      .select("analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    const competitorText = competitorAnalyses?.length
      ? JSON.stringify(competitorAnalyses.map((item) => item.analysis)).slice(0, 3000)
      : "";
    const existingList = Array.isArray(existingKeywords)
      ? existingKeywords.map((item) => String(item)).slice(0, 50)
      : [];
    const realtimeText = realtime ? JSON.stringify(realtime).slice(0, 4000) : "";
    const promptInput = [
      "Instruction: Deeply analyze the channel using realtime data (recent videos, performance, topics) and saved analysis before generating keywords. Do not base keywords on the channel name.",
      `Query: ${query}`,
      niche ? `Niche: ${niche}` : undefined,
      analysisText ? `Channel analysis: ${analysisText}` : undefined,
      realtimeText ? `Realtime channel data: ${realtimeText}` : undefined,
      competitorText ? `Competitor analysis: ${competitorText}` : undefined,
      existingList.length ? `Avoid duplicates: ${existingList.join(", ")}` : undefined,
      `Count: ${validCount}`,
    ].filter(Boolean).join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEYWORDS_AI_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: { id: KEYWORDS_PROMPT_ID },
        input: promptInput,
      }),
    });

    if (!response.ok) {
      await refundCredits(userId, creditCheck.cost!, "Keywords AI error - refund");

      const errorText = await response.text();
      console.error("Keywords AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          error: "Failed to research keywords",
          details: errorText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    const parseKeywordsPayload = (text: string) => {
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
        throw new Error("Failed to parse keywords response");
      }
    };

    let keywords;
    try {
      keywords = parseKeywordsPayload(content);
    } catch (error) {
      console.error("Keywords parse error. Raw content:", content);
      throw error;
    }

    return new Response(JSON.stringify(keywords), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in research-keywords:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
