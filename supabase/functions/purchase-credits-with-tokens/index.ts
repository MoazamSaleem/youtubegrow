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

    const { packageId } = await req.json();
    if (!packageId) {
      return new Response(JSON.stringify({ error: "Missing packageId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: pkg, error: pkgError } = await supabase
      .from("credit_packages")
      .select("id, name, credits_amount, token_cost, bonus_percentage, is_active")
      .eq("id", packageId)
      .maybeSingle();

    if (pkgError || !pkg || !pkg.is_active) {
      return new Response(JSON.stringify({ error: "Package not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pkg.token_cost || pkg.token_cost <= 0) {
      return new Response(JSON.stringify({ error: "This package cannot be purchased with tokens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokens } = await supabase
      .from("user_tokens")
      .select("balance, ai_credits_balance, total_spent")
      .eq("user_id", userId)
      .maybeSingle();

    const currentBalance = tokens?.balance ?? 0;
    if (currentBalance < pkg.token_cost) {
      return new Response(JSON.stringify({ error: "Insufficient tokens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bonusCredits = Math.floor((pkg.credits_amount * (pkg.bonus_percentage || 0)) / 100);
    const totalCredits = pkg.credits_amount + bonusCredits;
    const newTokenBalance = currentBalance - pkg.token_cost;
    const newCreditsBalance = (tokens?.ai_credits_balance ?? 0) + totalCredits;
    const newTotalSpent = (tokens?.total_spent ?? 0) + pkg.token_cost;
    const now = new Date().toISOString();

    await supabase
      .from("user_tokens")
      .upsert({
        user_id: userId,
        balance: newTokenBalance,
        ai_credits_balance: newCreditsBalance,
        total_spent: newTotalSpent,
        updated_at: now,
      });

    await supabase.from("credits_purchases").insert({
      user_id: userId,
      package_id: pkg.id,
      credits_amount: totalCredits,
      payment_method: "tokens",
      tokens_spent: pkg.token_cost,
    });

    await supabase.from("credits_history").insert({
      user_id: userId,
      amount: totalCredits,
      type: "purchase",
      description: `Purchased ${pkg.name} with tokens`,
      balance_after: newCreditsBalance,
    });

    return new Response(
      JSON.stringify({
        success: true,
        creditsAdded: totalCredits,
        tokenBalance: newTokenBalance,
        creditsBalance: newCreditsBalance,
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
