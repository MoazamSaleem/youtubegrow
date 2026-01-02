import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link2, BarChart3, Brain, TrendingUp } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const HowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const steps = [
    {
      step: "01",
      icon: Link2,
      title: "Link Your Channel",
      description:
        "Connect your YouTube channel in seconds with our secure OAuth integration.",
    },
    {
      step: "02",
      icon: BarChart3,
      title: "Get Instant Analytics",
      description:
        "See real-time data on views, retention, watch time, and revenue at a glance.",
    },
    {
      step: "03",
      icon: Brain,
      title: "AI Analysis",
      description:
        "Our advanced AI analyzes your content and provides actionable strategies.",
    },
    {
      step: "04",
      icon: TrendingUp,
      title: "Watch Your Growth",
      description:
        "Follow personalized growth tasks and celebrate milestones as you scale.",
    },
  ];

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

      // Steps animation with stagger
      const stepCards = stepsRef.current?.children;
      if (stepCards) {
        gsap.fromTo(
          stepCards,
          { opacity: 0, y: 50, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            stagger: 0.2,
            ease: "back.out(1.7)",
            scrollTrigger: {
              trigger: stepsRef.current,
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
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-20 lg:py-32 relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/30" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div ref={headerRef} className="text-center max-w-2xl mx-auto mb-12 lg:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Get started in minutes and see results in days
          </p>
        </div>

        {/* Steps */}
        <div
          ref={stepsRef}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
        >
          {steps.map((item, index) => (
            <div key={index} className="relative group">
              {/* Connector Line - Desktop only */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-border to-transparent" />
              )}

              <div className="text-center">
                {/* Step Number & Icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 lg:w-24 lg:h-24 rounded-2xl glass mb-6 relative group-hover:border-primary/50 transition-all group-hover:shadow-lg group-hover:shadow-primary/10">
                  <span className="absolute -top-2 -right-2 text-xs font-mono text-primary bg-background px-2 py-1 rounded-full border border-border">
                    {item.step}
                  </span>
                  <item.icon className="h-8 w-8 lg:h-10 lg:w-10 text-primary group-hover:scale-110 transition-transform" />
                </div>

                {/* Content */}
                <h3 className="font-display text-lg lg:text-xl font-semibold mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;