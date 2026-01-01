import { motion } from "framer-motion";
import { 
  BarChart3, 
  Brain, 
  Search, 
  Lightbulb, 
  Users, 
  Sparkles,
  FileText,
  Image,
  Target
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Track views, retention, watch time, and revenue with live updates. Filter by daily, weekly, or monthly data.",
      gradient: "from-primary to-primary/50",
    },
    {
      icon: Brain,
      title: "AI Channel Analysis",
      description: "GPT-5.2 powered deep analysis of your channel with actionable, authentic strategies for growth.",
      gradient: "from-accent to-accent/50",
    },
    {
      icon: Search,
      title: "Keyword Research",
      description: "Discover high-ranking keywords tailored to your niche. Up to unlimited searches on Advanced plan.",
      gradient: "from-warning to-warning/50",
    },
    {
      icon: Lightbulb,
      title: "Daily Topic Suggestions",
      description: "Get AI-curated topic ideas based on your channel's niche and current trends.",
      gradient: "from-primary to-accent",
    },
    {
      icon: Users,
      title: "Competitor Analysis",
      description: "Study competitor strategies, track their growth, and discover what works in your niche.",
      gradient: "from-accent to-success",
    },
    {
      icon: Target,
      title: "Growth Roadmap",
      description: "Follow milestone-based growth tasks with celebrations when you hit your goals.",
      gradient: "from-warning to-destructive",
    },
    {
      icon: FileText,
      title: "AI Script Writer",
      description: "Generate engaging video scripts powered by GPT-5.2. Available on Pro and Advanced plans.",
      gradient: "from-primary to-warning",
    },
    {
      icon: Image,
      title: "Thumbnail Generator",
      description: "Create eye-catching thumbnails with AI. Generate up to 5+ thumbnails daily.",
      gradient: "from-accent to-primary",
    },
    {
      icon: Sparkles,
      title: "YouTube Strategist",
      description: "Personal AI strategist designed specifically for YouTube channel growth. Advanced plan exclusive.",
      gradient: "from-warning to-accent",
    },
  ];

  return (
    <section id="features" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.05),transparent_70%)]" />

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
            Everything You Need to
            <br />
            <span className="gradient-text">Dominate YouTube</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Powerful AI tools and analytics designed to accelerate your channel's growth
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="glass rounded-2xl p-6 h-full hover:bg-card/80 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                {/* Icon */}
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4`}>
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>

                {/* Content */}
                <h3 className="font-display text-xl font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
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
