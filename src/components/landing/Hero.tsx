import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, TrendingUp, Users, Zap } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  const stats = [
    { icon: Users, value: "50K+", label: "Creators" },
    { icon: TrendingUp, value: "2.5B", label: "Views Generated" },
    { icon: Zap, value: "85%", label: "Growth Rate" },
  ];

  const categories = [
    { name: "Analytics", href: "#features" },
    { name: "AI Tools", href: "#features" },
    { name: "Keywords", href: "#features" },
    { name: "Scripts", href: "#features" },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax on preview card
      gsap.fromTo(
        previewRef.current,
        { y: 80 },
        {
          y: -40,
          scrollTrigger: {
            trigger: previewRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5,
          },
        }
      );

      // Floating elements animation
      if (floatingRef.current) {
        const floaters = floatingRef.current.querySelectorAll(".floater");
        floaters.forEach((el, i) => {
          gsap.to(el, {
            y: "random(-20, 20)",
            x: "random(-10, 10)",
            rotation: "random(-5, 5)",
            duration: "random(3, 5)",
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: i * 0.2,
          });
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center pt-24 lg:pt-28 pb-20 overflow-hidden"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 gradient-mesh opacity-60" />
      
      {/* Floating Decorative Elements */}
      <div ref={floatingRef} className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floater absolute top-20 left-[10%] w-64 h-64 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 blur-3xl" />
        <div className="floater absolute top-40 right-[15%] w-48 h-48 rounded-full bg-gradient-to-br from-accent/20 to-primary/10 blur-3xl" />
        <div className="floater absolute bottom-32 left-[20%] w-56 h-56 rounded-full bg-gradient-to-br from-primary/15 to-transparent blur-3xl" />
        <div className="floater absolute bottom-20 right-[25%] w-40 h-40 rounded-full bg-gradient-to-br from-accent/15 to-transparent blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_60%)]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-sm text-muted-foreground font-medium">
              Powered by Advanced AI
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            variants={itemVariants}
            transition={{ duration: 0.7 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.1] mb-6 tracking-tight"
          >
            Your Smart Gateway to
            <br />
            <span className="gradient-text font-semibold">YouTube Growth</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            transition={{ duration: 0.6 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            AI-powered analytics, keyword research, and growth strategies tailored
            specifically for your channel. Join 50,000+ creators.
          </motion.p>

          {/* Category Pills */}
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-10"
          >
            {categories.map((cat, i) => (
              <motion.a
                key={cat.name}
                href={cat.href}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="px-5 py-2.5 rounded-full border border-border bg-card/50 backdrop-blur-sm text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors duration-300"
              >
                {cat.name}
              </motion.a>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Button variant="hero" size="lg" asChild className="group min-w-[200px]">
                <Link to="/signup">
                  Get Started Free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Button variant="glass" size="lg" className="group min-w-[200px]">
                <Play className="h-4 w-4 transition-transform group-hover:scale-110" />
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-3 gap-6 sm:gap-10 max-w-md mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="text-center group cursor-default"
              >
                <div className="flex justify-center mb-2">
                  <div className="p-2.5 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                </div>
                <div className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          ref={previewRef}
          className="mt-16 lg:mt-24 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none h-[120%] -top-[10%]" />
          
          <motion.div
            whileHover={{ y: -5 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="glass rounded-3xl p-3 max-w-5xl mx-auto shadow-2xl hover:shadow-primary/10"
          >
            <div className="bg-card rounded-2xl overflow-hidden border border-border/50">
              {/* Browser Header */}
              <div className="flex items-center gap-2 p-4 border-b border-border bg-secondary/30">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive/70 hover:bg-destructive transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-warning/70 hover:bg-warning transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-success/70 hover:bg-success transition-colors" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1.5 rounded-full bg-secondary text-xs text-muted-foreground font-medium">
                    dashboard.tubegrow.ai
                  </div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="p-5 lg:p-8 bg-gradient-to-b from-card to-secondary/20">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total Views", value: "2.4M", change: "+12.5%" },
                    { label: "Watch Time", value: "156K hrs", change: "+8.3%" },
                    { label: "Subscribers", value: "45.2K", change: "+22.1%" },
                    { label: "Revenue", value: "$12,450", change: "+15.7%" },
                  ].map((stat, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="glass rounded-2xl p-4 cursor-default"
                    >
                      <p className="text-xs text-muted-foreground mb-1 font-medium">
                        {stat.label}
                      </p>
                      <p className="font-display text-xl lg:text-2xl font-semibold">
                        {stat.value}
                      </p>
                      <p className="text-xs font-medium text-success">{stat.change}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Chart */}
                <div className="glass rounded-2xl p-5 h-36 lg:h-48 flex items-end justify-between gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${30 + Math.random() * 60}%` }}
                      transition={{ delay: 1 + i * 0.05, duration: 0.8, ease: "easeOut" }}
                      whileHover={{ scaleY: 1.1 }}
                      className="flex-1 bg-gradient-to-t from-primary/50 to-primary rounded-t-lg origin-bottom"
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;