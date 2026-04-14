import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAndDeductCredits, refundCredits } from "../_shared/credits.ts";
import { requireMinimumPlan } from "../_shared/subscription.ts";

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

    const accessResponse = await requireMinimumPlan({
      supabaseClient,
      userId,
      minimumPlan: "basic",
      corsHeaders,
      message: "Competitor analysis requires an active Basic, Pro, or Advanced subscription.",
    });
    if (accessResponse) {
      return accessResponse;
    }

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const metaResponse = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
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

    const callCompetitorAI = async (input: string) => {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANALYSIS_AI_API}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: { id: COMPETITOR_PROMPT_ID },
          input,
        }),
      });

      if (!response.ok) {
        await refundCredits(userId, creditCheck.cost!, "OpenAI API error - refund");

        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        throw new Error("Failed to analyze competitor");
      }

      return response.json();
    };

    const responseData = await callCompetitorAI(promptInput);
    console.log("Competitor AI response received");

    const extractContent = (data: any) =>
      data.output_text ||
      data.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) =>
        item.content?.map((part) => (part.type === "output_text" ? part.text : undefined))
      ).find(Boolean);

    let content = extractContent(responseData);
    if (!content) {
      throw new Error("No content received from AI");
    }
    
    console.log("Competitor AI content length:", content.length);

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
        estimatedNiche: channelOverview.estimatedNiche ?? channelOverview.estimated_niche ?? fallbackNiche,
        contentStyle: channelOverview.contentStyle ?? channelOverview.content_style ?? "Not specified",
        targetAudience: channelOverview.targetAudience ?? channelOverview.target_audience ?? "Not specified",
        uniqueSellingPoint: channelOverview.uniqueSellingPoint ?? channelOverview.unique_selling_point ?? "Not specified",
      },
      contentStrategy: {
        uploadFrequency: contentStrategy.uploadFrequency ?? contentStrategy.upload_frequency ?? "Not specified",
        videoFormats: normalizeList(contentStrategy.videoFormats ?? contentStrategy.video_formats),
        averageLength: contentStrategy.averageLength ?? contentStrategy.average_length ?? "Not specified",
        topPerformingTopics: normalizeList(contentStrategy.topPerformingTopics ?? contentStrategy.top_performing_topics),
      },
      strengths: normalizeList(rawAnalysis?.strengths),
      weaknesses: normalizeList(rawAnalysis?.weaknesses),
      contentGaps: normalizeList(rawAnalysis?.contentGaps || rawAnalysis?.content_gaps),
      actionableInsights: normalizeList(rawAnalysis?.actionableInsights || rawAnalysis?.actionable_insights),
      titleFormulas: normalizeList(rawAnalysis?.titleFormulas || rawAnalysis?.title_formulas),
      thumbnailStyle: rawAnalysis?.thumbnailStyle || rawAnalysis?.thumbnail_style || "Not specified",
      engagementTactics: normalizeList(rawAnalysis?.engagementTactics || rawAnalysis?.engagement_tactics),
    };

    const hasMeaningfulData =
      analysis.channelOverview.estimatedNiche !== "Not specified" ||
      analysis.channelOverview.contentStyle !== "Not specified" ||
      analysis.channelOverview.targetAudience !== "Not specified" ||
      analysis.channelOverview.uniqueSellingPoint !== "Not specified" ||
      analysis.contentStrategy.uploadFrequency !== "Not specified" ||
      analysis.contentStrategy.averageLength !== "Not specified" ||
      analysis.contentStrategy.videoFormats.length > 0 ||
      analysis.contentStrategy.topPerformingTopics.length > 0 ||
      analysis.strengths.length > 0 ||
      analysis.weaknesses.length > 0 ||
      analysis.contentGaps.length > 0 ||
      analysis.actionableInsights.length > 0 ||
      analysis.titleFormulas.length > 0 ||
      analysis.engagementTactics.length > 0;

    if (!hasMeaningfulData) {
      const retryInput = `${promptInput}\n\nIMPORTANT: Return a fully populated JSON with all required keys. Do not leave any field empty or "Not specified". Infer reasonable values from the channel handle, title, and niche if needed.`;
      const retryData = await callCompetitorAI(retryInput);
      const retryContent = extractContent(retryData);
      if (retryContent) {
        const retryParsed = parseAnalysisPayload(retryContent);
        const retryRaw = retryParsed?.analysis ? retryParsed.analysis : retryParsed;
        const retryChannel = retryRaw?.channelOverview || retryRaw?.channel_overview || {};
        const retryStrategy = retryRaw?.contentStrategy || retryRaw?.content_strategy || {};
        const retryVideoFormats = normalizeList(retryStrategy.videoFormats);
        const retryTopTopics = normalizeList(retryStrategy.topPerformingTopics);
        const retryStrengths = normalizeList(retryRaw?.strengths);
        const retryWeaknesses = normalizeList(retryRaw?.weaknesses);
        const retryGaps = normalizeList(retryRaw?.contentGaps || retryRaw?.content_gaps);
        const retryInsights = normalizeList(retryRaw?.actionableInsights || retryRaw?.actionable_insights);
        const retryFormulas = normalizeList(retryRaw?.titleFormulas || retryRaw?.title_formulas);
        const retryTactics = normalizeList(retryRaw?.engagementTactics || retryRaw?.engagement_tactics);
        analysis.channelOverview = {
          estimatedNiche: retryChannel.estimatedNiche ?? retryChannel.estimated_niche ?? analysis.channelOverview.estimatedNiche,
          contentStyle: retryChannel.contentStyle ?? retryChannel.content_style ?? analysis.channelOverview.contentStyle,
          targetAudience: retryChannel.targetAudience ?? retryChannel.target_audience ?? analysis.channelOverview.targetAudience,
          uniqueSellingPoint: retryChannel.uniqueSellingPoint ?? retryChannel.unique_selling_point ?? analysis.channelOverview.uniqueSellingPoint,
        };
        analysis.contentStrategy = {
          uploadFrequency: retryStrategy.uploadFrequency ?? retryStrategy.upload_frequency ?? analysis.contentStrategy.uploadFrequency,
          videoFormats: retryVideoFormats.length ? retryVideoFormats : analysis.contentStrategy.videoFormats,
          averageLength: retryStrategy.averageLength ?? retryStrategy.average_length ?? analysis.contentStrategy.averageLength,
          topPerformingTopics: retryTopTopics.length ? retryTopTopics : analysis.contentStrategy.topPerformingTopics,
        };
        analysis.strengths = retryStrengths.length ? retryStrengths : analysis.strengths;
        analysis.weaknesses = retryWeaknesses.length ? retryWeaknesses : analysis.weaknesses;
        analysis.contentGaps = retryGaps.length ? retryGaps : analysis.contentGaps;
        analysis.actionableInsights = retryInsights.length ? retryInsights : analysis.actionableInsights;
        analysis.titleFormulas = retryFormulas.length ? retryFormulas : analysis.titleFormulas;
        analysis.thumbnailStyle = retryRaw?.thumbnailStyle || retryRaw?.thumbnail_style || analysis.thumbnailStyle;
        analysis.engagementTactics = retryTactics.length ? retryTactics : analysis.engagementTactics;
      }
    }

    const stillEmpty =
      analysis.channelOverview.contentStyle === "Not specified" &&
      analysis.channelOverview.targetAudience === "Not specified" &&
      analysis.channelOverview.uniqueSellingPoint === "Not specified" &&
      analysis.contentStrategy.uploadFrequency === "Not specified" &&
      analysis.contentStrategy.averageLength === "Not specified" &&
      analysis.contentStrategy.videoFormats.length === 0 &&
      analysis.contentStrategy.topPerformingTopics.length === 0 &&
      analysis.strengths.length === 0 &&
      analysis.weaknesses.length === 0 &&
      analysis.contentGaps.length === 0 &&
      analysis.actionableInsights.length === 0 &&
      analysis.titleFormulas.length === 0 &&
      analysis.engagementTactics.length === 0;

    if (stillEmpty) {
      const directPrompt = `You are a YouTube competitive analyst. Using the channel info below, infer a plausible competitor analysis. Always return VALID JSON with ALL keys populated. Do not leave any field blank or "Not specified".\n\n${promptInput}\n\nJSON schema:\n{\n  \"channelOverview\": {\n    \"estimatedNiche\": \"\",\n    \"contentStyle\": \"\",\n    \"targetAudience\": \"\",\n    \"uniqueSellingPoint\": \"\"\n  },\n  \"contentStrategy\": {\n    \"uploadFrequency\": \"\",\n    \"videoFormats\": [\"\"],\n    \"averageLength\": \"\",\n    \"topPerformingTopics\": [\"\"]\n  },\n  \"strengths\": [{\"area\":\"\",\"description\":\"\",\"howToAdapt\":\"\"}],\n  \"weaknesses\": [{\"area\":\"\",\"description\":\"\",\"yourOpportunity\":\"\"}],\n  \"contentGaps\": [{\"topic\":\"\",\"potential\":\"\",\"difficulty\":\"\"}],\n  \"actionableInsights\": [{\"priority\":\"\",\"action\":\"\",\"expectedImpact\":\"\"}],\n  \"titleFormulas\": [\"\"],\n  \"thumbnailStyle\": \"\",\n  \"engagementTactics\": [\"\"]\n}`;

      const directResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANALYSIS_AI_API}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          input: directPrompt,
        }),
      });

      if (directResponse.ok) {
        const directData = await directResponse.json();
        const directContent = extractContent(directData);
        if (directContent) {
          const directParsed = parseAnalysisPayload(directContent);
          const directRaw = directParsed?.analysis ? directParsed.analysis : directParsed;
          const directChannel = directRaw?.channelOverview || directRaw?.channel_overview || {};
          const directStrategy = directRaw?.contentStrategy || directRaw?.content_strategy || {};
          const directVideoFormats = normalizeList(directStrategy.videoFormats || directStrategy.video_formats);
          const directTopTopics = normalizeList(directStrategy.topPerformingTopics || directStrategy.top_performing_topics);
          analysis.channelOverview = {
            estimatedNiche: directChannel.estimatedNiche ?? directChannel.estimated_niche ?? analysis.channelOverview.estimatedNiche,
            contentStyle: directChannel.contentStyle ?? directChannel.content_style ?? analysis.channelOverview.contentStyle,
            targetAudience: directChannel.targetAudience ?? directChannel.target_audience ?? analysis.channelOverview.targetAudience,
            uniqueSellingPoint: directChannel.uniqueSellingPoint ?? directChannel.unique_selling_point ?? analysis.channelOverview.uniqueSellingPoint,
          };
          analysis.contentStrategy = {
            uploadFrequency: directStrategy.uploadFrequency ?? directStrategy.upload_frequency ?? analysis.contentStrategy.uploadFrequency,
            videoFormats: directVideoFormats.length ? directVideoFormats : analysis.contentStrategy.videoFormats,
            averageLength: directStrategy.averageLength ?? directStrategy.average_length ?? analysis.contentStrategy.averageLength,
            topPerformingTopics: directTopTopics.length ? directTopTopics : analysis.contentStrategy.topPerformingTopics,
          };
          analysis.strengths = normalizeList(directRaw?.strengths) || analysis.strengths;
          analysis.weaknesses = normalizeList(directRaw?.weaknesses) || analysis.weaknesses;
          analysis.contentGaps = normalizeList(directRaw?.contentGaps || directRaw?.content_gaps) || analysis.contentGaps;
          analysis.actionableInsights = normalizeList(directRaw?.actionableInsights || directRaw?.actionable_insights) || analysis.actionableInsights;
          analysis.titleFormulas = normalizeList(directRaw?.titleFormulas || directRaw?.title_formulas) || analysis.titleFormulas;
          analysis.thumbnailStyle = directRaw?.thumbnailStyle || directRaw?.thumbnail_style || analysis.thumbnailStyle;
          analysis.engagementTactics = normalizeList(directRaw?.engagementTactics || directRaw?.engagement_tactics) || analysis.engagementTactics;
        }
      }
    }

    const { error: saveError } = await supabaseClient
      .from("competitor_analysis_results")
      .insert({
        user_id: userId,
        competitor_channel_url: competitorChannelUrl,
        analysis,
      });

    if (saveError) {
      console.error("Failed to save competitor analysis:", saveError);
    } else {
      console.log("Competitor analysis saved");
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
