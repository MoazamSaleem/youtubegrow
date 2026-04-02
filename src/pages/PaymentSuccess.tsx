import { useEffect, useState, useCallback } from "react";
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
  Loader2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session, refreshSubscription, subscription } = useAuth();
  const [checking, setChecking] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [planName, setPlanName] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [syncAttempts, setSyncAttempts] = useState(0);

  const needsEmailConfirmation = searchParams.get("confirm") === "1";

  const syncSubscription = useCallback(async () => {
    if (!user || !session) return false;
    
    setSyncing(true);
    try {
      // Call check-subscription to sync from Stripe
      await refreshSubscription();
      
      // Fetch the updated subscription from DB
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (subData?.plan && subData.plan !== "free" && subData.status === "active") {
        setPlanName(subData.plan.charAt(0).toUpperCase() + subData.plan.slice(1));
        setSyncing(false);
        return true;
      }
      
      // Check pending status - payment may still be processing
      if (subData?.status === "pending") {
        console.log("Subscription still pending, will retry...");
      }
      
      setSyncing(false);
      return false;
    } catch (error) {
      console.error("Error syncing subscription:", error);
      setSyncing(false);
      return false;
    }
  }, [user, session, refreshSubscription]);

  useEffect(() => {
    const checkStatus = async () => {
      // Wait for auth to be ready
      if (!user) {
        // Check if we have a session that needs refresh
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          setChecking(false);
          return;
        }
      }
      
      if (user && session) {
        const isConfirmed = !!user.email_confirmed_at;
        setEmailConfirmed(isConfirmed);
        
        if (isConfirmed) {
          // Email is confirmed, sync subscription from Stripe
          const synced = await syncSubscription();
          
          // If not synced yet, try a few more times with delay
          if (!synced && syncAttempts < 3) {
            setTimeout(() => {
              setSyncAttempts(prev => prev + 1);
            }, 2000);
          }
        } else {
          // Get plan name from pending subscription
          const { data: subData } = await supabase
            .from("subscriptions")
            .select("plan")
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (subData?.plan && subData.plan !== "free") {
            setPlanName(subData.plan.charAt(0).toUpperCase() + subData.plan.slice(1));
          }
        }
      }
      setChecking(false);
    };

    checkStatus();
  }, [user, session, syncSubscription, syncAttempts]);

  // Retry sync when syncAttempts changes
  useEffect(() => {
    if (syncAttempts > 0 && syncAttempts < 3 && emailConfirmed && user) {
      syncSubscription();
    }
  }, [syncAttempts, emailConfirmed, user, syncSubscription]);

  // Auto-redirect if email is confirmed and subscription is active
  useEffect(() => {
    if (!checking && emailConfirmed && user && subscription?.status === "active") {
      const timer = setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [checking, emailConfirmed, user, subscription, navigate]);

  const handleManualSync = async () => {
    const synced = await syncSubscription();
    if (synced) {
      toast.success("Subscription activated successfully!");
    } else {
      toast.info("Still processing... Please wait a moment and try again.");
    }
  };

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
          <span className="font-display font-bold text-xl sm:text-2xl leading-tight">
            YouTube <span className="gradient-text">Growth Planner</span>
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
                      const { error } = await supabase.auth.resend({
                        type: 'signup',
                        email: user.email,
                        options: {
                          emailRedirectTo: `${window.location.origin}/payment-success`,
                        }
                      });
                      if (error) {
                        toast.error("Failed to resend email. Please try again.");
                      } else {
                        toast.success("Confirmation email sent!");
                      }
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
              {subscription?.status === "active" ? (
                <>
                  <p className="text-muted-foreground mb-6">
                    Your account is ready! Redirecting to dashboard...
                  </p>
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Redirecting...</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-6">
                    {syncing 
                      ? "Activating your subscription..."
                      : "Click below to activate your subscription."}
                  </p>
                  
                  <div className="space-y-3">
                    <Button
                      variant="hero"
                      size="lg"
                      onClick={handleManualSync}
                      disabled={syncing}
                      className="w-full"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Activating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-5 w-5" />
                          Activate Subscription
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => navigate("/dashboard")}
                      className="w-full"
                    >
                      Go to Dashboard
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help?{" "}
          <Link to="/contact" className="text-primary hover:underline">
            Contact Support
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
