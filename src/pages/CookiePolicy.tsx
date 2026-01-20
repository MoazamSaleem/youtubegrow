import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Youtube, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const CookiePolicy = () => {
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
          <h1 className="font-display text-4xl font-bold mb-2">Cookie Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 20, 2026</p>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="font-display text-2xl font-bold mb-4">What Are Cookies?</h2>
              <p className="text-muted-foreground">
                Cookies are small text files that are stored on your device when you visit a website. 
                They help the website remember your preferences and understand how you use the site.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">How We Use Cookies</h2>
              <p className="text-muted-foreground mb-4">TubeGrow uses cookies for the following purposes:</p>
              
              <div className="space-y-4">
                <div className="glass rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Essential Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    Required for the website to function properly. These include authentication cookies 
                    that keep you logged in and security cookies that protect your account.
                  </p>
                </div>
                
                <div className="glass rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Functional Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    Remember your preferences such as theme settings, language preferences, 
                    and other customizations to enhance your experience.
                  </p>
                </div>
                
                <div className="glass rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Analytics Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    Help us understand how visitors interact with our website. This data is used 
                    to improve our service and user experience. All data is anonymized.
                  </p>
                </div>
                
                <div className="glass rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Performance Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    Collect information about how you use our website to help us identify and fix 
                    issues, improve loading times, and optimize performance.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">Third-Party Cookies</h2>
              <p className="text-muted-foreground mb-4">
                We use services from trusted third parties that may set their own cookies:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Stripe:</strong> For secure payment processing</li>
                <li><strong>Google Analytics:</strong> For website analytics</li>
                <li><strong>YouTube API:</strong> For channel integration</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">Managing Cookies</h2>
              <p className="text-muted-foreground mb-4">
                You can control and manage cookies in several ways:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Most browsers allow you to view, delete, and block cookies</li>
                <li>You can set your browser to notify you when cookies are being set</li>
                <li>You can opt out of analytics cookies</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Note: Blocking essential cookies may affect the functionality of our service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">Cookie Duration</h2>
              <p className="text-muted-foreground">
                <strong>Session cookies:</strong> Deleted when you close your browser.<br />
                <strong>Persistent cookies:</strong> Remain until they expire or you delete them (typically 30 days to 1 year).
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">Updates to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Cookie Policy from time to time. Any changes will be posted on 
                this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about our use of cookies, please contact us at:
              </p>
              <p className="text-primary mt-2">privacy@tubegrow.com</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CookiePolicy;