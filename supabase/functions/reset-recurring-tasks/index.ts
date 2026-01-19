import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[RESET-RECURRING-TASKS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started - cleaning up old recurring task completions");

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get start of current week (Sunday)
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Delete expired daily completions (older than today)
    const { data: deletedData, error: deleteError } = await supabaseClient
      .from("recurring_task_completions")
      .delete()
      .lt("period_start", today)
      .select();

    const dailyDeleted = deletedData?.length || 0;

    logStep("Cleaned up expired completions", { dailyDeleted });

    // Get users who have recurring tasks available today
    const { data: usersWithTokens } = await supabaseClient
      .from("user_tokens")
      .select("user_id")
      .gt("current_xp", 0);

    logStep("Found active users", { count: usersWithTokens?.length || 0 });

    // Award badges for task completion milestones
    const { data: taskCounts } = await supabaseClient
      .from("user_task_progress")
      .select("user_id")
      .not("completed_at", "is", null);

    if (taskCounts) {
      // Group by user_id to count completions
      const userTaskCounts: Record<string, number> = {};
      taskCounts.forEach((row: any) => {
        userTaskCounts[row.user_id] = (userTaskCounts[row.user_id] || 0) + 1;
      });

      // Find Task Master badge
      const { data: taskMasterBadge } = await supabaseClient
        .from("badges")
        .select("id")
        .eq("name", "Task Master")
        .single();

      if (taskMasterBadge) {
        // Award badge to users with 50+ completed tasks
        for (const [userId, count] of Object.entries(userTaskCounts)) {
          if (count >= 50) {
            // Check if already has badge
            const { data: existing } = await supabaseClient
              .from("user_badges")
              .select("id")
              .eq("user_id", userId)
              .eq("badge_id", taskMasterBadge.id)
              .maybeSingle();

            if (!existing) {
              await supabaseClient.from("user_badges").insert({
                user_id: userId,
                badge_id: taskMasterBadge.id,
              });
              logStep("Awarded Task Master badge", { userId });
            }
          }
        }
      }
    }

    // Award Token Collector badge (1000+ tokens earned)
    const { data: tokenCollectorBadge } = await supabaseClient
      .from("badges")
      .select("id")
      .eq("name", "Token Collector")
      .single();

    if (tokenCollectorBadge) {
      const { data: highEarners } = await supabaseClient
        .from("user_tokens")
        .select("user_id")
        .gte("total_earned", 1000);

      if (highEarners) {
        for (const user of highEarners) {
          const { data: existing } = await supabaseClient
            .from("user_badges")
            .select("id")
            .eq("user_id", user.user_id)
            .eq("badge_id", tokenCollectorBadge.id)
            .maybeSingle();

          if (!existing) {
            await supabaseClient.from("user_badges").insert({
              user_id: user.user_id,
              badge_id: tokenCollectorBadge.id,
            });
            logStep("Awarded Token Collector badge", { userId: user.user_id });
          }
        }
      }
    }

    // Award badges based on milestones
    const { data: milestones } = await supabaseClient
      .from("milestones")
      .select("id, required_xp");

    const { data: badges } = await supabaseClient
      .from("badges")
      .select("id, milestone_id")
      .not("milestone_id", "is", null);

    if (milestones && badges && usersWithTokens) {
      for (const user of usersWithTokens) {
        const { data: userTokenData } = await supabaseClient
          .from("user_tokens")
          .select("current_xp")
          .eq("user_id", user.user_id)
          .single();

        if (!userTokenData) continue;

        for (const milestone of milestones) {
          if (userTokenData.current_xp >= milestone.required_xp) {
            const badge = badges.find((b: any) => b.milestone_id === milestone.id);
            if (!badge) continue;

            // Check if user already has milestone unlocked
            const { data: milestoneUnlocked } = await supabaseClient
              .from("user_milestones")
              .select("id")
              .eq("user_id", user.user_id)
              .eq("milestone_id", milestone.id)
              .maybeSingle();

            if (milestoneUnlocked) {
              // Award badge if not already awarded
              const { data: existing } = await supabaseClient
                .from("user_badges")
                .select("id")
                .eq("user_id", user.user_id)
                .eq("badge_id", badge.id)
                .maybeSingle();

              if (!existing) {
                await supabaseClient.from("user_badges").insert({
                  user_id: user.user_id,
                  badge_id: badge.id,
                });
                logStep("Awarded milestone badge", { userId: user.user_id, badgeId: badge.id });
              }
            }
          }
        }
      }
    }

    logStep("Task reset and badge check complete");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Recurring tasks reset and badges checked",
        cleanedUp: dailyDeleted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
