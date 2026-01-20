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
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      console.error('Auth error:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.user.id;
    console.log('Authenticated user:', userId);

    const { channelId, channelName, subscriberCount, viewCount, videoCount, niche, goals } = await req.json();
    
    // Input validation
    if (!channelName || typeof channelName !== 'string') {
      return new Response(JSON.stringify({ error: "Channel name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check and deduct credits (channel analysis is extensive)
    const creditCheck = await checkAndDeductCredits(userId, "analyze-channel", "extensive");
    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ANALYSIS_AI_API = Deno.env.get("ANALYSIS_AI_API");
    const ANALYSIS_PROMPT_ID = "pmpt_696fc5616c588197b7b38f535142620800476e9ce7c84153";

    if (!ANALYSIS_AI_API) {
      console.error("ANALYSIS_AI_API is not configured");
      await refundCredits(userId, creditCheck.cost!, "AI service not configured - refund");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update usage tracking
    const today = new Date().toISOString().split("T")[0];
    await supabaseClient.from("usage_tracking").upsert(
      {
        user_id: userId,
        date: today,
        channel_analyses: 1,
      },
      { onConflict: "user_id,date" }
    );

    const prompt = `Perform a comprehensive strategic analysis for my YouTube channel.

Channel Details:
- Channel Name: ${channelName}
- Subscribers: ${subscriberCount?.toLocaleString() || 'Unknown'}
- Total Views: ${viewCount?.toLocaleString() || 'Unknown'}
- Video Count: ${videoCount || 'Unknown'}
${niche ? `- Niche: ${niche}` : ''}
${goals ? `- Growth Goals: ${goals}` : ''}

Based on these metrics and general YouTube best practices, provide a detailed strategic analysis in the following JSON format:
{
  "overallHealth": {
    "score": 75,
    "grade": "B+",
    "summary": "Brief overall assessment"
  },
  "metrics": {
    "subscriberGrowthPotential": "High/Medium/Low",
    "viewsPerVideoAverage": "Based on total views / video count",
    "engagementEstimate": "Estimated engagement level",
    "contentConsistency": "Assessment based on video count"
  },
  "strengths": [
    {
      "area": "Strength area",
      "description": "Why this is strong",
      "tips": "How to leverage this more"
    }
  ],
  "improvements": [
    {
      "area": "Area to improve",
      "priority": "High/Medium/Low",
      "currentState": "What's happening now",
      "recommendation": "Specific action to take",
      "expectedImpact": "What improvement to expect"
    }
  ],
  "contentStrategy": {
    "recommendedUploadFrequency": "How often to post",
    "optimalVideoLength": "Suggested duration",
    "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
    "trendingTopics": ["Topic 1", "Topic 2", "Topic 3"],
    "titleFormulas": ["Formula 1", "Formula 2"]
  },
  "audienceInsights": {
    "likelyDemographic": "Estimated audience",
    "peakPostingTimes": "When to post",
    "engagementTactics": ["Tactic 1", "Tactic 2"]
  },
  "growthOpportunities": [
    {
      "opportunity": "Growth opportunity",
      "difficulty": "Easy/Medium/Hard",
      "timeline": "Short-term/Medium-term/Long-term",
      "howToExecute": "Steps to take"
    }
  ],
  "nextSteps": [
    {
      "step": "Action item",
      "priority": 1,
      "description": "What to do"
    }
  ],
  "monetizationReadiness": {
    "status": "Ready/Almost Ready/Not Yet",
    "requirements": "What's needed",
    "suggestions": ["Monetization tips"]
  }
}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ANALYSIS_AI_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: ANALYSIS_PROMPT_ID,
        input: prompt,
        response_format: { type: "json_object" },
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
      return new Response(JSON.stringify({ error: "Failed to analyze channel" }), {
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
      throw new Error("Failed to parse analysis response");
    }
    
    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ analysis, creditsUsed: creditCheck.cost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Channel analysis error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
