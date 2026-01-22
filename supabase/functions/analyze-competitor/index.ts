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

    const { competitorChannelUrl, niche, yourChannelInfo } = await req.json();
    
    // Input validation
    if (!competitorChannelUrl || typeof competitorChannelUrl !== 'string' || competitorChannelUrl.length > 500) {
      return new Response(JSON.stringify({ error: "Competitor channel link is required (max 500 chars)" }), {
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

    if (yourChannelInfo && yourChannelInfo.length > 2000) {
      return new Response(JSON.stringify({ error: "Channel info too long (max 2000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check and deduct credits (competitor analysis is more expensive)
    const creditCheck = await checkAndDeductCredits(userId, "analyze-competitor", "standard");
    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ANALYSIS_AI_API = Deno.env.get("ANALYSIS_AI_API");
    const COMPETITOR_PROMPT_ID = "pmpt_6972551ed7708193ab07f154318107dd03d2302601cc78ba";
    
    if (!ANALYSIS_AI_API) {
      console.error("ANALYSIS_AI_API is not configured");
      await refundCredits(userId, creditCheck.cost!, "AI service not configured - refund");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const extractChannelHint = (url: string) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname;
        if (path.includes("/@")) {
          return path.split("/@")[1]?.split("/")[0];
        }
        if (path.includes("/channel/")) {
          return path.split("/channel/")[1]?.split("/")[0];
        }
        if (path.includes("/c/")) {
          return path.split("/c/")[1]?.split("/")[0];
        }
        return undefined;
      } catch {
        return undefined;
      }
    };

    let channelMeta: { title?: string; author?: string; authorUrl?: string } = {};
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(competitorChannelUrl)}&format=json`;
      const metaResponse = await fetch(oembedUrl);
      if (metaResponse.ok) {
        const meta = await metaResponse.json();
        channelMeta = {
          title: typeof meta.title === "string" ? meta.title : undefined,
          author: typeof meta.author_name === "string" ? meta.author_name : undefined,
          authorUrl: typeof meta.author_url === "string" ? meta.author_url : undefined,
        };
      }
    } catch {
      // Ignore metadata fetch issues
    }

    const channelHint = extractChannelHint(competitorChannelUrl);
    const promptInput = [
      `Competitor Channel Link: ${competitorChannelUrl}`,
      channelHint ? `Channel Handle/ID: ${channelHint}` : undefined,
      channelMeta.title ? `Channel Title: ${channelMeta.title}` : undefined,
      channelMeta.author ? `Channel Author: ${channelMeta.author}` : undefined,
      channelMeta.authorUrl ? `Channel Author URL: ${channelMeta.authorUrl}` : undefined,
      niche ? `Niche: ${niche}` : undefined,
      yourChannelInfo ? `Your Channel Context: ${yourChannelInfo}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ANALYSIS_AI_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: { id: COMPETITOR_PROMPT_ID },
        input: promptInput,
      }),
    });

    if (!response.ok) {
      await refundCredits(userId, creditCheck.cost!, "OpenAI API error - refund");
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to analyze competitor" }), {
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

    const parseAnalysisPayload = (text: string) => {
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
        throw new Error("Failed to parse analysis response");
      }
    };

    const parsed = parseAnalysisPayload(content);
    const rawAnalysis = parsed?.analysis ? parsed.analysis : parsed;
    const normalizeList = (value: unknown) => (Array.isArray(value) ? value : []);
    const channelOverview = rawAnalysis?.channelOverview || rawAnalysis?.channel_overview || {};
    const contentStrategy = rawAnalysis?.contentStrategy || rawAnalysis?.content_strategy || {};
    const fallbackNiche = niche || "General content";

    const analysis = {
      channelOverview: {
        estimatedNiche: channelOverview.estimatedNiche ?? fallbackNiche,
        contentStyle: channelOverview.contentStyle ?? "Not specified",
        targetAudience: channelOverview.targetAudience ?? "Not specified",
        uniqueSellingPoint: channelOverview.uniqueSellingPoint ?? "Not specified",
      },
      contentStrategy: {
        uploadFrequency: contentStrategy.uploadFrequency ?? "Not specified",
        videoFormats: normalizeList(contentStrategy.videoFormats),
        averageLength: contentStrategy.averageLength ?? "Not specified",
        topPerformingTopics: normalizeList(contentStrategy.topPerformingTopics),
      },
      strengths: normalizeList(rawAnalysis?.strengths),
      weaknesses: normalizeList(rawAnalysis?.weaknesses),
      contentGaps: normalizeList(rawAnalysis?.contentGaps || rawAnalysis?.content_gaps),
      actionableInsights: normalizeList(rawAnalysis?.actionableInsights || rawAnalysis?.actionable_insights),
      titleFormulas: normalizeList(rawAnalysis?.titleFormulas || rawAnalysis?.title_formulas),
      thumbnailStyle: rawAnalysis?.thumbnailStyle || rawAnalysis?.thumbnail_style || "Not specified",
      engagementTactics: normalizeList(rawAnalysis?.engagementTactics || rawAnalysis?.engagement_tactics),
    };

    const { error: saveError } = await supabaseClient
      .from("competitor_analysis_results")
      .insert({
        user_id: userId,
        competitor_channel_url: competitorChannelUrl,
        analysis,
      });

    if (saveError) {
      console.error("Failed to save competitor analysis:", saveError);
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Competitor analysis error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
