import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeList = (value: unknown) => (Array.isArray(value) ? value : []);

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
      ? JSON.stringify(channelAnalysis.analysis).slice(0, 3000)
      : "";
    const competitorText = competitorAnalyses?.length
      ? JSON.stringify(competitorAnalyses.map((item) => item.analysis)).slice(0, 3000)
      : "";

    const promptInput = [
      stepIndex ? `Step: ${stepIndex}` : undefined,
      "Only create tasks that are verifiable via YouTube API metrics.",
      "Allowed metrics: subscribers, videos, views_total, views_28d, watch_minutes_365, avg_view_duration_28d, subscribers_gained_28d, uploads_30d.",
      "Return each task with fields: title, description, category, difficulty, token_reward, xp_reward, verification_metric, verification_operator, verification_threshold, verification_window_days.",
      channelText ? `Channel analysis: ${channelText}` : undefined,
      competitorText ? `Competitor analysis: ${competitorText}` : undefined,
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
        prompt: { id: PROMPT_ID },
        input: promptInput,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Growth task AI error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to generate growth tasks" }), {
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

    const parsePayload = (text: string) => {
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
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch?.[0]) {
          return JSON.parse(arrayMatch[0]);
        }
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch?.[0]) {
          return JSON.parse(objectMatch[0]);
        }
        throw new Error("Failed to parse growth tasks response");
      }
    };

    const parsed = parsePayload(content);
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
      if (lower.includes("subscriber")) {
        return { metric: "subscribers", threshold: value ?? 100 };
      }
      if (lower.includes("video")) {
        return { metric: "videos", threshold: value ?? 5 };
      }
      if (lower.includes("watch hour")) {
        return { metric: "watch_minutes_365", threshold: value ? value * 60 : 600 };
      }
      if (lower.includes("view")) {
        return { metric: "views_28d", threshold: value ?? 1000 };
      }
      if (lower.includes("upload")) {
        return { metric: "uploads_30d", threshold: value ?? 2 };
      }
      return { metric: "views_28d", threshold: 500 };
    };

    const tasksToInsert = rawTasks.map((task: any, index: number) => {
      const inferred = inferMetric(String(task.title ?? task.name ?? ""));
      return {
        user_id: userId,
        task_set_id: newSet.id,
        title: String(task.title ?? task.name ?? `Growth Task ${index + 1}`),
        description: task.description ? String(task.description) : null,
        category: String(task.category ?? "growth"),
        difficulty: String(task.difficulty ?? "medium").toLowerCase(),
        token_reward: Number(task.token_reward ?? task.tokenReward ?? 15),
        xp_reward: Number(task.xp_reward ?? task.xpReward ?? 50),
        order_index: Number(task.order_index ?? task.orderIndex ?? index + 1),
        verification_metric: String(task.verification_metric ?? task.metric ?? inferred.metric),
        verification_operator: String(task.verification_operator ?? task.operator ?? ">="),
        verification_threshold: Number(task.verification_threshold ?? task.threshold ?? inferred.threshold),
        verification_window_days: task.verification_window_days
          ? Number(task.verification_window_days)
          : task.window_days
          ? Number(task.window_days)
          : null,
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
