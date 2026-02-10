import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_TRIAL_CREDITS = 100;

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

    const userId = authData.user.id;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : "ensure";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: existing } = await supabase
      .from("user_tokens")
      .select("id, user_id, ai_credits_balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const startingCredits = reason === "free_trial" ? FREE_TRIAL_CREDITS : 0;
      const { data: created, error: createError } = await supabase
        .from("user_tokens")
        .insert({
          user_id: userId,
          ai_credits_balance: startingCredits,
          balance: 0,
          total_earned: 0,
          total_spent: 0,
          current_xp: 0,
          ai_credits_used: 0,
        })
        .select()
        .single();

      if (createError) {
        return new Response(JSON.stringify({ error: "Failed to initialize tokens" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (startingCredits > 0) {
        await supabase.from("credits_history").insert({
          user_id: userId,
          amount: startingCredits,
          type: "subscription",
          description: "Free trial signup bonus",
          balance_after: startingCredits,
        });
      }

      return new Response(JSON.stringify({ tokens: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reason === "free_trial" && existing.ai_credits_balance === 0) {
      const { data: updated } = await supabase
        .from("user_tokens")
        .update({
          ai_credits_balance: FREE_TRIAL_CREDITS,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      await supabase.from("credits_history").insert({
        user_id: userId,
        amount: FREE_TRIAL_CREDITS,
        type: "subscription",
        description: "Free trial signup bonus",
        balance_after: FREE_TRIAL_CREDITS,
      });

      return new Response(JSON.stringify({ tokens: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ tokens: existing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
