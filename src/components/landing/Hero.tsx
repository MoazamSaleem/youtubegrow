import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, Star } from "lucide-react";
import gsap from "gsap";

const Hero = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const orbsRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    if (!orbsRef.current) return;
    
    const orbs = orbsRef.current.querySelectorAll(".orb");
    orbs.forEach((orb, i) => {
      gsap.to(orb, {
        x: `random(-100, 100)`,
        y: `random(-100, 100)`,
        duration: `random(15, 25)`,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: i * 0.5,
      });
    });
  }, []);

  const stats = [
    { value: "50K+", label: "Active Creators" },
    { value: "2.5B", label: "Views Generated" },
    { value: "4.9", label: "User Rating", icon: Star },
  ];

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 aurora-bg" />
      <div className="absolute inset-0 noise pointer-events-none" />
      
      {/* Floating Orbs */}
      <div ref={orbsRef} className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="orb absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/20 blur-[100px]" />
        <div className="orb absolute top-1/2 right-1/3 w-[300px] h-[300px] rounded-full bg-primary/15 blur-[80px]" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      <motion.div style={{ y, opacity }} className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-primary/20 mb-8"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI-Powered YouTube Growth Platform</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.95] mb-6 tracking-tight"
          >
            Scale Your
            <br />
            <span className="gradient-text text-glow">YouTube Empire</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Unlock AI-driven analytics, viral topic ideas, and growth strategies
            that help creators 10x their channel performance.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button variant="glow" size="xl" asChild className="group min-w-[220px]">
              <Link to="/signup">
                Start Free Trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="glass" size="lg" className="group gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <Play className="h-4 w-4 text-primary fill-primary" />
              </div>
              Watch Demo
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-8 sm:gap-16"
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {stat.icon && <stat.icon className="h-5 w-5 text-warning fill-warning" />}
                  <span className="font-display text-3xl sm:text-4xl font-bold">{stat.value}</span>
                </div>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Bento Preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 max-w-6xl mx-auto"
        >
          <div className="grid grid-cols-12 gap-4">
            {/* Main Dashboard Card */}
            <motion.div
              whileHover={{ y: -5 }}
              className="col-span-12 lg:col-span-8 glass rounded-3xl p-6 border-glow"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/70" />
                  <div className="w-3 h-3 rounded-full bg-warning/70" />
                  <div className="w-3 h-3 rounded-full bg-success/70" />
                </div>
                <span className="text-xs text-muted-foreground ml-2">Analytics Dashboard</span>
              </div>
              
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Views", value: "2.4M", change: "+23%" },
                  { label: "Subscribers", value: "45.2K", change: "+12%" },
                  { label: "Watch Time", value: "156K hrs", change: "+18%" },
                  { label: "Revenue", value: "$12,450", change: "+31%" },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                    className="bg-secondary/50 rounded-2xl p-4"
                  >
                    <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                    <p className="font-display text-xl font-bold">{stat.value}</p>
                    <p className="text-xs text-success font-medium">{stat.change}</p>
                  </motion.div>
                ))}
              </div>

              {/* Chart Placeholder */}
              <div className="h-40 bg-secondary/30 rounded-2xl flex items-end p-4 gap-2">
                {Array.from({ length: 24 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${20 + Math.random() * 70}%` }}
                    transition={{ delay: 0.8 + i * 0.03, duration: 0.5 }}
                    className="flex-1 bg-gradient-to-t from-primary/60 to-primary rounded-t"
                  />
                ))}
              </div>
            </motion.div>

            {/* Side Cards */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <motion.div
                whileHover={{ y: -3 }}
                className="glass rounded-3xl p-5 border-glow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">AI Suggestions</p>
                    <p className="text-xs text-muted-foreground">5 new ideas</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {["Viral topic detected", "Trending keyword alert", "Optimal upload time"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -3 }}
                className="glass rounded-3xl p-5 border-glow"
              >
                <p className="text-xs text-muted-foreground mb-3">Growth Score</p>
                <div className="flex items-end gap-2">
                  <span className="font-display text-4xl font-bold gradient-text">92</span>
                  <span className="text-success text-sm font-medium mb-1">+8 this week</span>
                </div>
                <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "92%" }}
                    transition={{ delay: 1, duration: 1 }}
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;