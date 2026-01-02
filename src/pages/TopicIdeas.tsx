import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getPlanLimits } from "@/lib/planLimits";
import { supabase } from "@/integrations/supabase/client";
import {
  Lightbulb,
  Sparkles,
  Loader2,
  Copy,
  Check,
  BookmarkPlus,
  TrendingUp,
  Target,
  Clock,
} from "lucide-react";

interface Topic {
  title: string;
  description: string;
  whyItWorks: string;
  difficulty: "easy" | "medium" | "hard";
}

const TopicIdeas = () => {
  const navigate = useNavigate();
  const { user, subscription, loading } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [channelNiche, setChannelNiche] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const currentPlan = subscription?.plan || "free";
  const limits = getPlanLimits(currentPlan);

  const handleGenerate = async () => {
    if (!channelNiche.trim()) {
      toast({ title: "Please enter your channel niche", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-topics", {
        body: {
          channelNiche,
          channelDescription,
          targetAudience,
          count: Math.min(limits.topicsPerDay, 5),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTopics(data.topics || []);
      
      // Update usage
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("usage_tracking").upsert(
        {
          user_id: user?.id,
          date: today,
          topics_generated: (data.topics?.length || 0),
        },
        { onConflict: "user_id,date" }
      );

      toast({ title: "Topics generated successfully!" });
    } catch (error: any) {
      console.error("Error generating topics:", error);
      toast({
        title: "Failed to generate topics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: "Copied to clipboard!" });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "hard":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                <Lightbulb className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                AI Topic Ideas
              </h1>
            </div>
            <p className="text-muted-foreground">
              Get AI-powered video topic suggestions tailored to your channel ({limits.topicsPerDay} topics/day)
            </p>
          </motion.div>

          {/* Input Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Channel Niche <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g., Tech Reviews, Gaming, Cooking, Fitness..."
                  value={channelNiche}
                  onChange={(e) => setChannelNiche(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Channel Description
                </label>
                <Textarea
                  placeholder="Describe what your channel is about..."
                  value={channelDescription}
                  onChange={(e) => setChannelDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Target Audience
                </label>
                <Input
                  placeholder="e.g., Beginners, Professionals, Teenagers..."
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>

              <Button
                variant="hero"
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || !channelNiche.trim()}
                className="w-full sm:w-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Topics
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Results */}
          {topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Generated Topics
              </h2>

              {topics.map((topic, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="glass rounded-xl p-6 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-display font-semibold text-lg">
                      {topic.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={getDifficultyColor(topic.difficulty)}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {topic.difficulty}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(topic.title, index)}
                      >
                        {copiedIndex === index ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <p className="text-muted-foreground mb-3">{topic.description}</p>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">
                      <span className="font-medium text-primary">Why it works:</span>{" "}
                      {topic.whyItWorks}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Empty State */}
          {topics.length === 0 && !isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">
                No topics generated yet
              </h3>
              <p className="text-muted-foreground">
                Enter your channel details above and click generate to get AI-powered topic ideas
              </p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TopicIdeas;
