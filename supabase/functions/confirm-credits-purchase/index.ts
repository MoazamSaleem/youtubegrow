import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[CONFIRM-CREDITS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId is required");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) throw new Error("Stripe is not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) throw new Error("Checkout session not found");
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "Payment not completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const metadata = session.metadata || {};
    const ownerId = metadata.user_id || "";
    const creditsAmount = Number(metadata.credits_amount || 0);
    const packageId = metadata.package_id || null;

    if (!ownerId || ownerId !== user.id) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    if (!Number.isFinite(creditsAmount) || creditsAmount <= 0) {
      throw new Error("Invalid credits amount");
    }

    const stripePaymentId = session.payment_intent?.toString() || session.id;

    // Idempotency: if already recorded, just return success
    const { data: existing } = await supabaseAdmin
      .from("credits_purchases")
      .select("id")
      .eq("stripe_payment_id", stripePaymentId)
      .maybeSingle();

    if (existing?.id) {
      return new Response(JSON.stringify({ success: true, alreadyProcessed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("user_tokens")
      .select("ai_credits_balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tokenError || !tokenData) throw new Error("User tokens not found");

    const newBalance = (tokenData.ai_credits_balance || 0) + creditsAmount;

    const { error: updateError } = await supabaseAdmin
      .from("user_tokens")
      .update({
        ai_credits_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    await supabaseAdmin.from("credits_purchases").insert({
      user_id: user.id,
      package_id: packageId,
      credits_amount: creditsAmount,
      payment_method: "stripe",
      stripe_payment_id: stripePaymentId,
      amount_usd: session.amount_total ? session.amount_total / 100 : null,
    });

    await supabaseAdmin.from("credits_history").insert({
      user_id: user.id,
      amount: creditsAmount,
      type: "purchase",
      description: "Purchased AI credits via Stripe",
      balance_after: newBalance,
      related_id: packageId || null,
    });

    logStep("Credits applied", { userId: user.id, creditsAmount });

    return new Response(JSON.stringify({ success: true, creditsAdded: creditsAmount, balance: newBalance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
