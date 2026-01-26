import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeList = (value: unknown) => (Array.isArray(value) ? value : []);

const clampDifficulty = (v: unknown) => {
  const s = String(v ?? "").toLowerCase();
  if (s === "easy" || s === "medium" || s === "hard") return s;
  return "medium";
};

const TASK_SCHEMA = {
  name: "growth_tasks_payload",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["tasks"],
    properties: {
      tasks: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "description",
            "category",
            "difficulty",
            "token_reward",
            "xp_reward",
            "verification_metric",
            "verification_operator",
            "verification_threshold",
            "verification_window_days",
          ],
          properties: {
            title: { type: "string", minLength: 1 },
            description: { type: "string" },
            category: { type: "string" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            token_reward: { type: "number" },
            xp_reward: { type: "number" },
            verification_metric: {
              type: "string",
              enum: [
                "subscribers",
                "videos",
                "views_total",
                "views_28d",
                "watch_minutes_365",
                "avg_view_duration_28d",
                "subscribers_gained_28d",
                "uploads_30d",
              ],
            },
            verification_operator: { type: "string", enum: [">="] },
            verification_threshold: { type: "number" },
            verification_window_days: { type: "number" },
          },
        },
      },
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { stepIndex } = await req.json().catch(() => ({}));

    const ANALYSIS_AI_API = Deno.env.get("ANALYSIS_AI_API");
    const PROMPT_ID = "pmpt_6977aa6904b08194bf630968a149cbc503b792e30340b804";

    if (!ANALYSIS_AI_API) {
      console.error("ANALYSIS_AI_API is not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: channelAnalysis } = await supabaseClient
      .from("channel_analysis_results")
      .select("analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: competitorAnalyses } = await supabaseClient
      .from("competitor_analysis_results")
      .select("analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const channelText = channelAnalysis?.analysis
      ? JSON.stringify(channelAnalysis.analysis).slice(0, 6000)
      : "";
    const competitorText = competitorAnalyses?.length
      ? JSON.stringify(competitorAnalyses.map((item) => item.analysis)).slice(0, 6000)
      : "";

    const promptInput = [
      stepIndex ? `Step: ${stepIndex}` : undefined,
      "Return ONLY JSON matching the schema. Do not include commentary.",
      "Only create tasks that are verifiable via YouTube API metrics.",
      "Allowed metrics: subscribers, videos, views_total, views_28d, watch_minutes_365, avg_view_duration_28d, subscribers_gained_28d, uploads_30d.",
      "Return each task with fields: title, description, category, difficulty, token_reward, xp_reward, verification_metric, verification_operator, verification_threshold, verification_window_days.",
      "Each task must be realistically achievable and measurable within verification_window_days.",
      channelText ? `Channel analysis: ${channelText}` : "Channel analysis: (not provided)",
      competitorText ? `Competitor analysis: ${competitorText}` : "Competitor analysis: (not provided)",
    ]
      .filter(Boolean)
      .join("\n");

    const callAI = async (input: string) => {
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANALYSIS_AI_API}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Use a structured-output capable model
          model: "gpt-4o-mini-2024-07-18",
          prompt: { id: PROMPT_ID },
          input,
          // Force strict JSON that matches schema (prevents parse errors + empty task arrays)
          response_format: { type: "json_schema", json_schema: TASK_SCHEMA },
        }),
      });

      if (!r.ok) {
        const errorText = await r.text();
        console.error("Growth task AI error:", r.status, errorText);
        throw new Error("Failed to generate growth tasks");
      }
      return await r.json();
    };

    const extractContentText = (data: any) => {
      // Most common
      if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;

      // Responses API output blocks
      const fromBlocks =
        data?.output
          ?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) =>
            item.content?.map((part) => (part.type === "output_text" ? part.text : undefined))
          )
          .find(Boolean) ?? null;

      if (typeof fromBlocks === "string" && fromBlocks.trim()) return fromBlocks;

      // Some variants return content[].text directly
      const alt =
        data?.output
          ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content?.map((p) => p.text))
          .find((t: any) => typeof t === "string" && t.trim()) ?? null;

      if (typeof alt === "string" && alt.trim()) return alt;

      return "";
    };

    const parsePayload = (text: string) => {
      // With response_format json_schema strict, this should always succeed.
      // Still keep a few fallbacks for safety.
      try {
        return JSON.parse(text);
      } catch {
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch?.[0]) return JSON.parse(objectMatch[0]);
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch?.[0]) return JSON.parse(arrayMatch[0]);
        throw new Error("Failed to parse growth tasks response");
      }
    };

    let parsed: any;

    // First attempt (structured outputs)
    try {
      const aiData = await callAI(promptInput);
      const content = extractContentText(aiData);
      if (!content) throw new Error("No content received from AI");
      parsed = parsePayload(content);
    } catch (error) {
      // Retry with an even stricter prompt (still using structured outputs)
      const retryPrompt = [
        "You must return ONLY valid JSON and MUST include at least 5 tasks.",
        "No prose. No markdown. No code fences. No extra keys.",
        promptInput,
      ].join("\n\n");

      const retryData = await callAI(retryPrompt);
      const retryContent = extractContentText(retryData);
      if (!retryContent) throw error;
      parsed = parsePayload(retryContent);
    }

    const rawTasks = normalizeList(parsed?.tasks ?? parsed?.growthTasks ?? parsed);
    if (rawTasks.length === 0) {
      throw new Error("No tasks returned by AI");
    }

    const { data: lastSet } = await supabaseClient
      .from("user_growth_task_sets")
      .select("id, step_index")
      .eq("user_id", userId)
      .order("step_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextStepIndex = stepIndex ?? (lastSet?.step_index ? lastSet.step_index + 1 : 1);

    const { data: newSet, error: setError } = await supabaseClient
      .from("user_growth_task_sets")
      .insert({ user_id: userId, step_index: nextStepIndex })
      .select()
      .single();

    if (setError || !newSet) {
      console.error("Failed to create growth task set:", setError);
      return new Response(JSON.stringify({ error: "Failed to save growth tasks" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inferMetric = (title: string) => {
      const lower = title.toLowerCase();
      const numberMatch = lower.match(/(\d+([,.]\d+)?)/);
      const value = numberMatch ? Number(numberMatch[1].replace(/,/g, "")) : undefined;

      if (lower.includes("subscriber")) return { metric: "subscribers", threshold: value ?? 100 };
      if (lower.includes("video")) return { metric: "videos", threshold: value ?? 1 };
      if (lower.includes("watch hour")) return { metric: "watch_minutes_365", threshold: value ? value * 60 : 600 };
      if (lower.includes("avg view") || lower.includes("average view") || lower.includes("duration"))
        return { metric: "avg_view_duration_28d", threshold: value ?? 30 };
      if (lower.includes("subscribers gained") || lower.includes("gained"))
        return { metric: "subscribers_gained_28d", threshold: value ?? 25 };
      if (lower.includes("upload")) return { metric: "uploads_30d", threshold: value ?? 2 };
      if (lower.includes("view")) return { metric: "views_28d", threshold: value ?? 1000 };

      return { metric: "views_28d", threshold: 500 };
    };

    const tasksToInsert = rawTasks.map((task: any, index: number) => {
      const title = String(task.title ?? task.name ?? `Growth Task ${index + 1}`);
      const inferred = inferMetric(title);

      // Ensure window days always has a default (prevents null downstream)
      const windowDays = Number(task.verification_window_days ?? task.window_days ?? 28);

      return {
        user_id: userId,
        task_set_id: newSet.id,
        title,
        description: task.description ? String(task.description) : null,
        category: String(task.category ?? "growth"),
        difficulty: clampDifficulty(task.difficulty),
        token_reward: Number(task.token_reward ?? task.tokenReward ?? 15),
        xp_reward: Number(task.xp_reward ?? task.xpReward ?? 50),
        order_index: Number(task.order_index ?? task.orderIndex ?? index + 1),
        verification_metric: String(task.verification_metric ?? task.metric ?? inferred.metric),
        verification_operator: String(task.verification_operator ?? task.operator ?? ">="),
        verification_threshold: Number(task.verification_threshold ?? task.threshold ?? inferred.threshold),
        verification_window_days: windowDays,
      };
    });

    const { error: taskError } = await supabaseClient.from("user_growth_tasks").insert(tasksToInsert);
    if (taskError) {
      console.error("Failed to save growth tasks:", taskError);
      return new Response(JSON.stringify({ error: "Failed to save growth tasks" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        taskSetId: newSet.id,
        stepIndex: newSet.step_index,
        tasks: tasksToInsert,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate growth tasks error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
