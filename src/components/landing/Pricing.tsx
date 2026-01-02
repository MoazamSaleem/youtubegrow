import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Crown, Zap, Star, ArrowRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  const plans = [
    {
      name: "Free",
      description: "1 month trial",
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: Star,
      color: "from-slate-500 to-slate-400",
      features: [
        { text: "Link 1 channel", included: true },
        { text: "Basic analytics", included: true },
        { text: "20 keywords/day", included: true },
        { text: "2 topics/day", included: true },
        { text: "AI analysis", included: false },
        { text: "Competitor analysis", included: false },
      ],
      cta: "Start Free",
      variant: "outline" as const,
      popular: false,
    },
    {
      name: "Basic",
      description: "For growing creators",
      monthlyPrice: 7,
      yearlyPrice: 70,
      icon: Zap,
      color: "from-blue-500 to-cyan-500",
      features: [
        { text: "Link 1 channel", included: true },
        { text: "Full analytics", included: true },
        { text: "50 keywords/day", included: true },
        { text: "5 topics/day", included: true },
        { text: "Weekly AI analysis", included: true },
        { text: "Growth milestones", included: true },
      ],
      cta: "Get Started",
      variant: "default" as const,
      popular: false,
    },
    {
      name: "Pro",
      description: "Most popular",
      monthlyPrice: 15,
      yearlyPrice: 120,
      icon: Crown,
      color: "from-purple-500 to-pink-500",
      features: [
        { text: "Up to 3 channels", included: true },
        { text: "Advanced analytics", included: true },
        { text: "150 keywords/day", included: true },
        { text: "10 topics/day", included: true },
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
      color: "from-amber-500 to-orange-500",
      features: [
        { text: "Up to 10 channels", included: true },
        { text: "Unlimited keywords", included: true },
        { text: "Unlimited AI analysis", included: true },
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

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.querySelectorAll(".pricing-card");
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 80, rotationY: 15 },
          {
            opacity: 1,
            y: 0,
            rotationY: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: {
              trigger: cardsRef.current,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="pricing" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh opacity-30" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            Pricing
          </motion.span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium mb-4">
            Simple, <span className="gradient-text font-semibold">Transparent</span> Pricing
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Choose the plan that fits your growth goals
          </p>

          {/* Billing Toggle */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="inline-flex items-center gap-1 p-1.5 glass rounded-full"
          >
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                !isYearly
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                isYearly
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs text-success font-semibold">-23%</span>
            </button>
          </motion.div>
        </motion.div>

        {/* Pricing Cards */}
        <div
          ref={cardsRef}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-7xl mx-auto perspective-1000"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              onMouseEnter={() => setHoveredPlan(plan.name)}
              onMouseLeave={() => setHoveredPlan(null)}
              whileHover={{ y: -12, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`pricing-card relative ${plan.popular ? "lg:-mt-4 lg:mb-4" : ""}`}
            >
              {/* Popular Badge */}
              <AnimatePresence>
                {plan.popular && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent rounded-full text-xs font-semibold text-primary-foreground z-10 shadow-lg"
                  >
                    Most Popular
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                className={`glass rounded-2xl p-6 h-full flex flex-col transition-all duration-500 relative overflow-hidden ${
                  plan.popular
                    ? "border-primary/50 shadow-xl shadow-primary/10"
                    : "hover:border-primary/30"
                }`}
              >
                {/* Hover Gradient Background */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredPlan === plan.name ? 1 : 0 }}
                  className={`absolute inset-0 bg-gradient-to-br ${plan.color} opacity-10`}
                />

                <div className="relative z-10">
                  {/* Plan Header */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className={`p-2 rounded-xl bg-gradient-to-br ${plan.color}`}
                      >
                        <plan.icon className="h-5 w-5 text-white" />
                      </motion.div>
                      <h3 className="font-display text-xl font-medium">{plan.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isYearly ? "yearly" : "monthly"}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-baseline gap-1"
                      >
                        <span className="font-display text-4xl font-semibold">
                          ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          /{isYearly ? "year" : "month"}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                    {isYearly && plan.monthlyPrice > 0 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-success font-medium mt-1"
                      >
                        Save {calculateDiscount(plan.monthlyPrice, plan.yearlyPrice)}%
                      </motion.p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((feature, featureIndex) => (
                      <motion.li
                        key={featureIndex}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: featureIndex * 0.05 }}
                        className="flex items-start gap-2"
                      >
                        {feature.included ? (
                          <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                        )}
                        <span
                          className={`text-sm ${
                            feature.included ? "text-foreground" : "text-muted-foreground/50"
                          }`}
                        >
                          {feature.text}
                        </span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button variant={plan.variant} className="w-full group" asChild>
                    <Link to="/signup">
                      {plan.cta}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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