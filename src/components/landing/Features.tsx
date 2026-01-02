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
  Image,
  Target,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const Features = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const features = [
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Track views, retention, watch time, and revenue with live updates.",
    },
    {
      icon: Brain,
      title: "AI Channel Analysis",
      description: "Deep analysis with actionable, authentic strategies for growth.",
    },
    {
      icon: Search,
      title: "Keyword Research",
      description: "Discover high-ranking keywords tailored to your niche.",
    },
    {
      icon: Lightbulb,
      title: "Topic Suggestions",
      description: "AI-curated ideas based on your channel's niche and trends.",
    },
    {
      icon: Users,
      title: "Competitor Analysis",
      description: "Study competitor strategies and discover what works.",
    },
    {
      icon: Target,
      title: "Growth Roadmap",
      description: "Milestone-based growth tasks with goal celebrations.",
    },
    {
      icon: FileText,
      title: "AI Script Writer",
      description: "Generate engaging video scripts powered by advanced AI.",
    },
    {
      icon: Image,
      title: "Thumbnail Generator",
      description: "Create eye-catching thumbnails with AI assistance.",
    },
    {
      icon: Sparkles,
      title: "YouTube Strategist",
      description: "Personal AI strategist for channel growth optimization.",
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gridRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: "power2.out",
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const headerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <section ref={sectionRef} id="features" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh opacity-30" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <motion.span
            variants={headerVariants}
            className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            Features
          </motion.span>
          <motion.h2
            variants={headerVariants}
            className="font-display text-3xl sm:text-4xl md:text-5xl font-medium mb-4"
          >
            Everything You Need to
            <br />
            <span className="gradient-text font-semibold">Grow Your Channel</span>
          </motion.h2>
          <motion.p variants={headerVariants} className="text-muted-foreground text-lg">
            Powerful AI tools and analytics designed to accelerate your growth
          </motion.p>
        </motion.div>

        {/* Features Grid */}
        <div
          ref={gridRef}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative"
            >
              <div className="glass rounded-2xl p-6 h-full transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                {/* Icon */}
                <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 mb-4 group-hover:from-primary/20 group-hover:to-accent/20 transition-all">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>

                {/* Content */}
                <h3 className="font-display text-xl font-medium mb-2 text-foreground group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;