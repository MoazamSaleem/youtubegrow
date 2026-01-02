import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Crown, Zap, Star } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Header animation
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Cards stagger animation
      const cards = cardsRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 60, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: {
              trigger: cardsRef.current,
              start: "top 75%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="pricing" className="py-20 lg:py-32 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--accent)/0.05),transparent_70%)]" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div ref={headerRef} className="text-center max-w-2xl mx-auto mb-10 lg:mb-12">
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
        </div>

        {/* Pricing Cards */}
        <div
          ref={cardsRef}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-7xl mx-auto"
        >
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative ${plan.popular ? "lg:-mt-4 lg:mb-4" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent rounded-full text-xs font-medium text-primary-foreground z-10">
                  Most Popular
                </div>
              )}

              <div
                className={`glass rounded-2xl p-5 lg:p-6 h-full flex flex-col transition-all hover:-translate-y-1 hover:shadow-lg ${
                  plan.popular
                    ? "border-primary/50 shadow-lg shadow-primary/10"
                    : "hover:border-primary/30"
                }`}
              >
                {/* Plan Header */}
                <div className="mb-5 lg:mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <plan.icon
                      className={`h-5 w-5 ${
                        plan.popular ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <h3 className="font-display text-xl font-semibold">
                      {plan.name}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-5 lg:mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-3xl lg:text-4xl font-bold">
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
                <ul className="space-y-2 lg:space-y-3 mb-6 lg:mb-8 flex-1">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${
                          feature.included
                            ? "text-foreground"
                            : "text-muted-foreground/50"
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;