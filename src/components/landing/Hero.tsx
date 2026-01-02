import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, TrendingUp, Users, Zap } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const stats = [
    { icon: Users, value: "50K+", label: "Creators" },
    { icon: TrendingUp, value: "2.5B", label: "Views Generated" },
    { icon: Zap, value: "85%", label: "Growth Rate" },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8 }
      )
        .fromTo(
          headlineRef.current,
          { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: 1 },
          "-=0.4"
        )
        .fromTo(
          sublineRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8 },
          "-=0.5"
        )
        .fromTo(
          ctaRef.current?.children ?? [],
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, stagger: 0.15, duration: 0.6 },
          "-=0.4"
        )
        .fromTo(
          statsRef.current?.children ?? [],
          { opacity: 0, y: 20, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, stagger: 0.1, duration: 0.5 },
          "-=0.3"
        );

      // Preview animation with scroll trigger
      gsap.fromTo(
        previewRef.current,
        { opacity: 0, y: 100, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.2,
          ease: "power2.out",
          scrollTrigger: {
            trigger: previewRef.current,
            start: "top 85%",
            end: "top 50%",
            scrub: 1,
          },
        }
      );

      // Parallax effect on scroll
      gsap.to(headlineRef.current, {
        y: -50,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center pt-20 lg:pt-24 overflow-hidden"
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.1),transparent_50%)]" />

      {/* Animated Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div
            ref={badgeRef}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-sm text-muted-foreground">
              Powered by <span className="text-primary font-medium">Advanced AI</span>
            </span>
          </div>

          {/* Main Headline */}
          <h1
            ref={headlineRef}
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6"
          >
            Grow Your YouTube
            <br />
            <span className="gradient-text">Channel Faster</span>
          </h1>

          {/* Subheadline */}
          <p
            ref={sublineRef}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            AI-powered analytics, keyword research, and growth strategies tailored
            specifically for your channel. Join 50,000+ creators scaling their audience.
          </p>

          {/* CTA Buttons */}
          <div
            ref={ctaRef}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button variant="hero" size="xl" asChild className="group">
              <Link to="/signup">
                Start Free Trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="glass" size="lg" className="group">
              <Play className="h-4 w-4 transition-transform group-hover:scale-110" />
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div
            ref={statsRef}
            className="grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="flex justify-center mb-2">
                  <stat.icon className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                </div>
                <div className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard Preview */}
        <div ref={previewRef} className="mt-16 lg:mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <div className="glass rounded-2xl lg:rounded-3xl p-2 glow max-w-5xl mx-auto">
            <div className="bg-card rounded-xl lg:rounded-2xl overflow-hidden border border-border/50">
              {/* Mock Dashboard Header */}
              <div className="flex items-center gap-2 p-3 lg:p-4 border-b border-border bg-secondary/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-full bg-secondary text-xs text-muted-foreground">
                    dashboard.tubegrow.ai
                  </div>
                </div>
              </div>

              {/* Mock Dashboard Content */}
              <div className="p-4 lg:p-6 bg-gradient-to-b from-card to-background">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
                  {[
                    { label: "Total Views", value: "2.4M", change: "+12.5%", positive: true },
                    { label: "Watch Time", value: "156K hrs", change: "+8.3%", positive: true },
                    { label: "Subscribers", value: "45.2K", change: "+22.1%", positive: true },
                    { label: "Revenue", value: "$12,450", change: "+15.7%", positive: true },
                  ].map((stat, index) => (
                    <div key={index} className="glass rounded-lg p-3 lg:p-4">
                      <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                      <p className="font-display text-lg lg:text-xl font-bold">{stat.value}</p>
                      <p className={`text-xs ${stat.positive ? 'text-success' : 'text-destructive'}`}>
                        {stat.change}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Mock Chart Area */}
                <div className="glass rounded-lg p-4 h-32 lg:h-48 flex items-end justify-between gap-1 lg:gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-primary/60 to-primary rounded-t transition-all hover:from-primary/80 hover:to-primary"
                      style={{ height: `${30 + Math.random() * 60}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;