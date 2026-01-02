import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link2, BarChart3, Brain, TrendingUp, ArrowRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const HowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  const steps = [
    {
      step: "01",
      icon: Link2,
      title: "Link Your Channel",
      description: "Connect your YouTube channel in seconds with secure OAuth.",
      color: "from-blue-500 to-cyan-500",
    },
    {
      step: "02",
      icon: BarChart3,
      title: "Get Analytics",
      description: "See real-time data on views, retention, and revenue.",
      color: "from-purple-500 to-pink-500",
    },
    {
      step: "03",
      icon: Brain,
      title: "AI Analysis",
      description: "Get actionable strategies from advanced AI analysis.",
      color: "from-amber-500 to-orange-500",
    },
    {
      step: "04",
      icon: TrendingUp,
      title: "Watch Growth",
      description: "Follow personalized tasks and celebrate milestones.",
      color: "from-green-500 to-emerald-500",
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate connecting line
      if (lineRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 1.5,
            ease: "power2.out",
            scrollTrigger: {
              trigger: stepsRef.current,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }

      // Step cards animation
      const stepCards = stepsRef.current?.querySelectorAll(".step-card");
      if (stepCards) {
        gsap.fromTo(
          stepCards,
          { opacity: 0, y: 60, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            stagger: 0.2,
            ease: "back.out(1.4)",
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
      className="py-24 lg:py-32 relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/40" />
      <div className="absolute inset-0 gradient-mesh opacity-20" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            How It Works
          </motion.span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium mb-4">
            Get Started in <span className="gradient-text font-semibold">Minutes</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Simple steps to accelerate your YouTube growth
          </p>
        </motion.div>

        {/* Steps Container */}
        <div ref={stepsRef} className="relative">
          {/* Connecting Line - Desktop */}
          <div
            ref={lineRef}
            className="hidden lg:block absolute top-16 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary via-accent to-primary origin-left"
          />

          {/* Steps Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -10 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="step-card relative group"
              >
                {/* Arrow connector - Desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-16 z-20">
                    <ArrowRight className="h-5 w-5 text-primary" />
                  </div>
                )}

                <div className="glass rounded-2xl p-6 text-center transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40 h-full">
                  {/* Icon Container */}
                  <div className="relative inline-flex items-center justify-center mb-5">
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} p-0.5`}
                    >
                      <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center">
                        <item.icon className="h-7 w-7 text-primary" />
                      </div>
                    </motion.div>
                    
                    {/* Step Number Badge */}
                    <span className="absolute -top-2 -right-2 text-xs font-mono font-bold text-primary-foreground bg-primary px-2.5 py-1 rounded-full shadow-lg">
                      {item.step}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-lg font-medium mb-2 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;