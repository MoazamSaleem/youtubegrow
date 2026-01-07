import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[PURCHASE-CREDITS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { packageId } = await req.json();
    if (!packageId) throw new Error("Package ID is required");
    logStep("Package ID received", { packageId });

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { email: user.email });

    // Fetch package details
    const { data: pkg, error: pkgError } = await supabaseClient
      .from("credit_packages")
      .select("*")
      .eq("id", packageId)
      .single();

    if (pkgError || !pkg) throw new Error("Package not found");
    logStep("Package found", { name: pkg.name, credits: pkg.credits_amount, price: pkg.price_usd });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create or get price
    let priceId = pkg.stripe_price_id;
    if (!priceId) {
      // Create a one-time price
      const price = await stripe.prices.create({
        unit_amount: Math.round(pkg.price_usd * 100),
        currency: "usd",
        product_data: {
          name: `${pkg.name} - ${pkg.credits_amount} AI Credits`,
        },
      });
      priceId = price.id;

      // Update package with stripe price id
      await supabaseClient
        .from("credit_packages")
        .update({ stripe_price_id: priceId })
        .eq("id", packageId);
    }

    const bonusCredits = Math.floor((pkg.credits_amount * pkg.bonus_percentage) / 100);
    const totalCredits = pkg.credits_amount + bonusCredits;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/dashboard/credits?purchase=success&credits=${totalCredits}`,
      cancel_url: `${req.headers.get("origin")}/dashboard/credits?purchase=cancelled`,
      metadata: {
        user_id: user.id,
        package_id: packageId,
        credits_amount: totalCredits.toString(),
      },
    });
    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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
