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
    const { query, niche, count = 10 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a YouTube SEO expert specializing in keyword research. Your job is to analyze search queries and suggest related keywords that can help videos rank better and get discovered.

Guidelines:
- Suggest keywords with varying search volumes and competition levels
- Include long-tail keywords that are easier to rank for
- Consider trending topics and seasonal variations
- Provide actionable insights for each keyword
- Focus on keywords that indicate viewer intent`;

    const userPrompt = `Research YouTube keywords related to: "${query}"
${niche ? `Channel Niche: ${niche}` : ""}

Please analyze and provide ${count} keyword suggestions with the following for each:
1. The keyword/phrase
2. Estimated search volume (low, medium, high)
3. Competition level (low, medium, high)
4. Relevance score (1-10)
5. Suggested use (title, tags, description)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "research_keywords",
              description: "Return keyword research results",
              parameters: {
                type: "object",
                properties: {
                  keywords: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        keyword: { type: "string" },
                        searchVolume: { type: "string", enum: ["low", "medium", "high"] },
                        competition: { type: "string", enum: ["low", "medium", "high"] },
                        relevance: { type: "number" },
                        suggestedUse: { type: "string" },
                      },
                      required: ["keyword", "searchVolume", "competition", "relevance", "suggestedUse"],
                    },
                  },
                  summary: { type: "string" },
                },
                required: ["keywords", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "research_keywords" } },
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
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to research keywords");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const keywords = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(keywords), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid response from AI");
  } catch (error) {
    console.error("Error in research-keywords:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
