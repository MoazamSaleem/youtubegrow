import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competitorChannel, niche, yourChannelInfo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!competitorChannel) {
      return new Response(JSON.stringify({ error: "Competitor channel name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert YouTube strategy consultant specializing in competitive analysis. You provide actionable insights based on publicly observable patterns and strategies. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
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
