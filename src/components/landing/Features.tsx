import { useEffect, useRef } from "react";
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
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const features = [
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description:
        "Track views, retention, watch time, and revenue with live updates. Filter by daily, weekly, or monthly data.",
      gradient: "from-primary to-primary/50",
    },
    {
      icon: Brain,
      title: "AI Channel Analysis",
      description:
        "Advanced AI powered deep analysis of your channel with actionable, authentic strategies for growth.",
      gradient: "from-accent to-accent/50",
    },
    {
      icon: Search,
      title: "Keyword Research",
      description:
        "Discover high-ranking keywords tailored to your niche. Up to unlimited searches on Advanced plan.",
      gradient: "from-warning to-warning/50",
    },
    {
      icon: Lightbulb,
      title: "Daily Topic Suggestions",
      description:
        "Get AI-curated topic ideas based on your channel's niche and current trends.",
      gradient: "from-primary to-accent",
    },
    {
      icon: Users,
      title: "Competitor Analysis",
      description:
        "Study competitor strategies, track their growth, and discover what works in your niche.",
      gradient: "from-accent to-success",
    },
    {
      icon: Target,
      title: "Growth Roadmap",
      description:
        "Follow milestone-based growth tasks with celebrations when you hit your goals.",
      gradient: "from-warning to-destructive",
    },
    {
      icon: FileText,
      title: "AI Script Writer",
      description:
        "Generate engaging video scripts powered by advanced AI. Available on Pro and Advanced plans.",
      gradient: "from-primary to-warning",
    },
    {
      icon: Image,
      title: "Thumbnail Generator",
      description:
        "Create eye-catching thumbnails with AI. Generate up to 5+ thumbnails daily.",
      gradient: "from-accent to-primary",
    },
    {
      icon: Sparkles,
      title: "YouTube Strategist",
      description:
        "Personal AI strategist designed specifically for YouTube channel growth. Advanced plan exclusive.",
      gradient: "from-warning to-accent",
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Header animation
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 80%",
            end: "top 50%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Feature cards stagger animation
      const cards = gridRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 60, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: gridRef.current,
              start: "top 75%",
              end: "top 25%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="features" className="py-20 lg:py-32 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.05),transparent_70%)]" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div ref={headerRef} className="text-center max-w-2xl mx-auto mb-12 lg:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Everything You Need to
            <br />
            <span className="gradient-text">Dominate YouTube</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Powerful AI tools and analytics designed to accelerate your channel's growth
          </p>
        </div>

        {/* Features Grid */}
        <div
          ref={gridRef}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6"
        >
          {features.map((feature, index) => (
            <div key={index} className="group">
              <div className="glass rounded-2xl p-6 h-full hover:bg-card/80 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
                {/* Icon */}
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 transition-transform group-hover:scale-110`}
                >
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;