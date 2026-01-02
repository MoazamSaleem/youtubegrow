import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  BarChart3,
  Brain,
  Search,
  Lightbulb,
  Users,
  FileText,
  Sparkles,
  Target,
} from "lucide-react";

const Features = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const features = [
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Track every metric that matters with live dashboards.",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Brain,
      title: "AI Channel Analysis",
      description: "Get personalized growth strategies powered by AI.",
      color: "from-violet-500 to-purple-500",
    },
    {
      icon: Search,
      title: "Keyword Research",
      description: "Discover trending keywords in your niche.",
      color: "from-orange-500 to-amber-500",
    },
    {
      icon: Lightbulb,
      title: "Topic Generator",
      description: "Never run out of video ideas with AI suggestions.",
      color: "from-yellow-500 to-orange-500",
    },
    {
      icon: Users,
      title: "Competitor Insights",
      description: "Analyze top performers and learn their strategies.",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: FileText,
      title: "Script Writer",
      description: "Generate engaging scripts optimized for retention.",
      color: "from-pink-500 to-rose-500",
    },
    {
      icon: Sparkles,
      title: "Growth Strategist",
      description: "Your AI coach for channel optimization.",
      color: "from-primary to-accent",
    },
    {
      icon: Target,
      title: "Smart Thumbnails",
      description: "AI-powered thumbnail suggestions that convert.",
      color: "from-indigo-500 to-blue-500",
    },
  ];

  return (
    <section ref={sectionRef} id="features" className="section-padding relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 hero-bg opacity-50" />
      <div className="absolute inset-0 dot-pattern opacity-30" />

      <div className="container-tight relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 lg:mb-20 px-4"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs sm:text-sm font-medium mb-4 sm:mb-6"
          >
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            Powerful Features
          </motion.span>
          <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            Everything to
            <span className="gradient-text"> Dominate YouTube</span>
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
            A complete suite of AI tools designed to help you grow faster and create better content.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="group"
            >
              <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 h-full transition-all duration-300 hover:border-primary/30 border-gradient">
                {/* Icon */}
                <div
                  className={`inline-flex p-2.5 sm:p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-3 sm:mb-4 group-hover:scale-105 transition-transform`}
                >
                  <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="font-display text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
