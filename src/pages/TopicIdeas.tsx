import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getPlanLimits, canAccessFeature } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
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

interface ChannelAnalysisSummary {
  overallHealth?: { summary?: string };
  contentStrategy?: {
    contentPillars?: string[];
    trendingTopics?: string[];
  };
  audienceInsights?: {
    likelyDemographic?: string;
  };
}

interface RealtimeVideoContext {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  topicCategories?: string[];
  topicIds?: string[];
}

interface RealtimeChannelContext {
  channel?: {
    title?: string;
    description?: string;
    stats?: {
      subscriberCount?: number;
      viewCount?: number;
      videoCount?: number;
    } | null;
  };
  recentVideos?: RealtimeVideoContext[];
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
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelSnippet, setChannelSnippet] = useState<string>("");
  const [recentTitles, setRecentTitles] = useState<string[]>([]);
  const [channelAnalysis, setChannelAnalysis] = useState<ChannelAnalysisSummary | null>(null);
  const [realtimeContext, setRealtimeContext] = useState<RealtimeChannelContext | null>(null);
  const autoRunRef = useRef(false);

  const currentPlan = getActiveSubscriptionPlan(subscription);
  const limits = currentPlan ? getPlanLimits(currentPlan) : null;
  const canGenerateScript = canAccessFeature(currentPlan, "hasScriptWriter");

  const getSessionWithRefresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;
      if (!shouldRefresh) return session;
    }

    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) return refreshed.session;

    return null;
  };

  const fetchChannelContext = async (id: string) => {
    if (!user) return;
    const session = await getSessionWithRefresh();
    if (!session?.access_token) return;

    const { data, error } = await supabase.functions.invoke<RealtimeChannelContext>("youtube-oauth", {
      body: { action: "channel-context", channelId: id, userId: user.id },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (error) {
      console.error("Channel context error:", error);
      return;
    }

    setRealtimeContext(data ?? null);
    setChannelSnippet(data?.channel?.description || "");
    setRecentTitles((data?.recentVideos || []).map((v) => v.title || "").filter(Boolean));
  };

  const fetchChannelAnalysis = async (channelId: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("channel_analysis_results")
      .select("analysis")
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .maybeSingle();

    if (error) {
      console.error("Channel analysis fetch error:", error);
      return;
    }

    setChannelAnalysis((data?.analysis as ChannelAnalysisSummary) ?? null);
  };

  const buildAutoNiche = () => {
    const parts = [
      channelAnalysis?.overallHealth?.summary,
      channelAnalysis?.contentStrategy?.contentPillars?.length
        ? `Pillars: ${channelAnalysis.contentStrategy.contentPillars.join(", ")}`
        : undefined,
      channelAnalysis?.audienceInsights?.likelyDemographic
        ? `Audience: ${channelAnalysis.audienceInsights.likelyDemographic}`
        : undefined,
    ].filter(Boolean) as string[];

    const nicheValue = parts.join(" | ").trim();
    if (nicheValue) return nicheValue.slice(0, 200);
    if (channelSnippet) return channelSnippet.split(".")[0]?.slice(0, 120) || "";
    if (recentTitles.length > 0) return recentTitles[0].slice(0, 120);
    return "";
  };

  const buildAutoDescription = () => {
    const parts = [
      channelSnippet,
      recentTitles.length > 0 ? `Recent videos: ${recentTitles.join(", ")}` : "",
      channelAnalysis?.overallHealth?.summary ? `Channel summary: ${channelAnalysis.overallHealth.summary}` : "",
      channelAnalysis?.contentStrategy?.trendingTopics?.length
        ? `Trending topics: ${channelAnalysis.contentStrategy.trendingTopics.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    return parts.slice(0, 1800);
  };

  useEffect(() => {
    if (!user) return;
    const loadChannel = async () => {
      const { data } = await supabase
        .from("youtube_channels")
        .select("channel_id, channel_name, is_primary")
        .eq("user_id", user.id);
      if (data && data.length > 0) {
        const primary = data.find((c) => c.is_primary) || data[0];
        setChannelName(primary.channel_name || null);
        if (primary.channel_id) {
          await Promise.all([
            fetchChannelContext(primary.channel_id),
            fetchChannelAnalysis(primary.channel_id),
          ]);
        }
      }
    };
    loadChannel();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cacheKey = `topics_cache:${user.id}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return;
      const parsed = JSON.parse(cached) as { topics?: Topic[]; savedAt?: number };
      const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
      if (!savedAt || Date.now() - savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(cacheKey);
        return;
      }
      if (parsed.topics && parsed.topics.length > 0) {
        setTopics(parsed.topics);
      }
    } catch (error) {
      console.warn("Failed to load cached topics:", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cacheKey = `topics_cache:${user.id}`;
    if (topics.length === 0) {
      localStorage.removeItem(cacheKey);
      return;
    }
    localStorage.setItem(
      cacheKey,
      JSON.stringify({ topics, savedAt: Date.now() })
    );
  }, [user, topics]);

  useEffect(() => {
    if (autoRunRef.current || topics.length > 0) return;
    const autoNiche = buildAutoNiche();
    if (!autoNiche) return;
    autoRunRef.current = true;
    const descriptionBlock = buildAutoDescription();
    setChannelNiche(autoNiche);
    if (descriptionBlock) {
      setChannelDescription(descriptionBlock);
    }
    void handleGenerate(autoNiche, descriptionBlock);
  }, [channelSnippet, recentTitles, channelAnalysis, topics.length]);

  const handleGenerate = async (nicheOverride?: string, descriptionOverride?: string) => {
    const nicheValue = nicheOverride ?? channelNiche;
    if (!nicheValue.trim()) {
      toast({ title: "Please enter your channel niche", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const session = await getSessionWithRefresh();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const { data, error } = await supabase.functions.invoke("generate-topics", {
        body: {
          channelNiche: nicheValue,
          channelDescription: descriptionOverride ?? channelDescription,
          targetAudience,
          analysis: channelAnalysis,
          realtime: realtimeContext
            ? {
                ...realtimeContext,
                channel: realtimeContext.channel
                  ? { ...realtimeContext.channel, title: undefined }
                  : realtimeContext.channel,
              }
            : null,
          count: Math.min(limits.topicsPerDay, 5),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

  const handleGenerateScript = (topic: Topic) => {
    if (!canGenerateScript) {
      toast({
        title: "Upgrade Required",
        description: "Script Writer is available on Pro and Advanced plans",
        variant: "destructive",
      });
      return;
    }
    const encoded = encodeURIComponent(topic.title);
    navigate(`/dashboard/scripts?topic=${encoded}&auto=1`);
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

  if (!currentPlan || !limits) {
    return (
      <div className="min-h-screen bg-background flex">
        <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <SubscriptionRequiredState description="AI topic generation now requires an active Basic, Pro, or Advanced subscription." />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <div className="w-full">
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
                  placeholder={channelName ? "Search a different niche..." : "e.g., Tech Reviews, Gaming, Cooking, Fitness..."}
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
                onClick={() => handleGenerate()}
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

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateScript(topic)}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Script
                    </Button>
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
