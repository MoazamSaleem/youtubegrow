import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Youtube, Sparkles, ArrowLeft, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

const Careers = () => {
  const benefits = [
    "Competitive salary and equity",
    "100% remote work",
    "Unlimited PTO",
    "Health, dental, and vision insurance",
    "Home office stipend",
    "Learning & development budget",
    "Flexible hours",
    "Team retreats",
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
            <span className="font-display font-bold text-base sm:text-xl leading-tight">
              YouTube <span className="gradient-text">Growth Planner</span>
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

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl font-bold mb-4">Join Our Team</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Help us empower creators worldwide to grow their YouTube channels with AI
            </p>
          </div>

          {/* Benefits */}
          <div className="glass rounded-xl p-8 mb-12">
            <h2 className="font-display text-2xl font-bold mb-6 text-center">Why Work With Us</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="glass rounded-xl p-8 text-center">
            <Briefcase className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold mb-2">Future Opportunities</h2>
            <p className="text-muted-foreground mb-4">
              We are not listing active openings right now, but we are still happy to hear from strong candidates.
            </p>
            <Link to="/contact">
              <Button variant="hero">
                Contact Hiring Team
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Careers;
