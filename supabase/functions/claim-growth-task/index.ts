import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { taskId } = await req.json();
    if (!taskId) {
      return new Response(JSON.stringify({ error: "Missing taskId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: task, error: taskError } = await supabase
      .from("user_growth_tasks")
      .select("id, user_id, token_reward, xp_reward, verified_at, claimed_at")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();

    if (taskError || !task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!task.verified_at) {
      return new Response(JSON.stringify({ error: "Task not verified" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (task.claimed_at) {
      return new Response(JSON.stringify({ error: "Task already claimed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    const { data: tokens } = await supabase
      .from("user_tokens")
      .select("balance, total_earned, current_xp")
      .eq("user_id", userId)
      .maybeSingle();

    const currentBalance = tokens?.balance ?? 0;
    const currentEarned = tokens?.total_earned ?? 0;
    const currentXp = tokens?.current_xp ?? 0;

    const newBalance = currentBalance + (task.token_reward || 0);
    const newEarned = currentEarned + (task.token_reward || 0);
    const newXp = currentXp + (task.xp_reward || 0);

    await supabase
      .from("user_growth_tasks")
      .update({ claimed_at: now })
      .eq("id", taskId)
      .eq("user_id", userId);

    await supabase
      .from("user_tokens")
      .upsert({
        user_id: userId,
        balance: newBalance,
        total_earned: newEarned,
        current_xp: newXp,
        updated_at: now,
      });

    return new Response(
      JSON.stringify({
        success: true,
        balance: newBalance,
        total_earned: newEarned,
        current_xp: newXp,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
