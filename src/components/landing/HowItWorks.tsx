import { motion } from "framer-motion";
import { Link2, BarChart3, Brain, TrendingUp } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      step: "01",
      icon: Link2,
      title: "Link Your Channel",
      description: "Connect your YouTube channel in seconds with our secure OAuth integration.",
    },
    {
      step: "02",
      icon: BarChart3,
      title: "Get Instant Analytics",
      description: "See real-time data on views, retention, watch time, and revenue at a glance.",
    },
    {
      step: "03",
      icon: Brain,
      title: "AI Analysis",
      description: "Our GPT-5.2 powered AI analyzes your content and provides actionable strategies.",
    },
    {
      step: "04",
      icon: TrendingUp,
      title: "Watch Your Growth",
      description: "Follow personalized growth tasks and celebrate milestones as you scale.",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/30" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Get started in minutes and see results in days
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-border to-transparent" />
              )}

              <div className="text-center">
                {/* Step Number */}
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl glass mb-6 relative group">
                  <span className="absolute -top-2 -right-2 text-xs font-mono text-primary bg-background px-2 py-1 rounded-full border border-border">
                    {item.step}
                  </span>
                  <item.icon className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                </div>

                {/* Content */}
                <h3 className="font-display text-xl font-semibold mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
