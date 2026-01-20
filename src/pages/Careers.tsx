import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Youtube, Sparkles, ArrowLeft, MapPin, Clock, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Careers = () => {
  const positions = [
    {
      title: "Senior Full-Stack Engineer",
      department: "Engineering",
      location: "Remote",
      type: "Full-time",
      description: "Build and scale our AI-powered platform used by thousands of YouTube creators.",
    },
    {
      title: "Machine Learning Engineer",
      department: "AI/ML",
      location: "Remote",
      type: "Full-time",
      description: "Develop and improve our content analysis and recommendation algorithms.",
    },
    {
      title: "Product Designer",
      department: "Design",
      location: "Remote",
      type: "Full-time",
      description: "Create intuitive and beautiful experiences for our creator community.",
    },
    {
      title: "Content Marketing Manager",
      department: "Marketing",
      location: "Remote",
      type: "Full-time",
      description: "Develop content strategies that resonate with YouTube creators worldwide.",
    },
    {
      title: "Customer Success Manager",
      department: "Customer Success",
      location: "Remote",
      type: "Full-time",
      description: "Help creators get the most out of TubeGrow and achieve their growth goals.",
    },
  ];

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

          {/* Open Positions */}
          <h2 className="font-display text-2xl font-bold mb-6">Open Positions</h2>
          <div className="space-y-4">
            {positions.map((position, index) => (
              <motion.div
                key={position.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-6 hover:border-primary/30 transition-colors cursor-pointer"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{position.title}</h3>
                      <Badge variant="secondary">{position.department}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {position.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{position.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{position.type}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Apply Now
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Contact */}
          <div className="glass rounded-xl p-8 text-center mt-12">
            <Briefcase className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold mb-2">Don't See Your Role?</h2>
            <p className="text-muted-foreground mb-4">
              We're always looking for talented people. Send us your resume!
            </p>
            <a href="mailto:careers@tubegrow.com">
              <Button variant="hero">
                Send Your Resume
              </Button>
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Careers;