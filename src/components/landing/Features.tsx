import { useEffect, useRef } from "react";
import { motion, Variants } from "framer-motion";
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
  const headerRef = useRef<HTMLDivElement>(null);

  const features = [
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Track views, retention, watch time, and revenue with live updates.",
      color: "from-blue-500/20 to-cyan-500/20",
    },
    {
      icon: Brain,
      title: "AI Channel Analysis",
      description: "Deep analysis with actionable, authentic strategies for growth.",
      color: "from-purple-500/20 to-pink-500/20",
    },
    {
      icon: Search,
      title: "Keyword Research",
      description: "Discover high-ranking keywords tailored to your niche.",
      color: "from-amber-500/20 to-orange-500/20",
    },
    {
      icon: Lightbulb,
      title: "Topic Suggestions",
      description: "AI-curated ideas based on your channel's niche and trends.",
      color: "from-yellow-500/20 to-amber-500/20",
    },
    {
      icon: Users,
      title: "Competitor Analysis",
      description: "Study competitor strategies and discover what works.",
      color: "from-green-500/20 to-emerald-500/20",
    },
    {
      icon: Target,
      title: "Growth Roadmap",
      description: "Milestone-based growth tasks with goal celebrations.",
      color: "from-red-500/20 to-rose-500/20",
    },
    {
      icon: FileText,
      title: "AI Script Writer",
      description: "Generate engaging video scripts powered by advanced AI.",
      color: "from-indigo-500/20 to-violet-500/20",
    },
    {
      icon: Image,
      title: "Thumbnail Generator",
      description: "Create eye-catching thumbnails with AI assistance.",
      color: "from-teal-500/20 to-cyan-500/20",
    },
    {
      icon: Sparkles,
      title: "YouTube Strategist",
      description: "Personal AI strategist for channel growth optimization.",
      color: "from-fuchsia-500/20 to-purple-500/20",
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Header parallax
      gsap.fromTo(
        headerRef.current,
        { y: 0 },
        {
          y: -30,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "top top",
            scrub: 1,
          },
        }
      );

      // Cards staggered reveal with 3D tilt effect
      const cards = gridRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 60, rotationX: 10 },
          {
            opacity: 1,
            y: 0,
            rotationX: 0,
            duration: 0.8,
            stagger: { amount: 0.6, from: "start" },
            ease: "power3.out",
            scrollTrigger: {
              trigger: gridRef.current,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const headerVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <section ref={sectionRef} id="features" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh opacity-30" />
      
      {/* Decorative blobs */}
      <div className="absolute top-20 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          variants={headerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            Features
          </motion.span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium mb-4">
            Everything You Need to
            <br />
            <span className="gradient-text font-semibold">Grow Your Channel</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Powerful AI tools and analytics designed to accelerate your growth
          </p>
        </motion.div>

        {/* Features Grid */}
        <div ref={gridRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group relative"
            >
              <div className="glass rounded-2xl p-6 h-full transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40 relative overflow-hidden">
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <div className="relative z-10">
                  {/* Icon */}
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 mb-4 group-hover:from-primary/20 group-hover:to-accent/20 transition-all"
                  >
                    <feature.icon className="h-6 w-6 text-primary" />
                  </motion.div>

                  {/* Content */}
                  <h3 className="font-display text-xl font-medium mb-2 text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed group-hover:text-foreground/80 transition-colors">
                    {feature.description}
                  </p>
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