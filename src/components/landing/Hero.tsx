import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Star, CheckCircle2, TrendingUp, Users, Zap } from "lucide-react";

const Hero = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const stats = [
    { value: "50K+", label: "Creators", icon: Users },
    { value: "2.5B", label: "Views Generated", icon: TrendingUp },
    { value: "4.9", label: "Rating", icon: Star },
  ];

  const features = [
    "AI-powered analytics",
    "Viral topic finder",
    "Competitor tracking",
  ];

  return (
    <section
      ref={containerRef}
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16 sm:pt-20"
    >
      {/* Background */}
      <div className="absolute inset-0 hero-bg" />
      <div className="absolute inset-0 grid-pattern opacity-40" />
      
      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ y: [-20, 20, -20] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-[10%] w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/40"
        />
        <motion.div
          animate={{ y: [20, -20, 20] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 right-[15%] w-2 h-2 sm:w-4 sm:h-4 rounded-full bg-accent/40"
        />
        <motion.div
          animate={{ y: [-15, 15, -15] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/3 left-[20%] w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary/30"
        />
      </div>

      <motion.div style={{ y, opacity }} className="container-tight relative z-10 py-8 sm:py-12 lg:py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border-primary/20 mb-6 sm:mb-8"
          >
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium">AI-Powered YouTube Growth</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-4 sm:mb-6 tracking-tight px-2"
          >
            Grow Your YouTube
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            <span className="gradient-text">10x Faster</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed px-4"
          >
            AI analytics, viral topics, and growth strategies that help creators 
            scale their channels smarter, not harder.
          </motion.p>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 px-4"
          >
            {features.map((feature, i) => (
              <div 
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/50 text-xs sm:text-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                {feature}
              </div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-16 px-4"
          >
            <Button variant="glow" size="lg" asChild className="w-full sm:w-auto min-w-[200px] h-12 sm:h-13 text-base group">
              <Link to="/signup">
                Start Free Trial
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 sm:h-13 text-base gap-2">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10">
                <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary fill-primary ml-0.5" />
              </div>
              Watch Demo
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-3 gap-4 sm:gap-8 max-w-md sm:max-w-lg mx-auto px-4"
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                  {stat.icon === Star && <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-warning fill-warning" />}
                  <span className="font-display text-xl sm:text-3xl font-bold">{stat.value}</span>
                </div>
                <span className="text-[10px] sm:text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 sm:mt-16 lg:mt-20 max-w-5xl mx-auto px-2 sm:px-0"
        >
          <div className="relative">
            {/* Glow effect behind */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent blur-3xl -z-10" />
            
            <div className="glass rounded-xl sm:rounded-2xl lg:rounded-3xl p-3 sm:p-4 lg:p-6 border-primary/10">
              {/* Window Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 lg:mb-6">
                <div className="flex gap-1 sm:gap-1.5">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-destructive/60" />
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-warning/60" />
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-success/60" />
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground ml-2">Analytics Dashboard</span>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 lg:mb-6">
                {[
                  { label: "Views", value: "2.4M", change: "+23%" },
                  { label: "Subscribers", value: "45.2K", change: "+12%" },
                  { label: "Watch Time", value: "156K hrs", change: "+18%" },
                  { label: "Revenue", value: "$12,450", change: "+31%" },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + i * 0.05 }}
                    className="bg-secondary/40 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4"
                  >
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">{stat.label}</p>
                    <p className="font-display text-sm sm:text-lg lg:text-xl font-bold">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-success font-medium">{stat.change}</p>
                  </motion.div>
                ))}
              </div>

              {/* Chart */}
              <div className="h-24 sm:h-32 lg:h-40 bg-secondary/30 rounded-lg sm:rounded-xl flex items-end p-2 sm:p-3 lg:p-4 gap-1 sm:gap-1.5 lg:gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${25 + Math.random() * 65}%` }}
                    transition={{ delay: 0.7 + i * 0.03, duration: 0.4 }}
                    className="flex-1 bg-gradient-to-t from-primary/50 to-primary rounded-t sm:rounded-t-sm"
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
