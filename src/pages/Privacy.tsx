import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Youtube, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacy = () => {
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
          <h1 className="font-display text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 20, 2026</p>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="font-display text-2xl font-bold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground">
                Welcome to YouTube Growth Planner ("we," "our," or "us"). We are committed to protecting your personal information 
                and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard 
                your information when you use our platform.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">2. Information We Collect</h2>
              <p className="text-muted-foreground mb-4">We collect information in the following ways:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Account Information:</strong> Name, email address, and password when you create an account</li>
                <li><strong>YouTube Data:</strong> Channel analytics and video data when you connect your YouTube channel</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through Stripe</li>
                <li><strong>Usage Data:</strong> How you interact with our platform to improve our services</li>
                <li><strong>Device Information:</strong> Browser type, IP address, and device identifiers</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">We use your information to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Provide and maintain our services</li>
                <li>Analyze your YouTube channel and provide growth insights</li>
                <li>Process payments and manage your subscription</li>
                <li>Send you updates and marketing communications (with your consent)</li>
                <li>Improve and personalize your experience</li>
                <li>Detect and prevent fraud and abuse</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">4. Data Sharing</h2>
              <p className="text-muted-foreground">
                We do not sell your personal information. We may share your data with trusted third parties only 
                to provide our services, such as payment processors (Stripe), cloud hosting providers, and 
                analytics services. All third parties are contractually obligated to protect your information.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures to protect your data, including encryption 
                in transit and at rest, secure authentication, and regular security audits. However, no method 
                of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">6. Your Rights</h2>
              <p className="text-muted-foreground mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Access and receive a copy of your personal data</li>
                <li>Correct inaccurate personal data</li>
                <li>Request deletion of your personal data</li>
                <li>Object to processing of your personal data</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">7. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information only as long as necessary to provide our services and 
                fulfill the purposes outlined in this policy. When you delete your account, we will delete 
                or anonymize your data within 30 days.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold mb-4">8. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <p className="text-primary mt-2">privacy@youtubegrowth.cloud</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Privacy;
