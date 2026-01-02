import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BarChart3,
  Brain,
  Search,
  Lightbulb,
  Users,
  Sparkles,
  FileText,
  Wand2,
  Target,
  ArrowUpRight,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const Features = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const features = [
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Track every metric that matters with live dashboards and smart alerts.",
      span: "col-span-12 md:col-span-6 lg:col-span-4",
      color: "from-blue-500 to-cyan-400",
    },
    {
      icon: Brain,
      title: "AI Channel Analysis",
      description: "Get personalized growth strategies powered by advanced machine learning.",
      span: "col-span-12 md:col-span-6 lg:col-span-4",
      color: "from-purple-500 to-pink-400",
    },
    {
      icon: Search,
      title: "Keyword Research",
      description: "Discover untapped keywords and trending topics in your niche.",
      span: "col-span-12 md:col-span-6 lg:col-span-4",
      color: "from-amber-500 to-orange-400",
    },
    {
      icon: Lightbulb,
      title: "Topic Generator",
      description: "Never run out of ideas with AI-curated video topics tailored to your audience.",
      span: "col-span-12 md:col-span-6 lg:col-span-6",
      color: "from-yellow-500 to-amber-400",
      featured: true,
    },
    {
      icon: Users,
      title: "Competitor Insights",
      description: "Analyze top performers and reverse-engineer their success strategies.",
      span: "col-span-12 md:col-span-6 lg:col-span-6",
      color: "from-green-500 to-emerald-400",
      featured: true,
    },
    {
      icon: FileText,
      title: "Script Writer",
      description: "Generate engaging scripts optimized for retention and engagement.",
      span: "col-span-12 md:col-span-4",
      color: "from-indigo-500 to-violet-400",
    },
    {
      icon: Wand2,
      title: "Thumbnail AI",
      description: "Create scroll-stopping thumbnails with AI-powered design suggestions.",
      span: "col-span-12 md:col-span-4",
      color: "from-rose-500 to-pink-400",
    },
    {
      icon: Sparkles,
      title: "Growth Strategist",
      description: "Your personal AI coach for channel optimization and growth tactics.",
      span: "col-span-12 md:col-span-4",
      color: "from-primary to-accent",
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gridRef.current?.querySelectorAll(".feature-card");
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 60, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            stagger: { amount: 0.8, from: "start" },
            ease: "power3.out",
            scrollTrigger: {
              trigger: gridRef.current,
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
    <section ref={sectionRef} id="features" className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 aurora-bg opacity-50" />
      <div className="absolute inset-0 noise pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm font-medium mb-6"
          >
            <Target className="h-4 w-4 text-primary" />
            Powerful Features
          </motion.span>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Everything to
            <br />
            <span className="gradient-text">Dominate YouTube</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A complete suite of AI tools designed to help you grow faster, create better content, and maximize your channel's potential.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div ref={gridRef} className="grid grid-cols-12 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`feature-card ${feature.span} group`}
            >
              <div className={`glass rounded-3xl p-6 h-full relative overflow-hidden transition-all duration-500 hover:border-primary/40 ${feature.featured ? 'min-h-[200px]' : ''}`}>
                {/* Gradient Overlay on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                
                <div className="relative z-10">
                  {/* Icon */}
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${feature.color} mb-4`}
                  >
                    <feature.icon className="h-6 w-6 text-white" />
                  </motion.div>

                  {/* Content */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;