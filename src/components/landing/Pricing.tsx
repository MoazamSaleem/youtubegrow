import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Crown, Zap, Star, ArrowRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  const plans = [
    {
      name: "Starter",
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
      cta: "Start Free",
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

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.querySelectorAll(".pricing-card");
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 60, rotateX: -15 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: {
              trigger: cardsRef.current,
              start: "top 80%",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="pricing" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 aurora-bg opacity-40" />
      <div className="absolute inset-0 noise pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm font-medium mb-6"
          >
            <Zap className="h-4 w-4 text-primary" />
            Simple Pricing
          </motion.span>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Invest in Your
            <br />
            <span className="gradient-text">Channel's Future</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Choose the plan that matches your ambition. Upgrade anytime as you grow.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 p-1.5 glass rounded-full">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                !isYearly ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                isYearly ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
              }`}
            >
              Yearly
              <span className="ml-2 text-success">-20%</span>
            </button>
          </div>
        </motion.div>

        {/* Cards */}
        <div ref={cardsRef} className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto perspective-1000">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              whileHover={{ y: -12, scale: 1.03 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`pricing-card relative ${plan.popular ? "md:-mt-6 md:mb-6" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-primary to-accent rounded-full text-xs font-bold text-white shadow-lg z-10">
                  MOST POPULAR
                </div>
              )}

              <div
                className={`glass rounded-3xl p-6 h-full flex flex-col relative overflow-hidden ${
                  plan.popular ? "border-primary/50 shadow-xl shadow-primary/10" : ""
                }`}
              >
                {/* Glow Effect */}
                {plan.popular && (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
                )}

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${plan.color}`}>
                      <plan.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isYearly ? "yearly" : "monthly"}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex items-baseline gap-1"
                      >
                        <span className="font-display text-5xl font-bold">
                          ${isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice}
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                      </motion.div>
                    </AnimatePresence>
                    {isYearly && plan.monthlyPrice > 0 && (
                      <p className="text-sm text-success mt-1">Billed ${plan.yearlyPrice}/year</p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm">
                        {f.included ? (
                          <Check className="h-4 w-4 text-success shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={f.included ? "" : "text-muted-foreground/50"}>{f.text}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    variant={plan.popular ? "glow" : "outline"}
                    className="w-full group"
                    asChild
                  >
                    <Link to="/signup">
                      {plan.cta}
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
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