import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAndDeductCredits, refundCredits } from "../_shared/credits.ts";
import { requireMinimumPlan } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_CHAT_PROMPT_ID = "pmpt_69cebdfa48008193809dc3d80f91cdc808154296f967624c";
const AI_CHAT_PROMPT_VERSION = "1";

const extractOutputText = (data: any) => {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const content = data?.output
    ?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) =>
      item.content?.map((part) => (part.type === "output_text" ? part.text : undefined))
    )
    .filter(Boolean)
    .join("");

  return typeof content === "string" && content.trim() ? content.trim() : null;
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

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.error("Auth error:", userError?.message || userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = userData.user.id;
    console.log('Authenticated user:', userId);

    const accessResponse = await requireMinimumPlan({
      supabaseClient,
      userId,
      minimumPlan: "pro",
      corsHeaders,
      message: "AI YouTube Strategist requires an active Pro or Advanced subscription.",
    });
    if (accessResponse) {
      return accessResponse;
    }

    const { messages, channelContext } = await req.json();
    
    // Input validation
    if (!messages || !Array.isArray(messages) || messages.length > 50) {
      return new Response(JSON.stringify({ error: 'Invalid messages: max 50 messages allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    for (const msg of messages) {
      if (!msg.content || typeof msg.content !== 'string' || msg.content.length > 10000) {
        return new Response(JSON.stringify({ error: 'Message too long: max 10000 chars per message' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (msg.role && !['user', 'assistant', 'system'].includes(msg.role)) {
        return new Response(JSON.stringify({ error: 'Invalid message role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Determine complexity based on message length
    const totalLength = messages.reduce((acc: number, msg: any) => acc + (msg.content?.length || 0), 0);
    const complexity = totalLength > 2000 ? "extensive" : totalLength > 500 ? "standard" : "basic";

    // Check and deduct credits
    const creditCheck = await checkAndDeductCredits(userId, "ai-chat", complexity);
    if (!creditCheck.success) {
      return new Response(JSON.stringify({ error: creditCheck.error }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? Deno.env.get("ANALYSIS_AI_API");
    
    if (!OPENAI_API_KEY) {
      console.error("Neither OPENAI_API_KEY nor ANALYSIS_AI_API is configured");
      // Refund credits if API not configured
      await refundCredits(userId, creditCheck.cost!, "AI service not configured - refund");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serializedMessages = messages
      .map((msg: { role?: string; content?: string }, index: number) => {
        const role = msg.role || "user";
        return `${index + 1}. ${role.toUpperCase()}: ${msg.content ?? ""}`;
      })
      .join("\n\n");

    const contextBlock = channelContext
      ? [
          `Channel Name: ${channelContext.channelName || "Not specified"}`,
          `Niche: ${channelContext.niche || "General"}`,
          `Subscribers: ${channelContext.subscribers || "Not specified"}`,
          `Main Topics: ${channelContext.topics || "Various"}`,
        ].join("\n")
      : "No channel context provided.";

    const input = [
      "You are continuing an AI chat session for a YouTube creator.",
      `Channel Context:\n${contextBlock}`,
      `Conversation:\n${serializedMessages}`,
      "Respond to the latest user message with practical, concise YouTube growth advice.",
    ].join("\n\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: {
          id: AI_CHAT_PROMPT_ID,
          version: AI_CHAT_PROMPT_VERSION,
        },
        input,
      }),
    });

    if (!response.ok) {
      // Refund credits on API error
      await refundCredits(userId, creditCheck.cost!, "OpenAI API error - refund");
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402 || response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({ error: "AI API key error. Please check your OpenAI API key." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = extractOutputText(data);

    if (!content) {
      await refundCredits(userId, creditCheck.cost!, "Empty AI chat response - refund");
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
