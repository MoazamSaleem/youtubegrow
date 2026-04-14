import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { canAccessFeature } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Menu,
  Loader2,
  Target,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  CheckCircle2,
  PencilLine,
  Trash2,
  AlertCircle,
  Sparkles,
  Search,
  ExternalLink,
} from "lucide-react";

interface StrengthWeakness {
  area: string;
  description: string;
  howToAdapt?: string;
  yourOpportunity?: string;
}

interface ContentGap {
  topic: string;
  potential: string;
  difficulty: string;
}

interface ActionableInsight {
  priority: string;
  action: string;
  expectedImpact: string;
}

interface CompetitorAnalysis {
  channelOverview: {
    estimatedNiche: string;
    contentStyle: string;
    targetAudience: string;
    uniqueSellingPoint: string;
  };
  contentStrategy: {
    uploadFrequency: string;
    videoFormats: string[];
    averageLength: string;
    topPerformingTopics: string[];
  };
  strengths: StrengthWeakness[];
  weaknesses: StrengthWeakness[];
  contentGaps: ContentGap[];
  actionableInsights: ActionableInsight[];
  titleFormulas: string[];
  thumbnailStyle: string;
  engagementTactics: string[];
}

interface SavedCompetitor {
  id: string;
  channel_url: string;
  created_at: string;
}

const CompetitorAnalysisPage = () => {
  const { user, subscription, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [savedCompetitors, setSavedCompetitors] = useState<SavedCompetitor[]>([]);
  const [editingCompetitorId, setEditingCompetitorId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    competitorChannelUrl: "",
    niche: "",
    yourChannelInfo: "",
  });

  const currentPlan = getActiveSubscriptionPlan(subscription);
  const hasAccess = canAccessFeature(currentPlan, "competitorAnalysisFrequency");
  const saveLimit = currentPlan === "pro" ? 3 : currentPlan === "advanced" ? 5 : 0;
  const hasSaveAccess = saveLimit > 0;
  const emptyAnalysis: CompetitorAnalysis = {
    channelOverview: {
      estimatedNiche: "Not available",
      contentStyle: "Not available",
      targetAudience: "Not available",
      uniqueSellingPoint: "Not available",
    },
    contentStrategy: {
      uploadFrequency: "Not available",
      videoFormats: [],
      averageLength: "Not available",
      topPerformingTopics: [],
    },
    strengths: [],
    weaknesses: [],
    contentGaps: [],
    actionableInsights: [],
    titleFormulas: [],
    thumbnailStyle: "Not available",
    engagementTactics: [],
  };
  const safeAnalysis: CompetitorAnalysis = {
    ...emptyAnalysis,
    ...analysis,
    channelOverview: {
      ...emptyAnalysis.channelOverview,
      ...(analysis?.channelOverview ?? {}),
    },
    contentStrategy: {
      ...emptyAnalysis.contentStrategy,
      ...(analysis?.contentStrategy ?? {}),
      videoFormats: analysis?.contentStrategy?.videoFormats ?? [],
      topPerformingTopics: analysis?.contentStrategy?.topPerformingTopics ?? [],
    },
    strengths: analysis?.strengths ?? [],
    weaknesses: analysis?.weaknesses ?? [],
    contentGaps: analysis?.contentGaps ?? [],
    actionableInsights: analysis?.actionableInsights ?? [],
    titleFormulas: analysis?.titleFormulas ?? [],
    engagementTactics: analysis?.engagementTactics ?? [],
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const key = `competitor_analysis_cache:${user.id}`;
    const cached = localStorage.getItem(key);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as CompetitorAnalysis;
      setAnalysis(parsed);
    } catch (error) {
      console.warn("Failed to load competitor analysis cache:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchSavedCompetitors();
    }
  }, [user]);

  const fetchSavedCompetitors = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("competitor_channels")
      .select("id, channel_url, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load competitors:", error);
      return;
    }

    setSavedCompetitors(data || []);
  };

  const handleAnalyze = async () => {
    if (!formData.competitorChannelUrl.trim()) {
      toast({
        title: "Channel link required",
        description: "Please enter a competitor channel link",
        variant: "destructive",
      });
      return;
    }

    if (!hasAccess) {
      toast({
        title: "Upgrade Required",
        description: "Competitor Analysis is available on Basic, Pro, and Advanced plans",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-competitor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze competitor");
      }

      const data = await response.json();
      const raw = data.analysis ?? data.competitorAnalysis ?? data;
      const normalizeList = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []);
      const normalized: CompetitorAnalysis = {
        channelOverview: {
          estimatedNiche:
            raw.channelOverview?.estimatedNiche ??
            raw.channelOverview?.estimated_niche ??
            raw.niche ??
            "Not specified",
          contentStyle:
            raw.channelOverview?.contentStyle ??
            raw.channelOverview?.content_style ??
            raw.contentStyle ??
            "Not specified",
          targetAudience:
            raw.channelOverview?.targetAudience ??
            raw.channelOverview?.target_audience ??
            raw.targetAudience ??
            "Not specified",
          uniqueSellingPoint:
            raw.channelOverview?.uniqueSellingPoint ??
            raw.channelOverview?.unique_selling_point ??
            raw.usp ??
            "Not specified",
        },
        contentStrategy: {
          uploadFrequency:
            raw.contentStrategy?.uploadFrequency ??
            raw.contentStrategy?.upload_frequency ??
            "Not specified",
          videoFormats: normalizeList(
            raw.contentStrategy?.videoFormats ?? raw.contentStrategy?.video_formats
          ),
          averageLength:
            raw.contentStrategy?.averageLength ??
            raw.contentStrategy?.average_length ??
            "Not specified",
          topPerformingTopics: normalizeList(
            raw.contentStrategy?.topPerformingTopics ?? raw.contentStrategy?.top_performing_topics
          ),
        },
        strengths: normalizeList(raw.strengths),
        weaknesses: normalizeList(raw.weaknesses ?? raw.weaknessesOpportunities),
        contentGaps: normalizeList(raw.contentGaps ?? raw.contentGapsToExploit),
        actionableInsights: normalizeList(raw.actionableInsights),
        titleFormulas: normalizeList(raw.titleFormulas),
        thumbnailStyle: raw.thumbnailStyle ?? "Not specified",
        engagementTactics: normalizeList(raw.engagementTactics),
      };

      setAnalysis(normalized);
      if (user?.id) {
        localStorage.setItem(
          `competitor_analysis_cache:${user.id}`,
          JSON.stringify(normalized)
        );
      }

      toast({
        title: "Analysis Complete!",
        description: "Competitor insights are ready",
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveCompetitor = async () => {
    if (!formData.competitorChannelUrl.trim()) {
      toast({
        title: "Channel link required",
        description: "Please enter a competitor channel link",
        variant: "destructive",
      });
      return;
    }

    if (!hasSaveAccess) {
      toast({
        title: "Upgrade Required",
        description: "Save competitors on Pro (3) or Advanced (5) plans.",
        variant: "destructive",
      });
      return;
    }

    if (!editingCompetitorId && savedCompetitors.length >= saveLimit) {
      toast({
        title: "Competitor limit reached",
        description: `You can save up to ${saveLimit} competitors on your plan.`,
        variant: "destructive",
      });
      return;
    }

    const normalizedUrl = formData.competitorChannelUrl.trim();
    if (
      savedCompetitors.some(
        (item) => item.channel_url === normalizedUrl && item.id !== editingCompetitorId
      )
    ) {
      toast({
        title: "Already saved",
        description: "This competitor is already in your list.",
      });
      return;
    }

    setIsSaving(true);
    const { error } = editingCompetitorId
      ? await supabase
          .from("competitor_channels")
          .update({ channel_url: normalizedUrl })
          .eq("id", editingCompetitorId)
      : await supabase.from("competitor_channels").insert({
          user_id: user?.id,
          channel_url: normalizedUrl,
        });

    if (error) {
      console.error("Failed to save competitor:", error);
      toast({
        title: "Save failed",
        description: "Unable to save competitor right now.",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    await fetchSavedCompetitors();
    setEditingCompetitorId(null);
    setIsSaving(false);
    toast({
      title: editingCompetitorId ? "Competitor updated" : "Competitor saved",
      description: editingCompetitorId
        ? "Competitor link updated."
        : "Saved to your competitor list.",
    });
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    const { error } = await supabase
      .from("competitor_channels")
      .delete()
      .eq("id", competitorId);

    if (error) {
      console.error("Failed to delete competitor:", error);
      toast({
        title: "Delete failed",
        description: "Unable to delete competitor right now.",
        variant: "destructive",
      });
      return;
    }

    if (editingCompetitorId === competitorId) {
      setEditingCompetitorId(null);
    }
    await fetchSavedCompetitors();
    toast({
      title: "Competitor deleted",
      description: "Removed from your saved list.",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "low":
        return "bg-success text-success-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "text-success";
      case "medium":
        return "text-warning";
      case "hard":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 transition-all duration-300">
        {/* Header */}
        <header className="sticky top-0 z-40 glass-strong border-b border-border px-4 lg:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-accent to-success">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold">Competitor Analysis</h1>
                <p className="text-sm text-muted-foreground">Learn from the competition</p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          {!hasAccess ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <SubscriptionRequiredState
                title={currentPlan ? "Unlock Competitor Analysis" : "Active subscription required"}
                description={
                  currentPlan
                    ? "Study competitor strategies and discover opportunities. Available on paid plans."
                    : "Competitor Analysis now requires an active Basic, Pro, or Advanced subscription."
                }
              />
            </motion.div>
          ) : (
            <div className="space-y-8">
              {/* Input Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-6"
              >
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="competitor">Competitor Channel Link *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="competitor"
                        placeholder="E.g., https://www.youtube.com/@MrBeast"
                        value={formData.competitorChannelUrl}
                        onChange={(e) => setFormData({ ...formData, competitorChannelUrl: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="niche">Your Niche</Label>
                    <Input
                      id="niche"
                      placeholder="E.g., Tech reviews, Gaming"
                      value={formData.niche}
                      onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="info">Your Channel Context (optional)</Label>
                    <Input
                      id="info"
                      placeholder="Brief description of your channel"
                      value={formData.yourChannelInfo}
                      onChange={(e) => setFormData({ ...formData, yourChannelInfo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleSaveCompetitor}
                    disabled={isSaving || !formData.competitorChannelUrl.trim() || !hasSaveAccess}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : editingCompetitorId ? (
                      <>
                        <PencilLine className="h-4 w-4 mr-2" />
                        Replace Competitor
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Save Competitor
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !formData.competitorChannelUrl.trim()}
                    size="lg"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Target className="h-4 w-4 mr-2" />
                        Analyze Competitor
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>

              {hasSaveAccess && (
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-lg font-bold">Saved Competitors</h2>
                    <span className="text-xs text-muted-foreground">
                      {savedCompetitors.length}/{saveLimit}
                    </span>
                  </div>
                  {savedCompetitors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Save competitor links to reuse them later.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {savedCompetitors.map((competitor) => (
                        <div
                          key={competitor.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                competitorChannelUrl: competitor.channel_url,
                              }))
                            }
                            className="text-left text-sm font-medium text-foreground truncate"
                          >
                            {competitor.channel_url}
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCompetitorId(competitor.id);
                                setFormData((prev) => ({
                                  ...prev,
                                  competitorChannelUrl: competitor.channel_url,
                                }));
                              }}
                              className="inline-flex items-center text-xs text-primary"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCompetitor(competitor.id)}
                              className="inline-flex items-center text-xs text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <a
                              href={competitor.channel_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs text-primary"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-24">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Analyzing competitor strategy...</p>
                  </div>
                </div>
              ) : analysis ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Channel Overview */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Channel Overview
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Niche</span>
                      <p className="font-medium">{safeAnalysis.channelOverview.estimatedNiche}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Target Audience</span>
                      <p className="font-medium">{safeAnalysis.channelOverview.targetAudience}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Content Style</span>
                      <p className="font-medium">{safeAnalysis.channelOverview.contentStyle}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">USP</span>
                      <p className="font-medium">{safeAnalysis.channelOverview.uniqueSellingPoint}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content Strategy */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="font-display text-xl font-bold mb-4">Content Strategy</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <span className="text-xs text-muted-foreground block mb-1">Upload Frequency</span>
                        <span className="font-display font-bold">{safeAnalysis.contentStrategy.uploadFrequency}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <span className="text-xs text-muted-foreground block mb-1">Average Length</span>
                        <span className="font-display font-bold">{safeAnalysis.contentStrategy.averageLength}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50 col-span-2">
                        <span className="text-xs text-muted-foreground block mb-2">Video Formats</span>
                        <div className="flex flex-wrap gap-2">
                          {safeAnalysis.contentStrategy.videoFormats.map((format, i) => (
                            <Badge key={i} variant="secondary">{format}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Top Performing Topics</span>
                      <div className="flex flex-wrap gap-2">
                        {safeAnalysis.contentStrategy.topPerformingTopics.map((topic, i) => (
                          <Badge key={i} variant="outline" className="text-primary border-primary/30">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="glass rounded-2xl p-6">
                      <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-success" />
                        Strengths
                      </h2>
                      <div className="space-y-4">
                        {safeAnalysis.strengths.map((item, i) => (
                          <div key={i} className="p-4 rounded-xl bg-success/10 border border-success/20">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium block">{item.area}</span>
                                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                {item.howToAdapt && (
                                  <p className="text-sm text-success mt-2">
                                    <Lightbulb className="inline h-4 w-4 mr-1" />
                                    {item.howToAdapt}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass rounded-2xl p-6">
                      <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-warning" />
                        Weaknesses (Your Opportunities)
                      </h2>
                      <div className="space-y-4">
                        {safeAnalysis.weaknesses.map((item, i) => (
                          <div key={i} className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium block">{item.area}</span>
                                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                {item.yourOpportunity && (
                                  <p className="text-sm text-accent mt-2">
                                    <Target className="inline h-4 w-4 mr-1" />
                                    {item.yourOpportunity}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Content Gaps */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-warning" />
                      Content Gaps to Exploit
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {safeAnalysis.contentGaps.map((gap, i) => (
                        <div key={i} className="p-4 rounded-xl bg-secondary/50 border border-border">
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-medium">{gap.topic}</span>
                            <span className={`text-xs font-medium ${getDifficultyColor(gap.difficulty)}`}>
                              {gap.difficulty}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{gap.potential}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actionable Insights */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="font-display text-xl font-bold mb-4">Actionable Insights</h2>
                    <div className="space-y-3">
                      {safeAnalysis.actionableInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
                          <Badge className={getPriorityColor(insight.priority)}>
                            {insight.priority}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-medium">{insight.action}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Expected Impact: {insight.expectedImpact}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Additional Insights */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="glass rounded-2xl p-6">
                      <h2 className="font-display text-lg font-bold mb-3">Title Formulas</h2>
                      <ul className="space-y-2">
                        {safeAnalysis.titleFormulas.map((formula, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary">•</span>
                            {formula}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="glass rounded-2xl p-6">
                      <h2 className="font-display text-lg font-bold mb-3">Engagement Tactics</h2>
                      <ul className="space-y-2">
                        {safeAnalysis.engagementTactics.map((tactic, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-accent">•</span>
                            {tactic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center py-24 text-center">
                  <div>
                    <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Enter a competitor channel to analyze their strategy
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CompetitorAnalysisPage;
