import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Crown, Zap, Star } from "lucide-react";

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: "Free",
      description: "1 month trial",
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: Star,
      features: [
        { text: "Link 1 channel", included: true },
        { text: "View basic analytics", included: true },
        { text: "20 keywords/day", included: true },
        { text: "2 topic suggestions/day", included: true },
        { text: "AI channel analysis", included: false },
        { text: "Competitor analysis", included: false },
        { text: "Script writer", included: false },
        { text: "Thumbnail generator", included: false },
      ],
      cta: "Start Free Trial",
      variant: "outline" as const,
      popular: false,
    },
    {
      name: "Basic",
      description: "For growing creators",
      monthlyPrice: 7,
      yearlyPrice: 70,
      icon: Zap,
      features: [
        { text: "Link 1 channel", included: true },
        { text: "View analytics", included: true },
        { text: "50 keywords/day", included: true },
        { text: "5 topic suggestions/day", included: true },
        { text: "AI analysis weekly", included: true },
        { text: "Competitor analysis weekly", included: true },
        { text: "Growth tasks & milestones", included: true },
        { text: "Thumbnail generator", included: false },
      ],
      cta: "Get Started",
      variant: "default" as const,
      popular: false,
    },
    {
      name: "Pro",
      description: "Most popular choice",
      monthlyPrice: 15,
      yearlyPrice: 120,
      icon: Crown,
      features: [
        { text: "Link up to 3 channels", included: true },
        { text: "Advanced analytics", included: true },
        { text: "150 keywords/day", included: true },
        { text: "10 topic suggestions/day", included: true },
        { text: "AI analysis weekly", included: true },
        { text: "Competitor analysis weekly", included: true },
        { text: "AI Script Writer", included: true },
        { text: "5 thumbnails/day", included: true },
      ],
      cta: "Get Pro",
      variant: "hero" as const,
      popular: true,
    },
    {
      name: "Advanced",
      description: "For serious creators",
      monthlyPrice: 25,
      yearlyPrice: 230,
      icon: Sparkles,
      features: [
        { text: "Link up to 10 channels", included: true },
        { text: "Advanced analytics", included: true },
        { text: "Unlimited keywords", included: true },
        { text: "20 topic suggestions/day", included: true },
        { text: "Unlimited AI analysis", included: true },
        { text: "Daily competitor analysis", included: true },
        { text: "AI Script Writer", included: true },
        { text: "Unlimited thumbnails", included: true },
        { text: "YouTube Strategist AI", included: true },
      ],
      cta: "Go Advanced",
      variant: "premium" as const,
      popular: false,
    },
  ];

  const calculateDiscount = (monthly: number, yearly: number) => {
    if (monthly === 0) return 0;
    return Math.round(((monthly * 12 - yearly) / (monthly * 12)) * 100);
  };

  return (
    <section id="pricing" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--accent)/0.05),transparent_70%)]" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent
            <br />
            <span className="gradient-text">Pricing</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Choose the plan that fits your growth goals
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1 glass rounded-full">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !isYearly
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isYearly
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs text-accent">Save up to 23%</span>
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative ${plan.popular ? "lg:-mt-4 lg:mb-4" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent rounded-full text-xs font-medium text-primary-foreground">
                  Most Popular
                </div>
              )}

              <div
                className={`glass rounded-2xl p-6 h-full flex flex-col ${
                  plan.popular
                    ? "border-primary/50 shadow-lg shadow-primary/10"
                    : ""
                }`}
              >
                {/* Plan Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <plan.icon className={`h-5 w-5 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                    <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold">
                      ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-muted-foreground">
                      /{isYearly ? "year" : "month"}
                    </span>
                  </div>
                  {isYearly && plan.monthlyPrice > 0 && (
                    <p className="text-sm text-accent mt-1">
                      Save {calculateDiscount(plan.monthlyPrice, plan.yearlyPrice)}%
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${
                          feature.included ? "text-foreground" : "text-muted-foreground/50"
                        }`}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button variant={plan.variant} className="w-full" asChild>
                  <Link to="/signup">{plan.cta}</Link>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
