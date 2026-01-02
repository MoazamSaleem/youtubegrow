import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Twitter, Instagram, Linkedin, Youtube, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Footer = () => {
  const links = {
    Product: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "Changelog", href: "#" },
      { name: "API", href: "#" },
    ],
    Company: [
      { name: "About", href: "#" },
      { name: "Blog", href: "#" },
      { name: "Careers", href: "#" },
      { name: "Contact", href: "#" },
    ],
    Legal: [
      { name: "Privacy", href: "#" },
      { name: "Terms", href: "#" },
      { name: "Cookies", href: "#" },
    ],
  };

  const socials = [
    { icon: Twitter, href: "#" },
    { icon: Instagram, href: "#" },
    { icon: Linkedin, href: "#" },
    { icon: Youtube, href: "#" },
  ];

  return (
    <footer className="border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 aurora-bg opacity-20" />
      
      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto border-glow"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ready to <span className="gradient-text">Explode Your Growth?</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of creators who are already scaling their channels with TubeGrow.
          </p>
          <Button variant="glow" size="lg" asChild>
            <Link to="/signup">
              Start Free Trial
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 pb-12 relative z-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl">
                Tube<span className="gradient-text">Grow</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">
              AI-powered YouTube growth platform helping creators scale to millions.
            </p>
            <div className="flex gap-2">
              {socials.map((s, i) => (
                <motion.a
                  key={i}
                  href={s.href}
                  whileHover={{ y: -3 }}
                  className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <s.icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h4 className="font-display font-semibold mb-4">{title}</h4>
              <ul className="space-y-3">
                {items.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 TubeGrow. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made with ❤️ for YouTube creators
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;