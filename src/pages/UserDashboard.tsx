import { useState, useEffect } from "react";
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

const UserDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, subscription, loading, refreshSubscription } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"live" | "daily" | "weekly" | "monthly">("weekly");
  const [channels, setChannels] = useState<any[]>([]);
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

  const stats = [
    { label: "Total Views", value: "2.4M", change: "+12.5%", positive: true, icon: Eye },
    { label: "Watch Time", value: "156K hrs", change: "+8.3%", positive: true, icon: Clock },
    { label: "Subscribers", value: "45.2K", change: "-2.1%", positive: false, icon: Users },
    { label: "Revenue", value: "$12,450", change: "+15.7%", positive: true, icon: DollarSign },
  ];

  const chartData = [
    { name: "Mon", views: 24000, watchTime: 4800 },
    { name: "Tue", views: 28000, watchTime: 5600 },
    { name: "Wed", views: 32000, watchTime: 6400 },
    { name: "Thu", views: 27000, watchTime: 5400 },
    { name: "Fri", views: 35000, watchTime: 7000 },
    { name: "Sat", views: 42000, watchTime: 8400 },
    { name: "Sun", views: 38000, watchTime: 7600 },
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
              <Button variant="hero" size="lg">
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
                  Last 7 days <ChevronDown className="h-4 w-4" />
                </button>
              </div>
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
                  Last 7 days <ChevronDown className="h-4 w-4" />
                </button>
              </div>
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
              <Button variant="hero" size="lg">
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
