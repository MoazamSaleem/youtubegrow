import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-FREE-TRIAL-ELIGIBILITY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { email } = await req.json();
    if (!email) {
      throw new Error("Email is required");
    }
    logStep("Checking eligibility for", { email });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if this email has any existing profile
    const { data: existingProfile } = await supabaseClient
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      // User exists - check if they've used the free trial
      const { data: subscription } = await supabaseClient
        .from("subscriptions")
        .select("has_used_free_trial, trial_ends_at, status")
        .eq("user_id", existingProfile.user_id)
        .maybeSingle();

      if (subscription?.has_used_free_trial) {
        logStep("User has already used free trial", { email });
        return new Response(JSON.stringify({ 
          eligible: false, 
          reason: "already_used",
          message: "You've already used your free trial. Please choose a paid plan."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // New user or user hasn't used trial yet
    logStep("User is eligible for free trial", { email });
    return new Response(JSON.stringify({ 
      eligible: true 
    }), {
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
