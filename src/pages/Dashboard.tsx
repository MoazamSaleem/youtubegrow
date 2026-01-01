import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Youtube,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Eye,
  Clock,
  DollarSign,
  Users,
  Link2,
  BarChart3,
  Search,
  Lightbulb,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Brain,
  Crown,
  Lock,
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

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"live" | "daily" | "weekly" | "monthly">("weekly");
  const [channelLinked, setChannelLinked] = useState(true);

  const navigation = [
    { name: "Overview", icon: BarChart3, href: "#", active: true },
    { name: "Channel Analysis", icon: Brain, href: "#", locked: false },
    { name: "Keywords", icon: Search, href: "#" },
    { name: "Topic Ideas", icon: Lightbulb, href: "#" },
    { name: "Competitors", icon: Users, href: "#", locked: true },
    { name: "AI Chat", icon: MessageSquare, href: "#" },
  ];

  const stats = [
    {
      label: "Total Views",
      value: "2.4M",
      change: "+12.5%",
      positive: true,
      icon: Eye,
      status: "green",
    },
    {
      label: "Watch Time",
      value: "156K hrs",
      change: "+8.3%",
      positive: true,
      icon: Clock,
      status: "green",
    },
    {
      label: "Subscribers",
      value: "45.2K",
      change: "-2.1%",
      positive: false,
      icon: Users,
      status: "orange",
    },
    {
      label: "Revenue",
      value: "$12,450",
      change: "+15.7%",
      positive: true,
      icon: DollarSign,
      status: "green",
    },
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "green":
        return "bg-success";
      case "orange":
        return "bg-warning";
      case "red":
        return "bg-destructive";
      default:
        return "bg-muted";
    }
  };

  if (!channelLinked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
            <Button variant="hero" size="lg" onClick={() => setChannelLinked(true)}>
              <Youtube className="h-5 w-5 mr-2" />
              Connect YouTube
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-strong border-r border-border transform transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-20"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <div className="relative">
              <Youtube className="h-8 w-8 text-primary" />
              <Sparkles className="h-3 w-3 text-accent absolute -top-1 -right-1" />
            </div>
            {sidebarOpen && (
              <span className="font-display font-bold text-lg">
                Tube<span className="gradient-text">Grow</span>
              </span>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                  item.active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                } ${item.locked ? "opacity-60" : ""}`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="font-medium">{item.name}</span>
                    {item.locked && (
                      <Lock className="h-4 w-4 ml-auto text-warning" />
                    )}
                  </>
                )}
              </a>
            ))}
          </nav>

          {/* Upgrade Banner */}
          {sidebarOpen && (
            <div className="p-4 border-t border-border">
              <div className="glass rounded-xl p-4 bg-gradient-to-br from-primary/10 to-accent/10">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-warning" />
                  <span className="font-semibold text-sm">Upgrade to Pro</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Unlock AI script writer, thumbnails & more
                </p>
                <Button variant="premium" size="sm" className="w-full">
                  Upgrade Now
                </Button>
              </div>
            </div>
          )}

          {/* User */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="font-semibold text-primary-foreground">JD</span>
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">John Doe</p>
                  <p className="text-xs text-muted-foreground">Free Plan</p>
                </div>
              )}
              <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass rounded-lg"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Main Content */}
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
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-6 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-secondary">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(stat.status)}`} />
                </div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold">{stat.value}</span>
                  <span
                    className={`text-sm flex items-center gap-1 ${
                      stat.positive ? "text-success" : "text-destructive"
                    }`}
                  >
                    {stat.positive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {stat.change}
                  </span>
                </div>
              </motion.div>
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

          {/* Channel Analysis CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-xl p-6 bg-gradient-to-r from-primary/10 via-background to-accent/10"
          >
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
                    Get deep insights and personalized growth strategies powered by GPT-5.2
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

export default Dashboard;
