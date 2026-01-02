import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Youtube,
  Sparkles,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crown,
  UserCheck,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

type SubscriptionPlan = "free" | "basic" | "pro" | "advanced";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  plan: SubscriptionPlan;
  status: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "subscriptions">("overview");
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const usersPerPage = 10;

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    revenue: 0,
    growth: 0,
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/dashboard");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchUsers();
    }
  }, [isAdmin, currentPage, planFilter, searchTerm]);

  const fetchStats = async () => {
    // Fetch total users
    const { count: userCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Fetch active subscriptions
    const { count: activeCount } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .in("status", ["active", "trialing"]);

    // Fetch paid subscriptions for revenue estimation
    const { data: paidSubs } = await supabase
      .from("subscriptions")
      .select("plan, billing_cycle")
      .in("plan", ["basic", "pro", "advanced"])
      .in("status", ["active", "trialing"]);

    let estimatedRevenue = 0;
    paidSubs?.forEach((sub) => {
      const prices: Record<string, { monthly: number; yearly: number }> = {
        basic: { monthly: 7, yearly: 70 },
        pro: { monthly: 15, yearly: 120 },
        advanced: { monthly: 25, yearly: 230 },
      };
      if (sub.plan in prices) {
        const price = prices[sub.plan as keyof typeof prices];
        estimatedRevenue += sub.billing_cycle === "yearly" ? price.yearly / 12 : price.monthly;
      }
    });

    setStats({
      totalUsers: userCount || 0,
      activeSubscriptions: activeCount || 0,
      revenue: estimatedRevenue,
      growth: 12.5, // Placeholder
    });
  };

  const fetchUsers = async () => {
    let query = supabase
      .from("profiles")
      .select(`
        id,
        user_id,
        email,
        full_name,
        created_at
      `)
      .order("created_at", { ascending: false })
      .range((currentPage - 1) * usersPerPage, currentPage * usersPerPage - 1);

    if (searchTerm) {
      query = query.or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
    }

    const { data: profiles, count } = await query;

    if (profiles) {
      // Fetch subscriptions for these users
      const userIds = profiles.map((p) => p.user_id);
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("user_id, plan, status")
        .in("user_id", userIds);

      const usersWithSubs: User[] = profiles.map((profile) => {
        const sub = subscriptions?.find((s) => s.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: profile.email || "",
          full_name: profile.full_name,
          created_at: profile.created_at,
          plan: (sub?.plan as SubscriptionPlan) || "free",
          status: sub?.status || "unknown",
        };
      });

      // Apply plan filter client-side for now
      const filtered = planFilter === "all" 
        ? usersWithSubs 
        : usersWithSubs.filter((u) => u.plan === planFilter);

      setUsers(filtered);
      setTotalUsers(count || 0);
    }
  };

  const handleUpdatePlan = async (userId: string, newPlan: SubscriptionPlan) => {
    const { error } = await supabase
      .from("subscriptions")
      .update({ plan: newPlan })
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update plan");
    } else {
      toast.success("Plan updated successfully");
      fetchUsers();
      fetchStats();
    }
  };

  const statsCards = [
    { label: "Total Users", value: stats.totalUsers.toString(), icon: Users, color: "text-primary" },
    { label: "Active Subscriptions", value: stats.activeSubscriptions.toString(), icon: UserCheck, color: "text-success" },
    { label: "Monthly Revenue", value: `$${stats.revenue.toFixed(0)}`, icon: DollarSign, color: "text-warning" },
    { label: "Growth", value: `+${stats.growth}%`, icon: TrendingUp, color: "text-accent" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-strong border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="flex items-center gap-2">
                <div className="relative">
                  <Youtube className="h-8 w-8 text-primary" />
                  <Sparkles className="h-3 w-3 text-accent absolute -top-1 -right-1" />
                </div>
                <span className="font-display font-bold text-lg">
                  Tube<span className="gradient-text">Grow</span>
                </span>
              </Link>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Admin Panel</span>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "users", label: "Users", icon: Users },
            { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statsCards.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass rounded-xl p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg bg-secondary`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="font-display text-2xl font-bold">{stat.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Plan Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-xl p-6"
            >
              <h3 className="font-display font-semibold text-lg mb-6">Plan Distribution</h3>
              <div className="grid grid-cols-4 gap-4">
                {["free", "basic", "pro", "advanced"].map((plan) => (
                  <div key={plan} className="text-center">
                    <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
                      plan === "advanced" ? "bg-gradient-to-br from-primary to-accent" :
                      plan === "pro" ? "bg-primary/20" :
                      plan === "basic" ? "bg-accent/20" : "bg-secondary"
                    }`}>
                      <Crown className={`h-6 w-6 ${
                        plan === "advanced" ? "text-primary-foreground" : "text-foreground"
                      }`} />
                    </div>
                    <p className="font-medium capitalize">{plan}</p>
                    <p className="text-sm text-muted-foreground">
                      {users.filter(u => u.plan === plan).length} users
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Users Tab */}
        {(activeTab === "users" || activeTab === "subscriptions") && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-6"
          >
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.plan}
                          onValueChange={(value) => handleUpdatePlan(user.id, value as SubscriptionPlan)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.status === "active" ? "bg-success/20 text-success" :
                          user.status === "trialing" ? "bg-primary/20 text-primary" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {user.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * usersPerPage + 1} to {Math.min(currentPage * usersPerPage, totalUsers)} of {totalUsers} users
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage * usersPerPage >= totalUsers}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
