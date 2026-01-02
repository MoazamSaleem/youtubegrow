import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Crown, Zap, Star, ArrowRight } from "lucide-react";

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const plans = [
    {
      name: "Free",
      description: "Perfect for beginners",
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: Star,
      color: "from-slate-500 to-slate-400",
      features: [
        { text: "1 channel", included: true },
        { text: "Basic analytics", included: true },
        { text: "20 keywords/day", included: true },
        { text: "2 topic ideas/day", included: true },
        { text: "AI analysis", included: false },
        { text: "Script writer", included: false },
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Pro",
      description: "Most popular choice",
      monthlyPrice: 15,
      yearlyPrice: 144,
      icon: Crown,
      color: "from-primary to-accent",
      features: [
        { text: "Up to 3 channels", included: true },
        { text: "Advanced analytics", included: true },
        { text: "Unlimited keywords", included: true },
        { text: "20 topic ideas/day", included: true },
        { text: "Weekly AI analysis", included: true },
        { text: "AI Script writer", included: true },
      ],
      cta: "Get Pro",
      popular: true,
    },
    {
      name: "Scale",
      description: "For serious creators",
      monthlyPrice: 39,
      yearlyPrice: 390,
      icon: Sparkles,
      color: "from-warning to-orange-400",
      features: [
        { text: "Unlimited channels", included: true },
        { text: "Full analytics suite", included: true },
        { text: "Unlimited everything", included: true },
        { text: "Priority AI access", included: true },
        { text: "Dedicated strategist", included: true },
        { text: "White-glove support", included: true },
      ],
      cta: "Go Scale",
      popular: false,
    },
  ];

  return (
    <section ref={sectionRef} id="pricing" className="section-padding relative overflow-hidden">
      <div className="absolute inset-0 hero-bg opacity-40" />

      <div className="container-tight relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 lg:mb-16 px-4"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs sm:text-sm font-medium mb-4 sm:mb-6"
          >
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            Simple Pricing
          </motion.span>
          <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            Invest in Your
            <span className="gradient-text"> Channel's Future</span>
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-6 sm:mb-8">
            Choose the plan that matches your ambition. Upgrade anytime as you grow.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 p-1 sm:p-1.5 glass rounded-full">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                !isYearly ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                isYearly ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="ml-1.5 text-success">-20%</span>
            </button>
          </div>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto px-2 sm:px-0">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              className={`relative ${plan.popular ? "md:-mt-4 md:mb-4" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1 sm:py-1.5 bg-gradient-to-r from-primary to-accent rounded-full text-[10px] sm:text-xs font-bold text-primary-foreground shadow-lg z-10 whitespace-nowrap">
                  MOST POPULAR
                </div>
              )}

              <div
                className={`glass rounded-xl sm:rounded-2xl p-5 sm:p-6 h-full flex flex-col ${
                  plan.popular ? "border-primary/40 shadow-lg shadow-primary/10" : ""
                }`}
              >
                {/* Glow Effect */}
                {plan.popular && (
                  <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5" />
                )}

                <div className="relative z-10 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br ${plan.color}`}>
                      <plan.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg sm:text-xl font-bold">{plan.name}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4 sm:mb-6">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isYearly ? "yearly" : "monthly"}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="flex items-baseline gap-1"
                      >
                        <span className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold">
                          ${isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice}
                        </span>
                        <span className="text-muted-foreground text-sm">/mo</span>
                      </motion.div>
                    </AnimatePresence>
                    {isYearly && plan.monthlyPrice > 0 && (
                      <p className="text-xs sm:text-sm text-success mt-1">Billed ${plan.yearlyPrice}/year</p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 sm:space-y-3 mb-5 sm:mb-6 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs sm:text-sm">
                        {f.included ? (
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={f.included ? "" : "text-muted-foreground/50"}>{f.text}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    variant={plan.popular ? "glow" : "outline"}
                    className="w-full h-10 sm:h-11 text-sm group"
                    asChild
                  >
                    <Link to="/signup">
                      {plan.cta}
                      <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
