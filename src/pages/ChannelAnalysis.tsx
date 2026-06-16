import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { canAccessFeature, getPlanLimits } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
import {
  Brain,
  Menu,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Youtube,
  BarChart3,
  Clock,
  Users,
  Play,
  Eye,
  Link2,
  ArrowRight,
  RefreshCw,
  Crown,
  Lock,
  MessageSquare,
} from "lucide-react";

interface YouTubeChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  thumbnail_url?: string;
  channel_thumbnail?: string;
}

interface ChannelAnalysisResult {
  overallHealth: {
    score: number;
    grade: string;
    summary: string;
  };
  metrics: {
    subscriberGrowthPotential: string;
    viewsPerVideoAverage: string;
    engagementEstimate: string;
    contentConsistency: string;
  };
  strengths: Array<{
    area: string;
    description: string;
    tips: string;
  }>;
  improvements: Array<{
    area: string;
    priority: string;
    currentState: string;
    recommendation: string;
    expectedImpact: string;
  }>;
  contentStrategy: {
    recommendedUploadFrequency: string;
    optimalVideoLength: string;
    contentPillars: string[];
    trendingTopics: string[];
    titleFormulas: string[];
  };
  audienceInsights: {
    likelyDemographic: string;
    peakPostingTimes: string;
    engagementTactics: string[];
  };
  growthOpportunities: Array<{
    opportunity: string;
    difficulty: string;
    timeline: string;
    howToExecute: string;
  }>;
  nextSteps: Array<{
    step: string;
    priority: number;
    description: string;
  }>;
  monetizationReadiness: {
    status: string;
    requirements: string;
    suggestions: string[];
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

const ChannelAnalysis = () => {
  const { user, subscription, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ChannelAnalysisResult | null>(null);
  const [niche, setNiche] = useState("");
  const [goals, setGoals] = useState("");
  const [lastAnalysisDate, setLastAnalysisDate] = useState<string | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [realtimeContext, setRealtimeContext] = useState<RealtimeChannelContext | null>(null);
  const selectedChannelParam = searchParams.get("channelId");
  const isTestUser = user?.email?.toLowerCase() === "moazamm.dev@gmail.com";

  const currentPlan = getActiveSubscriptionPlan(subscription);
  const hasAccess = isTestUser || canAccessFeature(currentPlan, "channelAnalysisFrequency");
  const planLimits = currentPlan
    ? getPlanLimits(currentPlan)
    : isTestUser
      ? getPlanLimits("advanced")
      : null;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchChannels();
      fetchLastAnalysis();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedChannelParam || channels.length === 0) return;
    const match = channels.find((channel) => channel.channel_id === selectedChannelParam);
    if (match) {
      setSelectedChannel(match);
    }
  }, [selectedChannelParam, channels]);

  useEffect(() => {
    if (!selectedChannel?.channel_id) return;
    if (selectedChannelParam === selectedChannel.channel_id) return;
    navigate(`/dashboard/analysis?channelId=${selectedChannel.channel_id}`, { replace: true });
  }, [selectedChannel?.channel_id, selectedChannelParam, navigate]);

  useEffect(() => {
    if (!user || !selectedChannel?.channel_id) return;
    setAnalysis(null);
    fetchSavedAnalysis(selectedChannel.channel_id);
  }, [user, selectedChannel?.channel_id]);

  const fetchChannels = async () => {
    if (!user) return;
    setChannelsLoading(true);
    
    const { data, error } = await supabase
      .from("youtube_channels")
      .select(
        "id, channel_id, channel_name, subscriber_count, view_count, video_count, thumbnail_url, channel_thumbnail, is_primary"
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching channels:", error);
    } else if (data && data.length > 0) {
      setChannels(data);
      setSelectedChannel((prev) => {
        const fromParam = selectedChannelParam
          ? data.find((channel) => channel.channel_id === selectedChannelParam)
          : null;
        if (fromParam) return fromParam;
        if (prev) {
          const existing = data.find((channel) => channel.id === prev.id);
          if (existing) return existing;
        }
        const primary = data.find((channel) => channel.is_primary) || data[0];
        return primary ?? null;
      });
    } else {
      setChannels([]);
      setSelectedChannel(null);
    }
    setChannelsLoading(false);
  };

  const fetchSavedAnalysis = async (channelId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("channel_analysis_results")
      .select("analysis, updated_at")
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .maybeSingle();

    if (error) {
      console.error("Error loading saved analysis:", error);
      return;
    }

    if (data?.analysis) {
      setAnalysis(data.analysis as ChannelAnalysisResult);
      if (data.updated_at) {
        setLastAnalysisDate(data.updated_at.split("T")[0]);
      }
    }
  };

  const fetchLastAnalysis = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("usage_tracking")
      .select("date, channel_analyses")
      .eq("user_id", user.id)
      .gt("channel_analyses", 0)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setLastAnalysisDate(data.date);
    }
  };

  const getSessionWithRefresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
    const shouldRefresh = !session?.access_token || (expiresAt > 0 && expiresAt - Date.now() < 60_000);

    if (shouldRefresh) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session?.access_token) return refreshed.session;
    }

    return session ?? null;
  };

  const fetchRealtimeContext = async (channelId: string) => {
    if (!user) return null;
    const session = await getSessionWithRefresh();
    if (!session?.access_token) return null;

    const { data, error } = await supabase.functions.invoke<RealtimeChannelContext>("youtube-oauth", {
      body: { action: "channel-context", channelId, userId: user.id },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (error) {
      console.error("Realtime context error:", error);
      return null;
    }
    return data ?? null;
  };

  const canAnalyze = () => {
    if (isTestUser) return true;
    if (planLimits.channelAnalysisFrequency === "unlimited") return true;
    if (planLimits.channelAnalysisFrequency === "never") return false;
    if (planLimits.channelAnalysisFrequency === "weekly") {
      if (!lastAnalysisDate) return true;
      const lastDate = new Date(lastAnalysisDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 7;
    }
    return true;
  };

  const handleAnalyze = async () => {
    if (!selectedChannel) {
      toast({
        title: "Select a channel",
        description: "Please select a channel to analyze",
        variant: "destructive",
      });
      return;
    }

    if (!canAnalyze()) {
      toast({
        title: "Analysis limit reached",
        description: `Your ${currentPlan} plan allows ${planLimits.channelAnalysisFrequency} channel analysis. Upgrade for more.`,
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const session = await getSessionWithRefresh();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }
      console.info("[ChannelAnalysis] Session ok", {
        hasToken: true,
        expiresAt: session.expires_at,
      });

      const realtime = await fetchRealtimeContext(selectedChannel.channel_id);
      if (realtime) {
        setRealtimeContext(realtime);
      }

      const realtimeStats = realtime?.channel?.stats;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-channel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId: selectedChannel.channel_id,
            channelName: selectedChannel.channel_name,
            subscriberCount: realtimeStats?.subscriberCount ?? selectedChannel.subscriber_count,
            viewCount: realtimeStats?.viewCount ?? selectedChannel.view_count,
            videoCount: realtimeStats?.videoCount ?? selectedChannel.video_count,
            realtime: realtime
              ? {
                  ...realtime,
                  channel: realtime.channel
                    ? { ...realtime.channel, title: undefined }
                    : realtime.channel,
                }
              : null,
            ...(channels.length === 0 ? { niche, goals } : {}),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze channel");
      }

      const data = await response.json();
      const analysisResult = data.analysis as ChannelAnalysisResult;
      setAnalysis(analysisResult);
      await supabase.from("channel_analysis_results").upsert(
        {
          user_id: user.id,
          channel_id: selectedChannel.channel_id,
          analysis: analysisResult,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,channel_id" }
      );
      setLastAnalysisDate(new Date().toISOString().split("T")[0]);
      
      toast({
        title: "Analysis Complete!",
        description: "Your channel insights are ready",
      });
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze channel",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "low":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "text-green-500";
      case "medium":
        return "text-yellow-500";
      case "hard":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 transition-all duration-300">
        {/* Header */}
        <header className="hidden lg:block sticky top-0 z-40 glass-strong border-b border-border px-4 lg:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-lg sm:text-xl font-bold">Channel Analysis</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">AI-powered insights for your channel</p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          {!hasAccess ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <SubscriptionRequiredState
                title={currentPlan ? "Unlock Channel Analysis" : "Active subscription required"}
                description={
                  currentPlan
                    ? "Get AI-powered insights to grow your channel. Available on Basic, Pro, and Advanced plans."
                    : "Channel Analysis now requires an active Basic, Pro, or Advanced subscription."
                }
              />
            </motion.div>
          ) : channelsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : channels.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full text-center py-16"
            >
              <div className="inline-flex p-6 rounded-3xl glass mb-8">
                <Youtube className="h-16 w-16 text-destructive" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-4">
                Connect Your YouTube Channel
              </h2>
              <p className="text-muted-foreground mb-8">
                Link your YouTube channel to get personalized AI-powered insights and growth recommendations.
              </p>
              <Button variant="hero" onClick={() => navigate("/dashboard/profile")}>
                <Link2 className="h-4 w-4 mr-2" />
                Connect Channel
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Channel Selection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-4 sm:p-6"
              >
                <h2 className="font-display text-lg font-bold mb-4">Select Channel to Analyze</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedChannel?.id === channel.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center overflow-hidden">
                          {channel.channel_thumbnail || channel.thumbnail_url ? (
                            <img 
                              src={channel.channel_thumbnail || channel.thumbnail_url} 
                              alt={channel.channel_name || "Channel"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Youtube className="h-6 w-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{channel.channel_name || "YouTube Channel"}</p>
                          <p className="text-sm text-muted-foreground">
                            {channel.subscriber_count?.toLocaleString() || 0} subs
                          </p>
                        </div>
                        {selectedChannel?.id === channel.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {channels.length === 0 && (
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-2">
                      <Label>Channel Niche (optional)</Label>
                      <Input
                        placeholder="e.g., Tech Reviews, Gaming, Cooking"
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Growth Goals (optional)</Label>
                      <Input
                        placeholder="e.g., Reach 10K subs, Get monetized"
                        value={goals}
                        onChange={(e) => setGoals(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Analyze Button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    {planLimits.channelAnalysisFrequency === "unlimited" ? (
                      <span className="text-primary font-medium">Unlimited analysis</span>
                    ) : planLimits.channelAnalysisFrequency === "weekly" ? (
                      <>
                        Analysis available: <span className={canAnalyze() ? "text-green-500" : "text-destructive"}>
                          {canAnalyze() ? "Ready" : "Next week"}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !selectedChannel || !canAnalyze()}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Analyze Channel
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>

              {/* Loading State */}
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <div className="relative">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                    <Brain className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="mt-4 text-muted-foreground">Analyzing your channel with AI...</p>
                  <p className="text-sm text-muted-foreground">This may take a moment</p>
                </motion.div>
              )}

              {/* Analysis Results */}
              {analysis && !isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Overall Health Score */}
                  <div className="glass rounded-2xl p-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                      <div className="relative">
                        <div className={`text-5xl sm:text-6xl font-display font-bold ${getScoreColor(analysis.overallHealth.score)}`}>
                          {analysis.overallHealth.score}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Overall Score</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            Grade: {analysis.overallHealth.grade}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{analysis.overallHealth.summary}</p>
                      </div>
                    </div>
                    
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <TrendingUp className="h-5 w-5 text-primary mb-2" />
                        <p className="text-xs text-muted-foreground">Growth Potential</p>
                        <p className="font-semibold">{analysis.metrics.subscriberGrowthPotential}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <Eye className="h-5 w-5 text-primary mb-2" />
                        <p className="text-xs text-muted-foreground">Avg Views/Video</p>
                        <p className="font-semibold">{analysis.metrics.viewsPerVideoAverage}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <Users className="h-5 w-5 text-primary mb-2" />
                        <p className="text-xs text-muted-foreground">Engagement</p>
                        <p className="font-semibold">{analysis.metrics.engagementEstimate}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <Clock className="h-5 w-5 text-primary mb-2" />
                        <p className="text-xs text-muted-foreground">Consistency</p>
                        <p className="font-semibold">{analysis.metrics.contentConsistency}</p>
                      </div>
                    </div>
                  </div>

                  {/* Strengths & Improvements */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Strengths */}
                    <div className="glass rounded-2xl p-6">
                      <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        Your Strengths
                      </h3>
                      <div className="space-y-4">
                        {analysis.strengths.map((strength, i) => (
                          <div key={i} className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium">{strength.area}</p>
                                <p className="text-sm text-muted-foreground mt-1">{strength.description}</p>
                                <p className="text-sm text-green-600 mt-2">
                                  <Lightbulb className="inline h-4 w-4 mr-1" />
                                  {strength.tips}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Improvements */}
                    <div className="glass rounded-2xl p-6">
                      <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-warning" />
                        Areas to Improve
                      </h3>
                      <div className="space-y-4">
                        {analysis.improvements.map((improvement, i) => (
                          <div key={i} className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-medium">{improvement.area}</p>
                              <Badge variant="outline" className={getPriorityColor(improvement.priority)}>
                                {improvement.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{improvement.currentState}</p>
                            <p className="text-sm">
                              <span className="font-medium text-primary">Recommendation:</span> {improvement.recommendation}
                            </p>
                            <p className="text-sm text-accent mt-1">
                              <ArrowRight className="inline h-4 w-4 mr-1" />
                              {improvement.expectedImpact}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Content Strategy */}
                  <div className="glass rounded-2xl p-6">
                    <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Content Strategy
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <p className="text-xs text-muted-foreground mb-1">Upload Frequency</p>
                        <p className="font-semibold">{analysis.contentStrategy.recommendedUploadFrequency}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <p className="text-xs text-muted-foreground mb-1">Optimal Length</p>
                        <p className="font-semibold">{analysis.contentStrategy.optimalVideoLength}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50 sm:col-span-2">
                        <p className="text-xs text-muted-foreground mb-2">Content Pillars</p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.contentStrategy.contentPillars.map((pillar, i) => (
                            <Badge key={i} variant="secondary">{pillar}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Trending Topics to Cover</p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.contentStrategy.trendingTopics.map((topic, i) => (
                            <Badge key={i} variant="outline" className="border-primary/30 text-primary">{topic}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Title Formulas That Work</p>
                        <div className="space-y-2">
                          {analysis.contentStrategy.titleFormulas.map((formula, i) => (
                            <div key={i} className="p-3 rounded-lg bg-secondary/50 text-sm">
                              {formula}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Growth Opportunities */}
                  <div className="glass rounded-2xl p-6">
                    <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-accent" />
                      Growth Opportunities
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {analysis.growthOpportunities.map((opp, i) => (
                        <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-medium">{opp.opportunity}</p>
                            <span className={`text-xs ${getDifficultyColor(opp.difficulty)}`}>
                              {opp.difficulty}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{opp.timeline}</p>
                          <p className="text-sm">{opp.howToExecute}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next Steps */}
                  <div className="glass rounded-2xl p-6">
                    <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                      <Play className="h-5 w-5 text-primary" />
                      Your Next Steps
                    </h3>
                    <div className="space-y-3">
                      {analysis.nextSteps.sort((a, b) => a.priority - b.priority).map((step, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <span className="font-bold text-primary-foreground">{step.priority}</span>
                          </div>
                          <div>
                            <p className="font-medium">{step.step}</p>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Monetization */}
                  <div className="glass rounded-2xl p-6">
                    <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                      <Crown className="h-5 w-5 text-warning" />
                      Monetization Readiness
                    </h3>
                    <div className="flex items-center gap-4 mb-4">
                      <Badge 
                        variant="outline" 
                        className={`text-lg px-4 py-2 ${
                          analysis.monetizationReadiness.status === "Ready" 
                            ? "bg-green-500/10 text-green-500 border-green-500/30"
                            : analysis.monetizationReadiness.status === "Almost Ready"
                              ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                              : "bg-red-500/10 text-red-500 border-red-500/30"
                        }`}
                      >
                        {analysis.monetizationReadiness.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-4">{analysis.monetizationReadiness.requirements}</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.monetizationReadiness.suggestions.map((suggestion, i) => (
                        <Badge key={i} variant="secondary">{suggestion}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* AI Chat CTA */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-2xl p-6 bg-gradient-to-r from-primary/10 to-accent/10"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-primary">
                          <MessageSquare className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold">Have questions about your analysis?</h3>
                          <p className="text-sm text-muted-foreground">Chat with our AI strategist for personalized advice</p>
                        </div>
                      </div>
                      <Button variant="hero" onClick={() => navigate("/dashboard/chat")}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Start Chat
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ChannelAnalysis;
