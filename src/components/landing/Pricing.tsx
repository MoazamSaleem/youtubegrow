import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Crown, Zap } from "lucide-react";
import { PLAN_LIMITS, SubscriptionPlan } from "@/lib/planLimits";

gsap.registerPlugin(ScrollTrigger);

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  const planConfigs: { key: SubscriptionPlan; description: string; icon: typeof Zap; cta: string; variant: "default" | "hero" | "premium"; popular: boolean }[] = [
    { key: "basic", description: "For growing creators", icon: Zap, cta: "Get Started", variant: "default", popular: false },
    { key: "pro", description: "Most popular choice", icon: Crown, cta: "Get Pro", variant: "hero", popular: true },
    { key: "advanced", description: "For serious creators", icon: Sparkles, cta: "Go Advanced", variant: "premium", popular: false },
  ];

  const getFeatures = (plan: SubscriptionPlan) => {
    const limits = PLAN_LIMITS[plan];
    const features: { text: string; included: boolean }[] = [];
    
    // Channel linking
    features.push({ 
      text: limits.maxChannels === 1 ? "Link 1 channel" : `Link up to ${limits.maxChannels} channels`, 
      included: true 
    });
    
    // Analytics
    features.push({ 
      text: limits.hasAdvancedAnalytics ? "Advanced analytics" : "View basic analytics", 
      included: true 
    });
    
    // Keywords
    features.push({ 
      text: limits.keywordsPerDay === -1 ? "Unlimited keywords" : `${limits.keywordsPerDay} keywords/day`, 
      included: true 
    });
    
    // Topics
    features.push({ 
      text: `${limits.topicsPerDay} topic suggestions/day`, 
      included: true 
    });
    
    // AI Channel analysis
    features.push({ 
      text: limits.channelAnalysisFrequency === "never" 
        ? "AI channel analysis" 
        : limits.channelAnalysisFrequency === "unlimited" 
          ? "Unlimited AI analysis" 
          : `AI analysis ${limits.channelAnalysisFrequency}`, 
      included: limits.channelAnalysisFrequency !== "never" 
    });
    
    // Competitor analysis
    features.push({ 
      text: limits.competitorAnalysisFrequency === "never" 
        ? "Competitor analysis" 
        : limits.competitorAnalysisFrequency === "daily" 
          ? "Daily competitor analysis" 
          : `Competitor analysis ${limits.competitorAnalysisFrequency}`, 
      included: limits.competitorAnalysisFrequency !== "never" 
    });
    
    // Script writer
    features.push({ 
      text: "Script writer", 
      included: limits.hasScriptWriter 
    });

    if (plan === "pro" || plan === "advanced") {
      features.push({ text: "Text to Speech", included: limits.hasTextToSpeech });
      features.push({ text: "Voice Clone", included: limits.hasVoiceClone });
    }
    
    // Thumbnails
    features.push({ 
      text: limits.thumbnailsPerDay === -1 
        ? "Unlimited thumbnails" 
        : limits.thumbnailsPerDay > 0 
          ? `${limits.thumbnailsPerDay} thumbnails/day` 
          : "Thumbnail generator", 
      included: limits.thumbnailsPerDay !== 0 
    });
    
    // YouTube Strategist AI (only show for Pro+)
    if (plan === "pro" || plan === "advanced") {
      features.push({ text: "YouTube Strategist AI", included: limits.hasYoutubeStrategist });
    }
    
    features.push({ text: "Growth tasks & milestones", included: limits.growthTasksTier !== "none" });
    
    // AI credits (only show for paid plans)
    if (limits.aiStrategistCredits > 0) {
      features.push({ text: `${limits.aiStrategistCredits.toLocaleString()} AI Credits`, included: true });
    }
    
    return features;
  };

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
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 max-w-6xl mx-auto"
        >
          {planConfigs.map((config) => {
            const limits = PLAN_LIMITS[config.key];
            const monthlyPrice = limits.price.monthly;
            const yearlyPrice = limits.price.yearly;
            const features = getFeatures(config.key);
            const planName = config.key.charAt(0).toUpperCase() + config.key.slice(1);
            
            return (
              <div
                key={config.key}
                className={`relative ${config.popular ? "lg:-mt-4 lg:mb-4" : ""}`}
              >
                {config.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent rounded-full text-xs font-medium text-primary-foreground z-10">
                    Most Popular
                  </div>
                )}

                <div
                  className={`glass rounded-2xl p-5 lg:p-6 h-full flex flex-col transition-all hover:-translate-y-1 hover:shadow-lg ${
                    config.popular
                      ? "border-primary/50 shadow-lg shadow-primary/10"
                      : "hover:border-primary/30"
                  }`}
                >
                  {/* Plan Header */}
                  <div className="mb-5 lg:mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <config.icon
                        className={`h-5 w-5 ${
                          config.popular ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <h3 className="font-display text-xl font-semibold">
                        {planName}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {config.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-5 lg:mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-3xl lg:text-4xl font-bold">
                        ${isYearly ? yearlyPrice : monthlyPrice}
                      </span>
                      <span className="text-muted-foreground">
                        /{isYearly ? "year" : "month"}
                      </span>
                    </div>
                    {isYearly && monthlyPrice > 0 && (
                      <p className="text-sm text-accent mt-1">
                        Save {calculateDiscount(monthlyPrice, yearlyPrice)}%
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 lg:space-y-3 mb-6 lg:mb-8 flex-1">
                    {features.map((feature, featureIndex) => (
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
                  <Button variant={config.variant} className="w-full" asChild>
                    <Link to="/signup">{config.cta}</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
