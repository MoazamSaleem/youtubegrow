import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { UsageProgress } from "@/components/dashboard/UsageProgress";
import { Button } from "@/components/ui/button";
import { getPlanLimits, canAccessFeature } from "@/lib/planLimits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { YouTubeChannelLink } from "@/components/youtube/YouTubeChannelLink";
import {
  Youtube,
  Eye,
  Clock,
  DollarSign,
  Users,
  Link2,
  Search,
  Lightbulb,
  Brain,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type AnalyticsRow = [string, string, string, string, string, string, string];

const UserDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, subscription, loading, refreshSubscription } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"live" | "daily" | "weekly" | "monthly">("weekly");
  const [channels, setChannels] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsRows, setAnalyticsRows] = useState<AnalyticsRow[]>([]);
  const refreshAttemptedRef = useRef(false);
  const [usage, setUsage] = useState({
    keywords_used: 0,
    topics_generated: 0,
    thumbnails_generated: 0,
    channel_analyses: 0,
    competitor_analyses: 0,
  });

  const currentPlan = subscription?.plan || "free";
  const limits = getPlanLimits(currentPlan);

  // Handle checkout success
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Subscription activated! Your features are now unlocked.");
      refreshSubscription();
    }
  }, [searchParams, refreshSubscription]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchChannels();
      fetchUsage();
    }
  }, [user]);

  useEffect(() => {
    if (user && channels.length > 0) {
      if (!refreshAttemptedRef.current) {
        refreshAttemptedRef.current = true;
        refreshYouTubeSession();
      }
      fetchAnalytics();
    }
  }, [user, channels, timeFilter]);

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

  const invokeWithAuthRetry = async <T,>(payload: {
    body: Record<string, unknown>;
    accessToken: string;
  }) => {
    let { data, error } = await supabase.functions.invoke<T>("youtube-oauth", {
      body: payload.body,
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (!error) return { data, error };

    const status = (error as any)?.context?.status ?? (error as any)?.status;
    const message = error?.message?.toLowerCase() || "";
    if (status !== 401 && !message.includes("invalid jwt") && !message.includes("401")) {
      return { data, error };
    }

    const refreshed = await getSessionWithRefresh();
    if (!refreshed?.access_token) {
      return { data, error };
    }

    return supabase.functions.invoke<T>("youtube-oauth", {
      body: payload.body,
      headers: {
        Authorization: `Bearer ${refreshed.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
  };

  const getTimeRange = () => {
    const daysMap: Record<typeof timeFilter, number> = {
      live: 1,
      daily: 7,
      weekly: 28,
      monthly: 90,
    };
    const days = daysMap[timeFilter];
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    const endDate = end.toISOString().split("T")[0];
    const startDate = start.toISOString().split("T")[0];
    return { startDate, endDate, days };
  };

  const formatPeriodLabel = () => {
    switch (timeFilter) {
      case "live":
        return "Last 24 hours";
      case "daily":
        return "Last 7 days";
      case "weekly":
        return "Last 28 days";
      case "monthly":
        return "Last 90 days";
      default:
        return "Last 7 days";
    }
  };

  const refreshYouTubeSession = async () => {
    if (!user || channels.length === 0) return;
    const primary = channels.find((c) => c.is_primary) ?? channels[0];
    if (!primary?.channel_id) return;

    try {
      const session = await getSessionWithRefresh();
      if (!session?.access_token) return;

      const { error } = await invokeWithAuthRetry<{ success?: boolean }>({
        body: {
          action: "refresh",
          channelId: primary.channel_id,
          userId: user.id,
        },
        accessToken: session.access_token,
      });

      if (error) {
        const message = error.message || "Failed to refresh YouTube session";
        if (message.toLowerCase().includes("reconnect")) {
          toast.error(message);
        }
      }
    } catch (error) {
      console.error("YouTube session refresh error:", error);
    }
  };

  const fetchAnalytics = async () => {
    if (!user || channels.length === 0) return;

    const primary = channels.find((c) => c.is_primary) ?? channels[0];
    if (!primary?.channel_id) return;

    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const session = await getSessionWithRefresh();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const { startDate, endDate } = getTimeRange();
      const { data, error } = await invokeWithAuthRetry<{ analytics?: { rows?: AnalyticsRow[] } }>({
        body: {
          action: "analytics",
          channelId: primary.channel_id,
          userId: user.id,
          startDate,
          endDate,
        },
        accessToken: session.access_token,
      });

      if (error) {
        throw new Error(error.message || "Failed to load analytics");
      }

      const rows = data?.analytics?.rows ?? [];
      setAnalyticsRows(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      console.error("Analytics error:", error);
      setAnalyticsRows([]);
      setAnalyticsError(error.message || "Failed to load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchChannels = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("youtube_channels")
      .select("id, channel_id, channel_name, is_primary")
      .eq("user_id", user.id);
    if (data) setChannels(data);
  };

  const fetchUsage = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();
    if (data) setUsage(data);
  };

  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat("en-US", options).format(value);
  };

  const formatCompact = (value: number) => {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  };

  const formatPercentChange = (start: number, end: number) => {
    if (!Number.isFinite(start) || start === 0) {
      return { value: "0%", positive: end >= 0 };
    }
    const change = ((end - start) / Math.abs(start)) * 100;
    const rounded = Math.round(change * 10) / 10;
    return { value: `${rounded >= 0 ? "+" : ""}${rounded}%`, positive: rounded >= 0 };
  };

  const chartData = analyticsRows.map((row) => ({
    name: row[0],
    views: Number(row[1] ?? 0),
    watchTime: Number(row[2] ?? 0),
    subscribersGained: Number(row[3] ?? 0),
    subscribersLost: Number(row[4] ?? 0),
    averageViewDuration: Number(row[5] ?? 0),
    revenue: Number(row[6] ?? 0),
  }));

  const totals = chartData.reduce(
    (acc, row) => {
      acc.views += row.views;
      acc.watchTime += row.watchTime;
      acc.subscribersNet += row.subscribersGained - row.subscribersLost;
      acc.revenue += row.revenue;
      acc.count += 1;
      return acc;
    },
    { views: 0, watchTime: 0, subscribersNet: 0, revenue: 0, count: 0 }
  );

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const viewsChange = first && last ? formatPercentChange(first.views, last.views) : { value: "0%", positive: true };
  const watchTimeChange = first && last ? formatPercentChange(first.watchTime, last.watchTime) : { value: "0%", positive: true };
  const subscribersChange = first && last
    ? formatPercentChange(first.subscribersGained - first.subscribersLost, last.subscribersGained - last.subscribersLost)
    : { value: "0%", positive: true };
  const revenueChange = first && last ? formatPercentChange(first.revenue, last.revenue) : { value: "0%", positive: true };

  const stats = [
    { label: "Total Views", value: formatCompact(totals.views), change: viewsChange.value, positive: viewsChange.positive, icon: Eye },
    { label: "Watch Time", value: `${formatCompact(totals.watchTime / 60)} hrs`, change: watchTimeChange.value, positive: watchTimeChange.positive, icon: Clock },
    { label: "Subscribers", value: formatCompact(totals.subscribersNet), change: subscribersChange.value, positive: subscribersChange.positive, icon: Users },
    { label: "Revenue", value: `$${formatNumber(totals.revenue, { maximumFractionDigits: 0 })}`, change: revenueChange.value, positive: revenueChange.positive, icon: DollarSign },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="min-h-screen bg-background flex">
        <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="glass rounded-2xl p-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-6">
                <Link2 className="h-10 w-10 text-primary-foreground" />
              </div>
              <h1 className="font-display text-2xl font-bold mb-2">
                Link Your YouTube Channel
              </h1>
              <p className="text-muted-foreground mb-6">
                Connect your channel to start tracking analytics and get AI-powered growth insights.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                You can link up to {limits.maxChannels} channel{limits.maxChannels > 1 ? "s" : ""} with your {currentPlan} plan.
              </p>
              <Button variant="hero" size="lg" onClick={() => navigate("/dashboard/profile")}>
                <Youtube className="h-5 w-5 mr-2" />
                Connect YouTube
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <YouTubeChannelLink />
          </div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                Channel Overview
              </h1>
              <p className="text-muted-foreground">
                Track your channel's performance in real-time
              </p>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-2 glass rounded-lg p-1">
              {(["live", "daily", "weekly", "monthly"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                    timeFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
              <StatsCard key={index} {...stat} index={index} />
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Views Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-semibold">Views Over Time</h3>
                <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {formatPeriodLabel()} <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              {analyticsError && (
                <p className="text-sm text-destructive mb-4">{analyticsError}</p>
              )}
              {analyticsLoading && (
                <p className="text-xs text-muted-foreground mb-4">Loading analytics…</p>
              )}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#viewsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Watch Time Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-semibold">Watch Time</h3>
                <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {formatPeriodLabel()} <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              {analyticsLoading && (
                <p className="text-xs text-muted-foreground mt-2">Loading analytics…</p>
              )}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="watchTimeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="watchTime"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      fill="url(#watchTimeGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Usage & Features */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Usage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="glass rounded-xl p-6"
            >
              <h3 className="font-display font-semibold mb-4">Daily Usage</h3>
              <div className="space-y-4">
                <UsageProgress
                  label="Keywords Research"
                  used={usage.keywords_used}
                  limit={limits.keywordsPerDay}
                />
                <UsageProgress
                  label="Topic Suggestions"
                  used={usage.topics_generated}
                  limit={limits.topicsPerDay}
                />
                {limits.thumbnailsPerDay !== 0 && (
                  <UsageProgress
                    label="Thumbnails"
                    used={usage.thumbnails_generated}
                    limit={limits.thumbnailsPerDay}
                  />
                )}
              </div>
            </motion.div>

            {/* Keywords Feature */}
            <FeatureCard
              title="Keyword Research"
              description="Find trending keywords to optimize your videos for search."
              icon={<Search className="h-5 w-5 text-primary" />}
              action={{ label: "Research", href: "/dashboard/keywords" }}
            >
              <p className="text-sm">
                <span className="text-primary font-semibold">{limits.keywordsPerDay === -1 ? "Unlimited" : limits.keywordsPerDay}</span> keywords per day
              </p>
            </FeatureCard>

            {/* Topics Feature */}
            <FeatureCard
              title="Topic Ideas"
              description="Get AI-generated topic suggestions based on trends."
              icon={<Lightbulb className="h-5 w-5 text-primary" />}
              action={{ label: "Get Ideas", href: "/dashboard/topics" }}
            >
              <p className="text-sm">
                <span className="text-primary font-semibold">{limits.topicsPerDay}</span> topics per day
              </p>
            </FeatureCard>
          </div>

          {/* AI Channel Analysis CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="glass rounded-xl p-6 bg-gradient-to-r from-primary/10 via-background to-accent/10 relative overflow-hidden"
          >
            {!canAccessFeature(currentPlan, "channelAnalysisFrequency") && (
              <div className="absolute inset-0 backdrop-blur-sm bg-background/60 flex items-center justify-center z-10">
                <div className="text-center">
                  <p className="font-semibold mb-2">Upgrade to Basic or higher</p>
                  <Button variant="premium" size="sm" onClick={() => navigate("/dashboard/billing")}>
                    Upgrade Now
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent">
                  <Brain className="h-8 w-8 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold mb-1">
                    AI Channel Analysis
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Get deep insights and personalized growth strategies powered by AI
                  </p>
                </div>
              </div>
              <Button
                variant="hero"
                size="lg"
                onClick={() => {
                  const primary = channels.find((c) => c.is_primary) ?? channels[0];
                  const channelId = primary?.channel_id;
                  navigate(channelId ? `/dashboard/analysis?channelId=${channelId}` : "/dashboard/analysis");
                }}
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Analyze My Channel
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;
