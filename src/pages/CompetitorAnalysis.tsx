import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { canAccessFeature } from "@/lib/planLimits";
import {
  Users,
  Menu,
  Loader2,
  Target,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  CheckCircle2,
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

const CompetitorAnalysisPage = () => {
  const { user, subscription, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null);

  const [formData, setFormData] = useState({
    competitorChannel: "",
    niche: "",
    yourChannelInfo: "",
  });

  const currentPlan = subscription?.plan || "free";
  const hasAccess = canAccessFeature(currentPlan, "competitorAnalysisFrequency");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  const handleAnalyze = async () => {
    if (!formData.competitorChannel.trim()) {
      toast({
        title: "Channel name required",
        description: "Please enter a competitor channel name",
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-competitor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze competitor");
      }

      const data = await response.json();
      setAnalysis(data.analysis);

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

      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "ml-0"}`}>
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto text-center py-16"
            >
              <div className="inline-flex p-6 rounded-3xl glass mb-8">
                <Users className="h-16 w-16 text-accent" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-4">
                Unlock Competitor Analysis
              </h2>
              <p className="text-muted-foreground mb-8">
                Study competitor strategies and discover opportunities. Available on paid plans.
              </p>
              <Button variant="hero" onClick={() => navigate("/dashboard/billing")}>
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
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
                    <Label htmlFor="competitor">Competitor Channel Name *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="competitor"
                        placeholder="E.g., MrBeast"
                        value={formData.competitorChannel}
                        onChange={(e) => setFormData({ ...formData, competitorChannel: e.target.value })}
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

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !formData.competitorChannel.trim()}
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
                        <p className="font-medium">{analysis.channelOverview.estimatedNiche}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Target Audience</span>
                        <p className="font-medium">{analysis.channelOverview.targetAudience}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Content Style</span>
                        <p className="font-medium">{analysis.channelOverview.contentStyle}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">USP</span>
                        <p className="font-medium">{analysis.channelOverview.uniqueSellingPoint}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content Strategy */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="font-display text-xl font-bold mb-4">Content Strategy</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <span className="text-xs text-muted-foreground block mb-1">Upload Frequency</span>
                        <span className="font-display font-bold">{analysis.contentStrategy.uploadFrequency}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <span className="text-xs text-muted-foreground block mb-1">Average Length</span>
                        <span className="font-display font-bold">{analysis.contentStrategy.averageLength}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50 col-span-2">
                        <span className="text-xs text-muted-foreground block mb-2">Video Formats</span>
                        <div className="flex flex-wrap gap-2">
                          {analysis.contentStrategy.videoFormats.map((format, i) => (
                            <Badge key={i} variant="secondary">{format}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Top Performing Topics</span>
                      <div className="flex flex-wrap gap-2">
                        {analysis.contentStrategy.topPerformingTopics.map((topic, i) => (
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
                        {analysis.strengths.map((item, i) => (
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
                        {analysis.weaknesses.map((item, i) => (
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
                      {analysis.contentGaps.map((gap, i) => (
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
                      {analysis.actionableInsights.map((insight, i) => (
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
                        {analysis.titleFormulas.map((formula, i) => (
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
                        {analysis.engagementTactics.map((tactic, i) => (
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
