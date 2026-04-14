import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

const planConfigs: { key: SubscriptionPlan; description: string; icon: typeof Zap; color: string }[] = [
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
  const [isYearly, setIsYearly] = useState(false);

  const selectedBillingCycle = isYearly ? "yearly" : "monthly";

  const getPlanPrice = (plan: SubscriptionPlan) => {
    return isYearly ? STRIPE_PLANS[plan].yearlyPrice : STRIPE_PLANS[plan].monthlyPrice;
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
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

    setLoading(true);
    const { data, error } = await signUp(email, password, name);

    if (error) {
      setLoading(false);
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
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

    // Create or refresh pending subscription
    const now = new Date().toISOString();
    const pendingSubscription = {
      plan: selectedPlan,
      status: "pending",
      billing_cycle: selectedBillingCycle,
      current_period_start: now,
      current_period_end: now,
      updated_at: now,
    };

    const { data: updatedRows, error: updateSubError } = await supabase
      .from("subscriptions")
      .update(pendingSubscription)
      .eq("user_id", userId)
      .select("id");

    let subError = updateSubError;

    if (!subError && (!updatedRows || updatedRows.length === 0)) {
      const { error: insertSubError } = await supabase.from("subscriptions").insert({
        user_id: userId,
        ...pendingSubscription,
      });
      subError = insertSubError;
    }

    if (subError) {
      console.error("Subscription error:", subError);
    }

    // Redirect to Stripe checkout
    const stripePlan = STRIPE_PLANS[selectedPlan as keyof typeof STRIPE_PLANS];
    if (stripePlan) {
      const successPath = needsConfirmation
        ? "/payment-success?confirm=1"
        : "/payment-success";
      const cancelPath = "/signup?checkout=cancelled";

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: selectedBillingCycle === "monthly" ? stripePlan.monthlyPriceId : undefined,
          productId: stripePlan.productId,
          billingCycle: selectedBillingCycle,
          amountUsd: selectedBillingCycle === "yearly" ? stripePlan.yearlyPrice : stripePlan.monthlyPrice,
          email,
          userId,
          successPath,
          cancelPath,
        },
        headers: hasSession && session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            }
          : undefined,
      });

      if (checkoutError) {
        setLoading(false);
        toast.error("Payment setup failed. Please try again.");
        navigate(needsConfirmation ? "/signin" : "/dashboard/billing");
        return;
      }

      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
        return;
      }
    }

    setLoading(false);
    navigate(needsConfirmation ? "/signin" : "/dashboard/billing");
  };

  // Features exactly matching the reference image
  const planFeatures: Record<SubscriptionPlan, { included: string[]; excluded: string[] }> = {
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
        "Text to Speech",
        "Voice Clone",
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
        "Text to Speech",
        "Voice Clone",
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
        "Text to Speech",
        "Voice Clone",
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
            <span className="font-display font-bold text-base sm:text-xl leading-tight">
              YouTube <span className="gradient-text">Growth Planner</span>
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
                <div className="flex items-center justify-center gap-4 mt-6">
                  <span className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
                    Monthly
                  </span>
                  <Switch
                    checked={isYearly}
                    onCheckedChange={setIsYearly}
                  />
                  <span className={isYearly ? "font-semibold" : "text-muted-foreground"}>
                    Yearly
                  </span>
                  {isYearly && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                      Save up to 23%
                    </Badge>
                  )}
                </div>
              </div>

              {/* Plan Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {planConfigs.map((config) => {
                  const isSelected = selectedPlan === config.key;
                  const includedFeatures = getFeatures(config.key);
                  const excludedFeatures = getExcludedFeatures(config.key);
                  const planName = config.key.charAt(0).toUpperCase() + config.key.slice(1);
                  const buttonText = config.key === "basic" ? "Get Started" :
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

                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center mb-3`}>
                        <config.icon className="h-5 w-5 text-white" />
                      </div>

                      <h3 className="font-display text-lg font-bold mb-1">{planName}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{config.description}</p>

                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-2xl font-bold">${getPlanPrice(config.key)}</span>
                        <span className="text-muted-foreground text-sm">
                          /{isYearly ? "year" : "month"}
                        </span>
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
                            ${getPlanPrice(selectedPlan)}/{isYearly ? "year" : "month"}
                          </p>
                        </div>
                        <Badge variant="secondary">Paid</Badge>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <h1 className="font-display text-2xl font-bold mb-2">Create your account</h1>
                <p className="text-muted-foreground">
                  Complete your registration to continue to payment
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
