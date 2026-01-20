import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Youtube, Sparkles, ArrowLeft, Users, Target, Rocket, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Creator-First",
      description: "Every feature we build is designed with creators in mind. Your success is our priority.",
    },
    {
      icon: Rocket,
      title: "Innovation",
      description: "We leverage cutting-edge AI to give you insights that were previously only available to large studios.",
    },
    {
      icon: Users,
      title: "Community",
      description: "Join thousands of creators who support each other on the journey to YouTube success.",
    },
    {
      icon: Heart,
      title: "Passion",
      description: "We're creators too. We understand the challenges and celebrate every milestone with you.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative">
              <Youtube className="h-8 w-8 text-primary" />
              <Sparkles className="h-3 w-3 text-accent absolute -top-1 -right-1" />
            </div>
            <span className="font-display font-bold text-xl">
              Tube<span className="gradient-text">Grow</span>
            </span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-4xl font-bold mb-6">About TubeGrow</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-lg text-muted-foreground mb-8">
              TubeGrow is an AI-powered YouTube growth platform designed to help creators of all sizes 
              optimize their content strategy, understand their audience, and accelerate their channel growth.
            </p>

            <h2 className="font-display text-2xl font-bold mt-12 mb-4">Our Mission</h2>
            <p className="text-muted-foreground mb-8">
              We believe every creator deserves access to the same powerful analytics and AI tools 
              that large production companies use. Our mission is to democratize YouTube growth by 
              making advanced insights accessible, actionable, and affordable for everyone.
            </p>

            <h2 className="font-display text-2xl font-bold mt-12 mb-6">Our Values</h2>
            <div className="grid sm:grid-cols-2 gap-6 mb-12">
              {values.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass rounded-xl p-6"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <value.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                  <p className="text-muted-foreground text-sm">{value.description}</p>
                </motion.div>
              ))}
            </div>

            <h2 className="font-display text-2xl font-bold mt-12 mb-4">Our Story</h2>
            <p className="text-muted-foreground mb-4">
              TubeGrow was founded by a team of creators and engineers who experienced firsthand 
              the challenges of growing a YouTube channel. We spent countless hours analyzing trends, 
              researching keywords, and trying to understand what makes content succeed.
            </p>
            <p className="text-muted-foreground mb-8">
              We built TubeGrow to solve these problems - not just for ourselves, but for every 
              creator who dreams of building an audience and sharing their passion with the world.
            </p>

            <div className="glass rounded-xl p-8 text-center mt-12">
              <h2 className="font-display text-2xl font-bold mb-4">Ready to Grow?</h2>
              <p className="text-muted-foreground mb-6">
                Join thousands of creators using TubeGrow to accelerate their YouTube success.
              </p>
              <Link to="/signup">
                <Button variant="hero" size="lg">
                  Start Your Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default About;