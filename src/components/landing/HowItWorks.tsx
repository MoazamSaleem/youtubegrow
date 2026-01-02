import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link2, BarChart3, Brain, Rocket, Check } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const HowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const steps = [
    {
      num: "01",
      icon: Link2,
      title: "Connect Your Channel",
      description: "Link your YouTube channel securely with one-click OAuth integration.",
      color: "from-blue-500 to-cyan-400",
    },
    {
      num: "02",
      icon: BarChart3,
      title: "Analyze Performance",
      description: "Get instant access to real-time analytics and growth metrics.",
      color: "from-purple-500 to-pink-400",
    },
    {
      num: "03",
      icon: Brain,
      title: "AI-Powered Insights",
      description: "Receive personalized recommendations and content strategies.",
      color: "from-amber-500 to-orange-400",
    },
    {
      num: "04",
      icon: Rocket,
      title: "Scale Your Growth",
      description: "Implement strategies and watch your channel explode.",
      color: "from-green-500 to-emerald-400",
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = stepsRef.current?.querySelectorAll(".step-card");
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, x: -50 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: stepsRef.current,
              start: "top 75%",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/30" />
      <div className="absolute inset-0 aurora-bg opacity-30" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm font-medium mb-6"
            >
              <Check className="h-4 w-4 text-success" />
              Simple Process
            </motion.span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold mb-6">
              Start Growing in
              <br />
              <span className="gradient-text">Under 5 Minutes</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              No complex setup, no learning curve. Connect your channel and start getting actionable insights immediately.
            </p>

            {/* Benefits */}
            <div className="space-y-4">
              {["No credit card required", "Free 14-day trial", "Cancel anytime"].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-success" />
                  </div>
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Steps */}
          <div ref={stepsRef} className="space-y-4">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                whileHover={{ x: 10, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="step-card glass rounded-2xl p-5 flex items-start gap-5 group cursor-default"
              >
                {/* Number & Icon */}
                <div className="relative shrink-0">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                    <step.icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center text-xs font-bold">
                    {step.num}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="font-display text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
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