import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-TRIAL-EXPIRATION] ${step}${detailsStr}`);
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

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resend = resendApiKey ? new Resend(resendApiKey) : null;

  try {
    logStep("Function started");

    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Find trialing subscriptions that are about to expire (within 3 or 7 days)
    const { data: expiringTrials, error: fetchError } = await supabaseClient
      .from("subscriptions")
      .select(`
        *,
        profiles!subscriptions_user_id_fkey (email, full_name)
      `)
      .eq("status", "trialing")
      .lte("trial_ends_at", sevenDaysFromNow.toISOString())
      .gt("trial_ends_at", now.toISOString());

    if (fetchError) {
      logStep("Error fetching expiring trials", { error: fetchError.message });
      throw fetchError;
    }

    logStep("Found expiring trials", { count: expiringTrials?.length || 0 });

    // Find expired trials that need to be downgraded
    const { data: expiredTrials, error: expiredError } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("status", "trialing")
      .lte("trial_ends_at", now.toISOString());

    if (expiredError) {
      logStep("Error fetching expired trials", { error: expiredError.message });
    }

    // Downgrade expired trials
    if (expiredTrials && expiredTrials.length > 0) {
      logStep("Downgrading expired trials", { count: expiredTrials.length });

      for (const trial of expiredTrials) {
        const { error: updateError } = await supabaseClient
          .from("subscriptions")
          .update({
            status: "expired",
            plan: "free",
            updated_at: now.toISOString(),
          })
          .eq("id", trial.id);

        if (updateError) {
          logStep("Error downgrading trial", { userId: trial.user_id, error: updateError.message });
        } else {
          logStep("Trial downgraded", { userId: trial.user_id });
        }
      }
    }

    // Send reminder emails for expiring trials
    const emailsSent = [];
    const emailErrors = [];

    if (resend && expiringTrials && expiringTrials.length > 0) {
      for (const trial of expiringTrials) {
        const profile = trial.profiles;
        const email = profile?.email;
        const name = profile?.full_name || "there";
        const trialEndsAt = new Date(trial.trial_ends_at);
        const daysLeft = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (!email) {
          logStep("No email for user", { userId: trial.user_id });
          continue;
        }

        // Only send at 7 days and 3 days
        if (daysLeft !== 7 && daysLeft !== 3 && daysLeft !== 1) {
          continue;
        }

        try {
          const { data: emailResult, error: emailError } = await resend.emails.send({
            from: "YouTube Growth Planner <noreply@resend.dev>",
            to: [email],
            subject: daysLeft === 1 
              ? "⚠️ Your YouTube Growth Planner trial expires tomorrow!" 
              : `Your YouTube Growth Planner trial expires in ${daysLeft} days`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #6366f1;">Hi ${name}! 👋</h1>
                
                <p>Your free trial of YouTube Growth Planner ${daysLeft === 1 ? "expires <strong>tomorrow</strong>" : `expires in <strong>${daysLeft} days</strong>`}!</p>
                
                <p>Don't lose access to:</p>
                <ul>
                  <li>🔍 Keyword Research Tools</li>
                  <li>💡 AI Topic Ideas</li>
                  <li>📊 Channel Analytics</li>
                  <li>🤖 AI Strategist</li>
                </ul>
                
                <p style="margin: 20px 0;">
                  <a href="https://tubegrow.lovable.app/dashboard/billing" 
                     style="background: linear-gradient(135deg, #6366f1, #8b5cf6); 
                            color: white; 
                            padding: 12px 24px; 
                            text-decoration: none; 
                            border-radius: 8px;
                            display: inline-block;">
                    Upgrade Now →
                  </a>
                </p>
                
                <p style="color: #666;">
                  Upgrade to any paid plan and get up to 25,000 AI credits!
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                
                <p style="color: #999; font-size: 12px;">
                  You're receiving this because you signed up for a YouTube Growth Planner free trial.
                </p>
              </div>
            `,
          });

          if (emailError) {
            emailErrors.push({ userId: trial.user_id, email, error: emailError });
            logStep("Email error", { userId: trial.user_id, error: emailError });
          } else {
            emailsSent.push({ userId: trial.user_id, email, daysLeft });
            logStep("Email sent", { userId: trial.user_id, email, daysLeft });
          }
        } catch (err) {
          emailErrors.push({ userId: trial.user_id, email, error: err });
          logStep("Email exception", { userId: trial.user_id, error: String(err) });
        }
      }
    } else if (!resend) {
      logStep("Resend not configured - skipping emails");
    }

    return new Response(JSON.stringify({
      success: true,
      expiredDowngraded: expiredTrials?.length || 0,
      expiringFound: expiringTrials?.length || 0,
      emailsSent: emailsSent.length,
      emailErrors: emailErrors.length,
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
