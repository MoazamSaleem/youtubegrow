import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    const userId = claimsData.claims.sub;
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prompt = `Generate a compelling YouTube video script for the following:

Topic: ${topic}
Target Audience: ${targetAudience || "General YouTube viewers"}
Tone: ${tone || "Engaging and informative"}
Estimated Duration: ${duration || "8-10"} minutes
${includeHook ? "Include a strong hook in the first 10 seconds" : ""}
${includeCTA ? "Include call-to-action for likes, comments, and subscriptions" : ""}

Generate a complete script with the following structure:
1. Hook (first 10-15 seconds to grab attention)
2. Introduction (introduce yourself and the topic)
3. Main Content (broken into clear sections with timestamps)
4. Summary/Conclusion
5. Call to Action

Use the following JSON format:
{
  "title": "Suggested video title",
  "hook": "The attention-grabbing opening line",
  "introduction": "Brief intro section",
  "sections": [
    {
      "timestamp": "0:00",
      "title": "Section title",
      "content": "Section script content",
      "notes": "Optional director notes or suggestions"
    }
  ],
  "conclusion": "Closing remarks",
  "callToAction": "CTA script",
  "estimatedDuration": "X:XX",
  "tips": ["Tip 1", "Tip 2"]
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
          { role: "system", content: "You are an expert YouTube scriptwriter who creates engaging, well-structured video scripts that maximize viewer retention and engagement. Always respond with valid JSON." },
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
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to generate script" }), {
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
      throw new Error("Failed to parse script response");
    }
    
    const script = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ script }), {
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
