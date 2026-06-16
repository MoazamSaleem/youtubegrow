import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { canAccessFeature } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Target } from "lucide-react";

type AnalysisResponse = {
  meta: { title: string; author: string; thumbnail: string; videoId: string; viewCount?: number | null; publishedTimeText?: string | null };
  score: number;
  verdict: string;
  optimization: string[];
  suggestedKeywords?: string[];
  hashtags?: string[];
  errors?: { severity: "low" | "medium" | "high"; issue: string; fix: string }[];
  title: { rewrites: string[]; issues: string[]; suggestions: string[] };
  description?: { issues: string[]; suggestions: string[] };
  thumbnail?: { strengths: string[]; weaknesses: string[]; suggestions: string[] };
  retentionRisks?: { timeframe: string; risk: string; fix: string }[];
  trendingAngles?: string[];
  debug?: { mode?: string; viewCount?: number | null; publishedTimeText?: string | null };
};

export default function SeoAnalyzerPage() {
  const { user, loading, subscription } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const currentPlan = getActiveSubscriptionPlan(subscription);
  const hasAccess = canAccessFeature(currentPlan, "competitorAnalysisFrequency");

  useEffect(() => {
    if (!loading && !user) navigate("/signin");
  }, [loading, navigate, user]);

  const runAnalysis = async () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-seo-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ videoUrl: url.trim() }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "SEO analysis failed");

      setAnalysis(payload.analysis);
      toast({ title: "Analysis complete", description: "20 AI credits deducted for this query." });
    } catch (error: any) {
      toast({ title: "Analysis failed", description: error.message || "Please try again", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex">
        <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 lg:ml-0 ml-0">
          <SubscriptionRequiredState description="SEO Analyzer is available on Basic, Pro, and Advanced plans." />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold">YouTube SEO Analyzer</h1>
          <p className="text-muted-foreground">Analyze one video URL per run. Cost: 20 AI credits/query.</p>
        </motion.div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-4 w-4" />Video URL</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
            <Button onClick={runAnalysis} disabled={analyzing || !url.trim()}>
              {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : "Analyze SEO"}
            </Button>
          </CardContent>
        </Card>

        {analysis && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />{analysis.meta.title}</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">By {analysis.meta.author}</p>
              <p className="text-xs text-muted-foreground">
                Views: {typeof analysis.meta.viewCount === "number" ? analysis.meta.viewCount.toLocaleString() : "Unknown"} · Published: {analysis.meta.publishedTimeText || "Unknown"} · Mode: {analysis.debug?.mode || "unknown"}
              </p>
              <p><strong>Score:</strong> {analysis.score}/100</p>
              <p>{analysis.verdict}</p>
              <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="font-medium">Top Optimizations</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.optimization || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(!analysis.optimization || analysis.optimization.length === 0) && <li>No optimization actions returned for this video.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">SEO Errors and Suggested Fixes</p>
                <ul className="list-disc pl-6 text-sm space-y-2">
                  {(analysis.errors || []).map((item, i) => (
                    <li key={i}>
                      <span className="font-semibold uppercase">[{item.severity}]</span> {item.issue}
                      <div className="text-muted-foreground">Fix: {item.fix}</div>
                    </li>
                  ))}
                  {(!analysis.errors || analysis.errors.length === 0) && <li>No explicit SEO errors were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Title Issues</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.title?.issues || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(analysis.title?.issues || []).length === 0 && <li>No title issues were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Title Improvement Suggestions</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.title?.suggestions || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(analysis.title?.suggestions || []).length === 0 && <li>No title suggestions were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Description Issues</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.description?.issues || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(analysis.description?.issues || []).length === 0 && <li>No description issues were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Description Fixes</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.description?.suggestions || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(analysis.description?.suggestions || []).length === 0 && <li>No description fixes were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Thumbnail Strengths</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.thumbnail?.strengths || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(analysis.thumbnail?.strengths || []).length === 0 && <li>No thumbnail strengths were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Thumbnail Weaknesses</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.thumbnail?.weaknesses || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(analysis.thumbnail?.weaknesses || []).length === 0 && <li>No thumbnail weaknesses were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Thumbnail Improvements</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.thumbnail?.suggestions || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(analysis.thumbnail?.suggestions || []).length === 0 && <li>No thumbnail improvements were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Retention Risks</p>
                <ul className="list-disc pl-6 text-sm space-y-2">
                  {(analysis.retentionRisks || []).map((item, i) => (
                    <li key={i}>
                      <span className="font-semibold">{item.timeframe}:</span> {item.risk}
                      <div className="text-muted-foreground">Fix: {item.fix}</div>
                    </li>
                  ))}
                  {(!analysis.retentionRisks || analysis.retentionRisks.length === 0) && <li>No retention risks were returned.</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium">Trending Follow-up Angles</p>
                <ul className="list-disc pl-6 text-sm">
                  {(analysis.trendingAngles || []).map((item, i) => <li key={i}>{item}</li>)}
                  {(!analysis.trendingAngles || analysis.trendingAngles.length === 0) && <li>No trend angles were returned.</li>}
                </ul>
              </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-xl border border-border p-4 bg-card/40">
                  <div className="mb-3">
                    <h3 className="font-medium">Suggested Keywords</h3>
                    <p className="text-xs text-muted-foreground">{(analysis.suggestedKeywords || []).length} keywords</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.suggestedKeywords || []).map((tag) => (
                      <span key={tag} className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs text-foreground/80">
                        {tag}
                      </span>
                    ))}
                    {(!analysis.suggestedKeywords || analysis.suggestedKeywords.length === 0) && (
                      <span className="text-sm text-muted-foreground">No suggested keywords were returned.</span>
                    )}
                  </div>
                </section>
                <section className="rounded-xl border border-border p-4 bg-card/40">
                  <div className="mb-3">
                    <h3 className="font-medium">Suggested Hashtags</h3>
                    <p className="text-xs text-muted-foreground">{(analysis.hashtags || []).length} hashtags</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.hashtags || []).map((h) => (
                      <span key={h} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {h}
                      </span>
                    ))}
                    {(!analysis.hashtags || analysis.hashtags.length === 0) && (
                      <span className="text-sm text-muted-foreground">No hashtags were returned.</span>
                    )}
                  </div>
                </section>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
