import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PLAN_LIMITS, SubscriptionPlan } from "@/lib/planLimits";
import { STRIPE_PLANS } from "@/lib/stripeConfig";
import { 
  Youtube, 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ArrowRight,
  Check, 
  X,
  Crown, 
  Zap, 
  Star, 
  Rocket,
  Loader2
} from "lucide-react";
import { z } from "zod";

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  agreed: z.boolean().refine((val) => val === true, "You must agree to the terms"),
});

const planConfigs: { key: SubscriptionPlan; description: string; icon: typeof Star; color: string }[] = [
  { key: "free", description: "1 month trial - First time only", icon: Star, color: "from-slate-500 to-slate-600" },
  { key: "basic", description: "For growing creators", icon: Zap, color: "from-blue-500 to-blue-600" },
  { key: "pro", description: "Most popular choice", icon: Crown, color: "from-purple-500 to-purple-600" },
  { key: "advanced", description: "For serious creators", icon: Rocket, color: "from-orange-500 to-orange-600" },
];

const SignUp = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState<"plan" | "details">("plan");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; agreed?: string }>({});
  const [freeTrialEligible, setFreeTrialEligible] = useState(true);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const getPlanPrice = (plan: SubscriptionPlan) => {
    if (plan === "free") return PLAN_LIMITS.free.price.monthly;
    return STRIPE_PLANS[plan].monthlyPrice;
  };

  // Check free trial eligibility when email changes
  useEffect(() => {
    const checkEligibility = async () => {
      if (!email || !z.string().email().safeParse(email).success) {
        return;
      }

      setCheckingEligibility(true);
      try {
        const { data, error } = await supabase.functions.invoke("check-free-trial-eligibility", {
          body: { email },
        });

        if (!error && data) {
          setFreeTrialEligible(data.eligible);
          if (!data.eligible && selectedPlan === "free") {
            setSelectedPlan(null);
            toast.info("You've already used your free trial. Please choose a paid plan.");
          }
        }
      } catch (err) {
        console.error("Error checking eligibility:", err);
      }
      setCheckingEligibility(false);
    };

    const timeoutId = setTimeout(checkEligibility, 500);
    return () => clearTimeout(timeoutId);
  }, [email, selectedPlan]);

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    if (plan === "free" && !freeTrialEligible) {
      toast.error("You've already used your free trial. Please choose a paid plan.");
      return;
    }
    setSelectedPlan(plan);
  };

  const handleContinueToDetails = () => {
    if (selectedPlan) {
      setStep("details");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = signUpSchema.safeParse({ name, email, password, agreed });
    if (!result.success) {
      const fieldErrors: { name?: string; email?: string; password?: string; agreed?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field as keyof typeof fieldErrors] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Re-check free trial eligibility before signup
    if (selectedPlan === "free") {
      const { data: eligibilityData } = await supabase.functions.invoke("check-free-trial-eligibility", {
        body: { email },
      });

      if (eligibilityData && !eligibilityData.eligible) {
        toast.error("You've already used your free trial. Please choose a paid plan.");
        setFreeTrialEligible(false);
        setStep("plan");
        setSelectedPlan(null);
        return;
      }
    }

    setLoading(true);
    const { data, error } = await signUp(email, password, name);

    if (error) {
      setLoading(false);
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
        setFreeTrialEligible(false);
      } else {
        toast.error(error.message);
      }
      return;
    }

    const userId = data?.user?.id;
    const session = data?.session ?? null;
    const hasSession = !!session;
    const emailConfirmed = !!data?.user?.email_confirmed_at;
    const needsConfirmation = !!data?.user && !emailConfirmed;

    if (!userId) {
      setLoading(false);
      toast.error("Failed to create account. Please try again.");
      return;
    }

    // Create subscription record
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setMonth(trialEnd.getMonth() + 1);

    if (selectedPlan === "free") {
      // Free trial - create subscription
      const { error: subError } = await supabase.from("subscriptions").upsert({
        user_id: userId,
        plan: "free",
        status: "trialing",
        billing_cycle: "monthly",
        has_used_free_trial: true,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
      }, { onConflict: "user_id" });

      if (subError) {
        console.error("Subscription error:", subError);
      }

      if (hasSession && session?.access_token) {
        await supabase.functions.invoke("init-user-tokens", {
          body: { reason: "free_trial" },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
      }

      setLoading(false);
      
      if (needsConfirmation) {
        toast.success("Check your email to confirm your account, then sign in to start your free trial.");
        navigate("/signin");
      } else {
        toast.success("Welcome to TubeGrow! Your 1-month free trial has started.");
        navigate("/dashboard");
      }
    } else {
      // Paid plan - create pending subscription
      const { error: subError } = await supabase.from("subscriptions").upsert({
        user_id: userId,
        plan: selectedPlan,
        status: "pending",
        billing_cycle: "monthly",
        has_used_free_trial: false,
        current_period_start: now.toISOString(),
        current_period_end: now.toISOString(),
      }, { onConflict: "user_id" });

      if (subError) {
        console.error("Subscription error:", subError);
      }

      // Redirect to Stripe checkout
      const stripePlan = STRIPE_PLANS[selectedPlan as keyof typeof STRIPE_PLANS];
      if (stripePlan) {
        // Success path: go to payment success page with email confirmation flag
        const successPath = needsConfirmation
          ? "/payment-success?confirm=1"
          : "/payment-success";
        const cancelPath = "/signup?checkout=cancelled";

        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
          body: { priceId: stripePlan.priceId, email, userId, successPath, cancelPath },
          headers: hasSession && session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });

        if (checkoutError) {
          setLoading(false);
          // Payment failed - convert to free trial for new users
          toast.error("Payment setup failed. We've started you on a free trial instead.");
          
          // Update subscription to free trial
          await supabase.from("subscriptions").upsert({
            user_id: userId,
            plan: "free",
            status: "trialing",
            billing_cycle: "monthly",
            has_used_free_trial: true,
            trial_started_at: now.toISOString(),
            trial_ends_at: trialEnd.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: trialEnd.toISOString(),
          }, { onConflict: "user_id" });

          if (hasSession && session?.access_token) {
            await supabase.functions.invoke("init-user-tokens", {
              body: { reason: "free_trial" },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
            });
          }

          if (needsConfirmation) {
            navigate("/signin");
          } else {
            navigate("/dashboard");
          }
          return;
        }

        if (checkoutData?.url) {
          window.location.href = checkoutData.url;
          return;
        }
      }

      setLoading(false);
      navigate(needsConfirmation ? "/signin" : "/dashboard/billing");
    }
  };

  // Features exactly matching the reference image
  const planFeatures: Record<SubscriptionPlan, { included: string[]; excluded: string[] }> = {
    free: {
      included: [
        "Link 1 channel",
        "View basic analytics",
        "20 keywords/day",
        "2 topic suggestions/day",
      ],
      excluded: [
        "AI channel analysis",
        "Competitor analysis",
        "Script writer",
        "Thumbnail generator",
      ],
    },
    basic: {
      included: [
        "Link 1 channel",
        "View basic analytics",
        "50 keywords/day",
        "5 topic suggestions/day",
        "AI analysis weekly",
        "Competitor analysis weekly",
        "Growth tasks & milestones",
        "1,000 AI Credits",
      ],
      excluded: [
        "Script writer",
        "Thumbnail generator",
      ],
    },
    pro: {
      included: [
        "Link up to 3 channels",
        "Advanced analytics",
        "150 keywords/day",
        "10 topic suggestions/day",
        "AI analysis weekly",
        "Competitor analysis weekly",
        "Script writer",
        "5 thumbnails/day",
        "YouTube Strategist AI",
        "Growth tasks & milestones",
        "10,000 AI Credits",
      ],
      excluded: [],
    },
    advanced: {
      included: [
        "Link up to 10 channels",
        "Advanced analytics",
        "Unlimited keywords",
        "20 topic suggestions/day",
        "Unlimited AI analysis",
        "Daily competitor analysis",
        "Script writer",
        "Unlimited thumbnails",
        "YouTube Strategist AI",
        "Growth tasks & milestones",
        "25,000 AI Credits",
      ],
      excluded: [],
    },
  };

  const getFeatures = (plan: SubscriptionPlan) => {
    return planFeatures[plan].included;
  };

  const getExcludedFeatures = (plan: SubscriptionPlan) => {
    return planFeatures[plan].excluded;
  };

  // Filter plans based on eligibility
  const availablePlans = planConfigs.filter(config => {
    if (config.key === "free" && !freeTrialEligible) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative">
              <Youtube className="h-8 w-8 text-primary" />
              <Sparkles className="h-3 w-3 text-accent absolute -top-1 -right-1" />
            </div>
            <span className="font-display font-bold text-xl">
              Tube<span className="gradient-text">Grow</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16">
        <AnimatePresence mode="wait">
          {step === "plan" ? (
            <motion.div
              key="plan-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto"
            >
              {/* Header */}
              <div className="text-center mb-10">
                <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
                  Choose Your Plan
                </h1>
                <p className="text-muted-foreground text-lg">
                  Select the plan that fits your YouTube growth goals
                </p>
                {!freeTrialEligible && (
                  <p className="text-amber-500 text-sm mt-2">
                    Note: You've already used your free trial. Please choose a paid plan.
                  </p>
                )}
              </div>

              {/* Plan Cards */}
              <div className={`grid sm:grid-cols-2 ${availablePlans.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-8`}>
                {availablePlans.map((config) => {
                  const isSelected = selectedPlan === config.key;
                  const includedFeatures = getFeatures(config.key);
                  const excludedFeatures = getExcludedFeatures(config.key);
                  const planName = config.key.charAt(0).toUpperCase() + config.key.slice(1);
                  const buttonText = config.key === "free" ? "Start Free Trial" : 
                                   config.key === "basic" ? "Get Started" :
                                   config.key === "pro" ? "Get Pro" : "Go Advanced";

                  return (
                    <motion.div
                      key={config.key}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePlanSelect(config.key)}
                      className={`cursor-pointer glass rounded-xl p-5 relative transition-all ${
                        isSelected
                          ? "ring-2 ring-primary border-primary/50"
                          : "hover:border-primary/30"
                      } ${config.key === "pro" ? "lg:-mt-2 lg:mb-2" : ""}`}
                    >
                      {config.key === "pro" && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs">
                          Most Popular
                        </Badge>
                      )}

                      {config.key === "free" && (
                        <Badge variant="outline" className="absolute -top-3 left-1/2 -translate-x-1/2 border-amber-500/50 text-amber-400 text-xs">
                          First Time Only
                        </Badge>
                      )}

                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center mb-3`}>
                        <config.icon className="h-5 w-5 text-white" />
                      </div>

                      <h3 className="font-display text-lg font-bold mb-1">{planName}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{config.description}</p>

                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-2xl font-bold">${getPlanPrice(config.key)}</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>

                      <ul className="space-y-2 mb-4">
                        {includedFeatures.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                        {excludedFeatures.map((feature, i) => (
                          <li key={`excluded-${i}`} className="flex items-center gap-2 text-sm">
                            <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                            <span className="text-muted-foreground/50">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className={`text-center py-2 rounded-lg text-sm font-medium ${
                        isSelected 
                          ? "bg-primary text-primary-foreground" 
                          : config.key === "free" 
                            ? "border border-border text-foreground" 
                            : "bg-primary/10 text-primary"
                      }`}>
                        {buttonText}
                      </div>

                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Continue Button */}
              <div className="text-center">
                <Button
                  variant="hero"
                  size="lg"
                  disabled={!selectedPlan}
                  onClick={handleContinueToDetails}
                  className="px-8"
                >
                  Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  Already have an account?{" "}
                  <Link to="/signin" className="text-primary hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="details-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto"
            >
              {/* Back to Plans */}
              <button
                onClick={() => setStep("plan")}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Change plan
              </button>

              {/* Selected Plan Summary */}
              {selectedPlan && (
                <div className="glass rounded-xl p-4 mb-6 flex items-center gap-4">
                  {(() => {
                    const config = planConfigs.find(c => c.key === selectedPlan)!;
                    const limits = PLAN_LIMITS[selectedPlan];
                    return (
                      <>
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                          <config.icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold capitalize">{selectedPlan} Plan</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedPlan === "free" 
                              ? "1 month free trial" 
                              : `$${getPlanPrice(selectedPlan)}/month`}
                          </p>
                        </div>
                        {selectedPlan !== "free" && (
                          <Badge variant="secondary">Paid</Badge>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <h1 className="font-display text-2xl font-bold mb-2">Create your account</h1>
                <p className="text-muted-foreground">
                  {selectedPlan === "free"
                    ? "Start your 1-month free trial"
                    : "Complete your registration to continue to payment"}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`pl-10 h-12 bg-secondary border-border ${errors.name ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`pl-10 h-12 bg-secondary border-border ${errors.email ? "border-destructive" : ""}`}
                    />
                    {checkingEligibility && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pl-10 pr-10 h-12 bg-secondary border-border ${errors.password ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={agreed}
                      onCheckedChange={(checked) => setAgreed(checked as boolean)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="terms"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      I agree to the{" "}
                      <Link to="/terms" className="text-primary hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                  {errors.agreed && <p className="text-sm text-destructive">{errors.agreed}</p>}
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={loading}
                  className="w-full h-12"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : selectedPlan === "free" ? (
                    "Start Free Trial"
                  ) : (
                    "Continue to Payment"
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link to="/signin" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SignUp;
