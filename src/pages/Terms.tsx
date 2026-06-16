import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Youtube, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
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

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 20, 2026</p>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="font-display text-2xl font-bold mb-4">1. Agreement to Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using YouTube Growth Planner, you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground">
                YouTube Growth Planner is an AI-powered YouTube growth platform that provides analytics, content suggestions, 
                keyword research, thumbnail generation, and other tools to help creators grow their channels.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">3. User Accounts</h2>
              <p className="text-muted-foreground mb-4">When creating an account, you agree to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Promptly notify us of any unauthorized access</li>
                <li>Be responsible for all activities under your account</li>
                <li>Not share your account with others</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">4. Subscription and Payments</h2>
              <p className="text-muted-foreground mb-4">
                YouTube Growth Planner offers various subscription plans. By subscribing, you agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Pay the applicable fees for your chosen plan</li>
                <li>Provide valid payment information</li>
                <li>Automatic renewal unless cancelled before the renewal date</li>
                <li>No refunds for partial subscription periods</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">5. Acceptable Use</h2>
              <p className="text-muted-foreground mb-4">You agree NOT to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Use the service for any illegal purpose</li>
                <li>Violate any third-party rights, including YouTube's Terms of Service</li>
                <li>Attempt to reverse engineer or hack our systems</li>
                <li>Use automated systems to access our service without permission</li>
                <li>Resell or redistribute our services</li>
                <li>Upload malicious code or interfere with our systems</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">6. YouTube API</h2>
              <p className="text-muted-foreground">
                Our service uses the YouTube API. By using YouTube Growth Planner, you also agree to be bound by 
                YouTube's Terms of Service (youtube.com/t/terms) and Google's Privacy Policy 
                (google.com/policies/privacy).
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">7. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, features, and functionality of YouTube Growth Planner are owned by us and protected by 
                intellectual property laws. You may not copy, modify, distribute, or create derivative 
                works without our express permission.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">8. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground">
                YouTube Growth Planner is provided "as is" without warranties of any kind. We do not guarantee 
                specific results or that the service will be uninterrupted or error-free.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">9. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, YouTube Growth Planner shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">10. Termination</h2>
              <p className="text-muted-foreground">
                We may terminate or suspend your account at any time for violations of these terms. 
                Upon termination, your right to use the service ceases immediately.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">11. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these terms from time to time. We will notify you of any material changes 
                via email or through the service. Continued use after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">12. Contact</h2>
              <p className="text-muted-foreground">
                For questions about these Terms, please contact us through our contact page.
              </p>
              <Link to="/contact" className="text-primary mt-2 inline-block hover:underline">/contact</Link>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Terms;
