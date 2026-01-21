import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getPlanLimits } from "@/lib/planLimits";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Sparkles,
  Loader2,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Star,
  Tag,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Keyword {
  keyword: string;
  searchVolume: "low" | "medium" | "high";
  competition: "low" | "medium" | "high";
  relevance: number;
  suggestedUse: string;
}

const KeywordsResearch = () => {
  const navigate = useNavigate();
  const { user, subscription, loading } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [niche, setNiche] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [summary, setSummary] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelDescription, setChannelDescription] = useState<string>("");
  const [recentTitles, setRecentTitles] = useState<string[]>([]);
  const [channelNiche, setChannelNiche] = useState<string>("");

  const currentPlan = subscription?.plan || "free";
  const limits = getPlanLimits(currentPlan);

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

    const { data, error } = await supabase.functions.invoke<{
      channel?: { title?: string; description?: string };
      recentVideos?: Array<{ title?: string }>;
    }>("youtube-oauth", {
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

    const description = data?.channel?.description || "";
    setChannelDescription(description);
    setRecentTitles((data?.recentVideos || []).map((v) => v.title || "").filter(Boolean));
    const derivedNiche = description ? description.split(".")[0]?.slice(0, 120) : "";
    if (derivedNiche) {
      setChannelNiche(derivedNiche);
      setNiche((prev) => (prev ? prev : derivedNiche));
    }
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
          await fetchChannelContext(primary.channel_id);
        }
      }
    };
    loadChannel();
  }, [user]);

  const handleSearch = async (queryOverride?: string, nicheOverride?: string) => {
    const queryValue = queryOverride ?? searchQuery;
    const nicheValue = (nicheOverride ?? niche).trim() ? (nicheOverride ?? niche) : channelNiche;
    const trimmedQuery = queryValue.trim();
    const trimmedNiche = nicheValue.trim();
    const effectiveQuery = trimmedQuery || trimmedNiche;
    if (!effectiveQuery) {
      toast({ title: "Please enter a topic or niche", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-keywords", {
        body: {
          query: effectiveQuery,
          niche: trimmedNiche,
          count: Math.min(limits.keywordsPerDay, 10),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setKeywords(data.keywords || []);
      setSummary(data.summary || "");

      // Update usage
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("usage_tracking").upsert(
        {
          user_id: user?.id,
          date: today,
          keywords_used: (data.keywords?.length || 0),
        },
        { onConflict: "user_id,date" }
      );

      toast({ title: "Keywords researched successfully!" });
    } catch (error: any) {
      console.error("Error researching keywords:", error);
      toast({
        title: "Failed to research keywords",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const copyToClipboard = (keyword: string) => {
    navigator.clipboard.writeText(keyword);
    setCopiedKeyword(keyword);
    setTimeout(() => setCopiedKeyword(null), 2000);
    toast({ title: "Copied to clipboard!" });
  };

  const copyAllKeywords = () => {
    const allKeywords = keywords.map((k) => k.keyword).join(", ");
    navigator.clipboard.writeText(allKeywords);
    toast({ title: "All keywords copied!" });
  };

  const getVolumeIcon = (volume: string) => {
    switch (volume) {
      case "high":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "medium":
        return <Minus className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getCompetitionBadge = (competition: string) => {
    const colors: Record<string, string> = {
      low: "bg-green-500/10 text-green-500 border-green-500/20",
      medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      high: "bg-red-500/10 text-red-500 border-red-500/20",
    };
    return colors[competition] || "bg-muted text-muted-foreground";
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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                <Search className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                Keywords Research
              </h1>
            </div>
            <p className="text-muted-foreground">
              Find trending keywords to optimize your videos (
              {limits.keywordsPerDay === -1 ? "Unlimited" : limits.keywordsPerDay} keywords/day)
            </p>
          </motion.div>

          {/* Search Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder={channelName ? "Search for more keywords..." : "Enter a keyword or topic to research..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="h-12"
                />
              </div>
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Channel niche (optional)"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="h-12"
                />
              </div>
              <Button
                variant="hero"
                size="lg"
                onClick={() => handleSearch()}
                disabled={isSearching || !searchQuery.trim()}
                className="h-12"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Research
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Summary */}
          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-xl p-6 mb-8 bg-gradient-to-r from-primary/5 to-accent/5"
            >
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Research Summary</h3>
                  <p className="text-muted-foreground">{summary}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Results Table */}
          {keywords.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-display font-semibold flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  Keyword Results ({keywords.length})
                </h2>
                <Button variant="outline" size="sm" onClick={copyAllKeywords}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Search Volume</TableHead>
                    <TableHead>Competition</TableHead>
                    <TableHead>Relevance</TableHead>
                    <TableHead>Suggested Use</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((keyword, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{keyword.keyword}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getVolumeIcon(keyword.searchVolume)}
                          <span className="capitalize">{keyword.searchVolume}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getCompetitionBadge(keyword.competition)}
                        >
                          {keyword.competition}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-warning fill-warning" />
                          <span>{keyword.relevance}/10</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {keyword.suggestedUse}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(keyword.keyword)}
                        >
                          {copiedKeyword === keyword.keyword ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </motion.div>
          )}

          {/* Empty State */}
          {keywords.length === 0 && !isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">
                Start your keyword research
              </h3>
              <p className="text-muted-foreground">
                Enter a topic or keyword above to discover related search terms and optimization opportunities
              </p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default KeywordsResearch;
