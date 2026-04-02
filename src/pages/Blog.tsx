import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Youtube, Sparkles, ArrowLeft, Calendar, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Blog = () => {
  const posts = [
    {
      title: "10 YouTube SEO Tips for 2026",
      excerpt: "Learn the latest strategies to optimize your videos for search and get discovered by new viewers.",
      category: "SEO",
      date: "Jan 15, 2026",
      readTime: "8 min read",
      image: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800&auto=format&fit=crop&q=60",
    },
    {
      title: "How to Create Thumbnails That Convert",
      excerpt: "Discover the psychology behind high-CTR thumbnails and how to create them for your channel.",
      category: "Design",
      date: "Jan 12, 2026",
      readTime: "6 min read",
      image: "https://images.unsplash.com/photo-1626544827763-d516dce335e2?w=800&auto=format&fit=crop&q=60",
    },
    {
      title: "Understanding YouTube's Algorithm in 2026",
      excerpt: "An in-depth look at how YouTube recommends videos and how to work with the algorithm.",
      category: "Strategy",
      date: "Jan 10, 2026",
      readTime: "12 min read",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60",
    },
    {
      title: "Building a Content Calendar That Works",
      excerpt: "Learn how to plan your content strategy for maximum growth and consistency.",
      category: "Planning",
      date: "Jan 8, 2026",
      readTime: "7 min read",
      image: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=60",
    },
    {
      title: "The Power of Community Tab",
      excerpt: "How to use YouTube's Community tab to engage with your audience between uploads.",
      category: "Engagement",
      date: "Jan 5, 2026",
      readTime: "5 min read",
      image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=60",
    },
    {
      title: "Monetization Strategies Beyond AdSense",
      excerpt: "Explore alternative revenue streams to diversify your income as a creator.",
      category: "Monetization",
      date: "Jan 3, 2026",
      readTime: "10 min read",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=60",
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

      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl font-bold mb-4">YouTube Growth Planner Blog</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tips, strategies, and insights from YouTube Growth Planner to help you grow your YouTube channel
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, index) => (
              <motion.article
                key={post.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl overflow-hidden group cursor-pointer"
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <Badge variant="secondary" className="mb-3">
                    {post.category}
                  </Badge>
                  <h2 className="font-display text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>{post.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Load More Articles
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Blog;
