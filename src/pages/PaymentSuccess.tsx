import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle, 
  Mail, 
  ArrowRight, 
  Youtube, 
  Sparkles,
  Loader2 
} from "lucide-react";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session, refreshSubscription } = useAuth();
  const [checking, setChecking] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [planName, setPlanName] = useState<string>("");

  const needsEmailConfirmation = searchParams.get("confirm") === "1";

  useEffect(() => {
    const checkStatus = async () => {
      // If user is logged in and has confirmed email
      if (user && session) {
        const isConfirmed = !!user.email_confirmed_at;
        setEmailConfirmed(isConfirmed);
        
        if (isConfirmed) {
          // Sync subscription from Stripe
          await refreshSubscription();
        }
        
        // Get plan name from subscription
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("plan")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (subData?.plan) {
          setPlanName(subData.plan.charAt(0).toUpperCase() + subData.plan.slice(1));
        }
      }
      setChecking(false);
    };

    checkStatus();
  }, [user, session, refreshSubscription]);

  // Auto-redirect if email is confirmed
  useEffect(() => {
    if (!checking && emailConfirmed && user) {
      const timer = setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [checking, emailConfirmed, user, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="relative">
            <Youtube className="h-10 w-10 text-primary" />
            <Sparkles className="h-4 w-4 text-accent absolute -top-1 -right-1" />
          </div>
          <span className="font-display font-bold text-2xl">
            Tube<span className="gradient-text">Grow</span>
          </span>
        </div>

        <div className="glass rounded-2xl p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>

          <h1 className="font-display text-2xl font-bold mb-2">
            Payment Successful!
          </h1>
          
          {planName && (
            <p className="text-muted-foreground mb-6">
              You've successfully subscribed to the <span className="text-primary font-semibold">{planName} Plan</span>
            </p>
          )}

          {needsEmailConfirmation && !emailConfirmed ? (
            <>
              {/* Email Confirmation Required */}
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-semibold text-lg mb-2">
                  Confirm Your Email
                </h2>
                <p className="text-sm text-muted-foreground">
                  We've sent a confirmation email to your inbox. Please click the link in the email to activate your account and access your subscription.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email? Check your spam folder or
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (user?.email) {
                      await supabase.auth.resend({
                        type: 'signup',
                        email: user.email,
                        options: {
                          emailRedirectTo: `${window.location.origin}/dashboard`,
                        }
                      });
                    }
                  }}
                >
                  Resend Confirmation Email
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <Link to="/signin">
                  <Button variant="ghost" className="text-muted-foreground">
                    Go to Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Email Confirmed or Not Required */}
              <p className="text-muted-foreground mb-6">
                {emailConfirmed 
                  ? "Your account is ready! Redirecting to dashboard..."
                  : "You can now access all features of your plan."}
              </p>

              {emailConfirmed ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Redirecting...</span>
                </div>
              ) : (
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => navigate("/dashboard")}
                  className="w-full"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help?{" "}
          <a href="mailto:support@tubegrow.com" className="text-primary hover:underline">
            Contact Support
          </a>
        </p>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
