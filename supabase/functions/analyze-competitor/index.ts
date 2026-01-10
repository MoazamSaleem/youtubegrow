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

    const { competitorChannel, niche, yourChannelInfo } = await req.json();
    
    // Input validation
    if (!competitorChannel || typeof competitorChannel !== 'string' || competitorChannel.length > 500) {
      return new Response(JSON.stringify({ error: "Competitor channel name is required (max 500 chars)" }), {
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      await refundCredits(userId, creditCheck.cost!, "AI service not configured - refund");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prompt = `Perform a strategic competitor analysis for a YouTube channel in the ${niche || "general content"} niche.

Competitor Channel to Analyze: ${competitorChannel}
${yourChannelInfo ? `My Channel Context: ${yourChannelInfo}` : ""}

Provide a comprehensive analysis in the following JSON format:
{
  "channelOverview": {
    "estimatedNiche": "Their specific niche",
    "contentStyle": "Description of their content approach",
    "targetAudience": "Who they're targeting",
    "uniqueSellingPoint": "What makes them stand out"
  },
  "contentStrategy": {
    "uploadFrequency": "How often they post",
    "videoFormats": ["Format 1", "Format 2"],
    "averageLength": "Typical video duration",
    "topPerformingTopics": ["Topic 1", "Topic 2", "Topic 3"]
  },
  "strengths": [
    {
      "area": "Strength area",
      "description": "Why this is effective",
      "howToAdapt": "How you can apply this"
    }
  ],
  "weaknesses": [
    {
      "area": "Weakness area",
      "description": "What's lacking",
      "yourOpportunity": "How you can capitalize"
    }
  ],
  "contentGaps": [
    {
      "topic": "Untapped topic",
      "potential": "Why this could work",
      "difficulty": "Easy/Medium/Hard"
    }
  ],
  "actionableInsights": [
    {
      "priority": "High/Medium/Low",
      "action": "Specific action to take",
      "expectedImpact": "What results to expect"
    }
  ],
  "titleFormulas": ["Title pattern they use successfully"],
  "thumbnailStyle": "Description of their thumbnail approach",
  "engagementTactics": ["How they engage their audience"]
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert YouTube strategy consultant specializing in competitive analysis. You provide actionable insights based on publicly observable patterns and strategies. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
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
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse analysis response");
    }
    
    const analysis = JSON.parse(jsonMatch[0]);

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
