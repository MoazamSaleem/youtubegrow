import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link2, BarChart3, Brain, TrendingUp } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const HowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const steps = [
    {
      step: "01",
      icon: Link2,
      title: "Link Your Channel",
      description: "Connect your YouTube channel in seconds with secure OAuth.",
    },
    {
      step: "02",
      icon: BarChart3,
      title: "Get Analytics",
      description: "See real-time data on views, retention, and revenue.",
    },
    {
      step: "03",
      icon: Brain,
      title: "AI Analysis",
      description: "Get actionable strategies from advanced AI analysis.",
    },
    {
      step: "04",
      icon: TrendingUp,
      title: "Watch Growth",
      description: "Follow personalized tasks and celebrate milestones.",
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const stepCards = stepsRef.current?.children;
      if (stepCards) {
        gsap.fromTo(
          stepCards,
          { opacity: 0, y: 40, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.15,
            ease: "back.out(1.4)",
            scrollTrigger: {
              trigger: stepsRef.current,
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
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-24 lg:py-32 relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/40" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            How It Works
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium mb-4">
            Get Started in <span className="gradient-text font-semibold">Minutes</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Simple steps to accelerate your YouTube growth
          </p>
        </motion.div>

        {/* Steps */}
        <div
          ref={stepsRef}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {steps.map((item, index) => (
            <div key={index} className="relative group">
              {/* Connector Line - Desktop only */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-14 left-[60%] w-[80%] h-px bg-gradient-to-r from-border via-primary/30 to-transparent" />
              )}

              <div className="glass rounded-2xl p-6 text-center transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                {/* Step Number & Icon */}
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 mb-5 group-hover:from-primary/20 group-hover:to-accent/20 transition-all">
                  <span className="absolute -top-2 -right-2 text-xs font-mono font-bold text-primary bg-background px-2 py-0.5 rounded-full border border-border">
                    {item.step}
                  </span>
                  <item.icon className="h-7 w-7 text-primary" />
                </div>

                {/* Content */}
                <h3 className="font-display text-lg font-medium mb-2">
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