import { useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Pricing from "@/components/landing/Pricing";
import Footer from "@/components/landing/Footer";

const Landing = () => {
  useEffect(() => {
    document.title = "YouTube Growth Partner - AI Tools for YouTube Analytics, Keywords, Scripts & Thumbnails";

    const setMeta = (selector: string, content: string, attr: "name" | "property" = "name") => {
      const tag = document.head.querySelector(`meta[${attr}='${selector}']`);
      if (tag) {
        tag.setAttribute("content", content);
      }
    };

    setMeta(
      "description",
      "Grow your YouTube channel with AI-powered keyword research, competitor analysis, title and thumbnail generation, script writing, and creator growth tasks. Built for creators who want faster, data-driven growth."
    );
    setMeta(
      "og:title",
      "YouTube Growth Partner - AI Tools for YouTube Analytics, Keywords, Scripts & Thumbnails",
      "property"
    );
    setMeta(
      "og:description",
      "All-in-one AI YouTube growth platform for creators: research keywords, analyze channels, generate scripts and thumbnails, and scale performance with actionable insights.",
      "property"
    );
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />

      <section className="container mx-auto px-4 py-14 lg:py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
              AI YouTube Growth Platform for Serious Creators
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              YouTube Growth Partner helps creators plan content, improve discoverability, and increase channel performance with practical AI workflows. Use keyword research to identify high-opportunity topics, analyze competitors to spot content gaps, generate stronger scripts and titles, and create attention-grabbing thumbnails that improve click-through rates.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xl sm:text-2xl font-semibold mb-3">
              What You Can Do
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Research YouTube keywords, generate topic ideas, build video scripts, create thumbnails, run channel and competitor analysis, and track growth tasks in one dashboard. This structure helps creators move from idea to publish-ready content faster while keeping strategy consistent across uploads.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xl sm:text-2xl font-semibold mb-3">
              Who It Is For
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              This platform is built for new creators, growing channels, and creator teams that want data-backed decisions without complex tooling. Whether your niche is tech, finance, gaming, education, or lifestyle, the workflow is designed to support sustainable channel growth.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
