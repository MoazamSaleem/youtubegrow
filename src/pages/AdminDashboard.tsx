import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Youtube,
  Sparkles,
  Users,
  CreditCard,
  BarChart3,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crown,
  UserCheck,
  DollarSign,
  TrendingUp,
  Target,
  Trophy,
  Award,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Coins,
  Zap,
  RefreshCw,
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

interface GrowthTask {
  id: string;
  title: string;
  description: string;
  tier: string;
  token_reward: number;
  xp_reward: number;
  difficulty: string;
  is_recurring: boolean;
  reset_frequency: string | null;
  verification_metric?: string | null;
  verification_operator?: string | null;
  verification_threshold?: number | null;
  verification_window_days?: number | null;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  tier: string;
  required_xp: number;
  token_reward: number;
  icon: string;
}

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<GrowthTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const usersPerPage = 10;
  const [editingTask, setEditingTask] = useState<GrowthTask | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editingBadge, setEditingBadge] = useState<BadgeData | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const [isBadgeDialogOpen, setIsBadgeDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    revenue: 0,
    totalTasks: 0,
    totalMilestones: 0,
    totalBadges: 0,
    totalTokensEarned: 0,
    totalXpEarned: 0,
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
      fetchTasks();
      fetchMilestones();
      fetchBadges();
    }
  }, [isAdmin, currentPage, planFilter, searchTerm]);

  const fetchStats = async () => {
    const [
      { count: userCount },
      { count: activeCount },
      { data: paidSubs },
      { count: taskCount },
      { count: milestoneCount },
      { count: badgeCount },
      { data: tokenData },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).in("status", ["active", "trialing"]),
      supabase.from("subscriptions").select("plan, billing_cycle").in("plan", ["basic", "pro", "advanced"]).in("status", ["active", "trialing"]),
      supabase.from("growth_tasks").select("*", { count: "exact", head: true }),
      supabase.from("milestones").select("*", { count: "exact", head: true }),
      supabase.from("badges").select("*", { count: "exact", head: true }),
      supabase.from("user_tokens").select("total_earned, current_xp"),
    ]);

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

    const totalTokens = tokenData?.reduce((sum, t) => sum + (t.total_earned || 0), 0) || 0;
    const totalXp = tokenData?.reduce((sum, t) => sum + (t.current_xp || 0), 0) || 0;

    setStats({
      totalUsers: userCount || 0,
      activeSubscriptions: activeCount || 0,
      revenue: estimatedRevenue,
      totalTasks: taskCount || 0,
      totalMilestones: milestoneCount || 0,
      totalBadges: badgeCount || 0,
      totalTokensEarned: totalTokens,
      totalXpEarned: totalXp,
    });
  };

  const fetchUsers = async () => {
    let query = supabase
      .from("profiles")
      .select("id, user_id, email, full_name, created_at")
      .order("created_at", { ascending: false })
      .range((currentPage - 1) * usersPerPage, currentPage * usersPerPage - 1);

    if (searchTerm) {
      query = query.or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
    }

    const { data: profiles, count } = await query;

    if (profiles) {
      const userIds = profiles.map((p) => p.user_id);
      const { data: subscriptions } = await supabase.from("subscriptions").select("user_id, plan, status").in("user_id", userIds);

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

      const filtered = planFilter === "all" ? usersWithSubs : usersWithSubs.filter((u) => u.plan === planFilter);
      setUsers(filtered);
      setTotalUsers(count || 0);
    }
  };

  const fetchTasks = async () => {
    const { data } = await supabase.from("growth_tasks").select("*").order("order_index");
    setTasks(data || []);
  };

  const fetchMilestones = async () => {
    const { data } = await supabase.from("milestones").select("*").order("order_index");
    setMilestones(data || []);
  };

  const fetchBadges = async () => {
    const { data } = await supabase.from("badges").select("*");
    setBadges(data || []);
  };

  const handleUpdatePlan = async (userId: string, newPlan: SubscriptionPlan) => {
    const { error } = await supabase.from("subscriptions").update({ plan: newPlan }).eq("user_id", userId);
    if (error) {
      toast.error("Failed to update plan");
    } else {
      toast.success("Plan updated successfully");
      fetchUsers();
      fetchStats();
    }
  };

  const saveTask = async (task: Partial<GrowthTask>) => {
    setSaving(true);
    try {
      const normalizedTask = {
        ...task,
        verification_metric: task.verification_metric || null,
        verification_operator: task.verification_metric ? task.verification_operator || ">=" : null,
        verification_threshold: task.verification_metric
          ? task.verification_threshold ?? null
          : null,
        verification_window_days: task.verification_metric
          ? task.verification_window_days ?? null
          : null,
      };
      if (editingTask?.id) {
        await supabase.from("growth_tasks").update(normalizedTask).eq("id", editingTask.id);
        toast.success("Task updated");
      } else {
        // Add required fields for insert
        const insertData = {
          ...normalizedTask,
          category: "general",
          title: task.title || "New Task",
        };
        await supabase.from("growth_tasks").insert([insertData]);
        toast.success("Task created");
      }
      setIsTaskDialogOpen(false);
      setEditingTask(null);
      fetchTasks();
      fetchStats();
    } catch (error) {
      toast.error("Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("growth_tasks").delete().eq("id", id);
    toast.success("Task deleted");
    fetchTasks();
    fetchStats();
  };

  const saveMilestone = async (milestone: Partial<Milestone>) => {
    setSaving(true);
    try {
      if (editingMilestone?.id) {
        await supabase.from("milestones").update(milestone).eq("id", editingMilestone.id);
        toast.success("Milestone updated");
      } else {
        const insertData = {
          ...milestone,
          title: milestone.title || "New Milestone",
          required_xp: milestone.required_xp || 100,
        };
        await supabase.from("milestones").insert([insertData]);
        toast.success("Milestone created");
      }
      setIsMilestoneDialogOpen(false);
      setEditingMilestone(null);
      fetchMilestones();
      fetchStats();
    } catch (error) {
      toast.error("Failed to save milestone");
    } finally {
      setSaving(false);
    }
  };

  const deleteMilestone = async (id: string) => {
    if (!confirm("Delete this milestone?")) return;
    await supabase.from("milestones").delete().eq("id", id);
    toast.success("Milestone deleted");
    fetchMilestones();
    fetchStats();
  };

  const saveBadge = async (badge: Partial<BadgeData>) => {
    setSaving(true);
    try {
      if (editingBadge?.id) {
        await supabase.from("badges").update(badge).eq("id", editingBadge.id);
        toast.success("Badge updated");
      } else {
        const insertData = {
          ...badge,
          name: badge.name || "New Badge",
          icon: badge.icon || "star",
        };
        await supabase.from("badges").insert([insertData]);
        toast.success("Badge created");
      }
      setIsBadgeDialogOpen(false);
      setEditingBadge(null);
      fetchBadges();
      fetchStats();
    } catch (error) {
      toast.error("Failed to save badge");
    } finally {
      setSaving(false);
    }
  };

  const deleteBadge = async (id: string) => {
    if (!confirm("Delete this badge?")) return;
    await supabase.from("badges").delete().eq("id", id);
    toast.success("Badge deleted");
    fetchBadges();
    fetchStats();
  };

  const statsCards = [
    { label: "Total Users", value: stats.totalUsers.toString(), icon: Users, color: "text-primary" },
    { label: "Active Subs", value: stats.activeSubscriptions.toString(), icon: UserCheck, color: "text-green-500" },
    { label: "Monthly Revenue", value: `$${stats.revenue.toFixed(0)}`, icon: DollarSign, color: "text-yellow-500" },
    { label: "Total Tasks", value: stats.totalTasks.toString(), icon: Target, color: "text-blue-500" },
    { label: "Milestones", value: stats.totalMilestones.toString(), icon: Trophy, color: "text-purple-500" },
    { label: "Badges", value: stats.totalBadges.toString(), icon: Award, color: "text-orange-500" },
    { label: "Tokens Earned", value: stats.totalTokensEarned.toLocaleString(), icon: Coins, color: "text-yellow-500" },
    { label: "Total XP", value: stats.totalXpEarned.toLocaleString(), icon: Zap, color: "text-cyan-500" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

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
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <Shield className="h-3 w-3 mr-1" />
                Admin Panel
              </Badge>
            </div>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <Target className="h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="milestones" className="gap-2">
              <Trophy className="h-4 w-4" />
              Milestones
            </TabsTrigger>
            <TabsTrigger value="badges" className="gap-2">
              <Award className="h-4 w-4" />
              Badges
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statsCards.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass rounded-xl p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="font-display text-2xl font-bold">{stat.value}</p>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="glass rounded-xl p-6">
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

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.full_name || "No name"}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select value={u.plan} onValueChange={(v) => handleUpdatePlan(u.id, v as SubscriptionPlan)}>
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
                          <Badge
                            variant="secondary"
                            className={
                              u.status === "active"
                                ? "bg-green-500/10 text-green-500"
                                : u.status === "trialing"
                                ? "bg-primary/10 text-primary"
                                : ""
                            }
                          >
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {Math.ceil(totalUsers / usersPerPage)}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage * usersPerPage >= totalUsers}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold">Growth Tasks</h2>
                <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingTask(null)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
                    </DialogHeader>
                    <TaskForm task={editingTask} onSave={saveTask} saving={saving} />
                  </DialogContent>
                </Dialog>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Rewards</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[300px]">{task.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {task.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className="gap-1">
                              <Coins className="h-3 w-3" />
                              {task.token_reward}
                            </Badge>
                            <Badge variant="secondary" className="gap-1">
                              <Zap className="h-3 w-3" />
                              {task.xp_reward}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {task.is_recurring ? (
                            <Badge variant="outline" className="gap-1">
                              <RefreshCw className="h-3 w-3" />
                              {task.reset_frequency}
                            </Badge>
                          ) : (
                            <Badge variant="outline">One-time</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTask(task);
                                setIsTaskDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteTask(task.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Milestones Tab */}
          <TabsContent value="milestones">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold">Milestones</h2>
                <Dialog open={isMilestoneDialogOpen} onOpenChange={setIsMilestoneDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingMilestone(null)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Milestone
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingMilestone ? "Edit Milestone" : "New Milestone"}</DialogTitle>
                    </DialogHeader>
                    <MilestoneForm milestone={editingMilestone} onSave={saveMilestone} saving={saving} />
                  </DialogContent>
                </Dialog>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Required XP</TableHead>
                      <TableHead>Reward</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {milestones.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{m.title}</p>
                            <p className="text-sm text-muted-foreground">{m.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {m.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Zap className="h-3 w-3" />
                            {m.required_xp.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Coins className="h-3 w-3" />
                            {m.token_reward}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingMilestone(m);
                                setIsMilestoneDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteMilestone(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Badges Tab */}
          <TabsContent value="badges">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold">Badges</h2>
                <Dialog open={isBadgeDialogOpen} onOpenChange={setIsBadgeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingBadge(null)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Badge
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingBadge ? "Edit Badge" : "New Badge"}</DialogTitle>
                    </DialogHeader>
                    <BadgeForm badge={editingBadge} onSave={saveBadge} saving={saving} />
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {badges.map((badge) => (
                  <div key={badge.id} className="glass rounded-xl p-4 flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${
                        badge.rarity === "legendary"
                          ? "from-yellow-400 to-orange-500"
                          : badge.rarity === "epic"
                          ? "from-purple-400 to-purple-600"
                          : badge.rarity === "rare"
                          ? "from-blue-400 to-blue-600"
                          : "from-slate-400 to-slate-500"
                      }`}
                    >
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{badge.name}</p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {badge.rarity}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingBadge(badge);
                          setIsBadgeDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteBadge(badge.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// Task Form Component
const TaskForm = ({ task, onSave, saving }: { task: GrowthTask | null; onSave: (t: Partial<GrowthTask>) => void; saving: boolean }) => {
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    tier: task?.tier || "basic",
    token_reward: task?.token_reward || 10,
    xp_reward: task?.xp_reward || 50,
    difficulty: task?.difficulty || "easy",
    is_recurring: task?.is_recurring || false,
    reset_frequency: task?.reset_frequency || null,
    verification_metric: task?.verification_metric || "",
    verification_operator: task?.verification_operator || ">=",
    verification_threshold: task?.verification_threshold || 0,
    verification_window_days: task?.verification_window_days || null,
  });

  return (
    <div className="space-y-4">
      <Input placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
      <Textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
      <div className="grid grid-cols-2 gap-4">
        <Select value={formData.tier} onValueChange={(v) => setFormData({ ...formData, tier: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input type="number" placeholder="Token Reward" value={formData.token_reward} onChange={(e) => setFormData({ ...formData, token_reward: +e.target.value })} />
        <Input type="number" placeholder="XP Reward" value={formData.xp_reward} onChange={(e) => setFormData({ ...formData, xp_reward: +e.target.value })} />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={formData.is_recurring} onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })} />
          Recurring
        </label>
        {formData.is_recurring && (
          <Select value={formData.reset_frequency || ""} onValueChange={(v) => setFormData({ ...formData, reset_frequency: v })}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select value={formData.verification_metric} onValueChange={(v) => setFormData({ ...formData, verification_metric: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Verification Metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            <SelectItem value="subscribers">Subscribers</SelectItem>
            <SelectItem value="videos">Total Videos</SelectItem>
            <SelectItem value="views_total">Total Views</SelectItem>
            <SelectItem value="views_28d">Views (28d)</SelectItem>
            <SelectItem value="watch_minutes_365">Watch Minutes (365d)</SelectItem>
            <SelectItem value="avg_view_duration_28d">Avg View Duration (28d)</SelectItem>
            <SelectItem value="subscribers_gained_28d">Subscribers Gained (28d)</SelectItem>
            <SelectItem value="uploads_30d">Uploads (30d)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={formData.verification_operator} onValueChange={(v) => setFormData({ ...formData, verification_operator: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=">=">{">="}</SelectItem>
            <SelectItem value=">">{">"}</SelectItem>
            <SelectItem value="==">{"=="}</SelectItem>
            <SelectItem value="<=">{"<="}</SelectItem>
            <SelectItem value="<">{"<"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          type="number"
          placeholder="Verification Threshold"
          value={formData.verification_threshold}
          onChange={(e) => setFormData({ ...formData, verification_threshold: Number(e.target.value) })}
        />
        <Input
          type="number"
          placeholder="Verification Window (days)"
          value={formData.verification_window_days ?? ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              verification_window_days: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </div>
      <Button onClick={() => onSave(formData)} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
    </div>
  );
};

// Milestone Form Component
const MilestoneForm = ({ milestone, onSave, saving }: { milestone: Milestone | null; onSave: (m: Partial<Milestone>) => void; saving: boolean }) => {
  const [formData, setFormData] = useState({
    title: milestone?.title || "",
    description: milestone?.description || "",
    tier: milestone?.tier || "basic",
    required_xp: milestone?.required_xp || 100,
    token_reward: milestone?.token_reward || 25,
    icon: milestone?.icon || "star",
  });

  return (
    <div className="space-y-4">
      <Input placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
      <Textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
      <div className="grid grid-cols-2 gap-4">
        <Select value={formData.tier} onValueChange={(v) => setFormData({ ...formData, tier: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Icon (e.g. star)" value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input type="number" placeholder="Required XP" value={formData.required_xp} onChange={(e) => setFormData({ ...formData, required_xp: +e.target.value })} />
        <Input type="number" placeholder="Token Reward" value={formData.token_reward} onChange={(e) => setFormData({ ...formData, token_reward: +e.target.value })} />
      </div>
      <Button onClick={() => onSave(formData)} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
    </div>
  );
};

// Badge Form Component
const BadgeForm = ({ badge, onSave, saving }: { badge: BadgeData | null; onSave: (b: Partial<BadgeData>) => void; saving: boolean }) => {
  const [formData, setFormData] = useState({
    name: badge?.name || "",
    description: badge?.description || "",
    icon: badge?.icon || "star",
    color: badge?.color || "primary",
    rarity: badge?.rarity || "common",
  });

  return (
    <div className="space-y-4">
      <Input placeholder="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
      <Textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
      <div className="grid grid-cols-2 gap-4">
        <Input placeholder="Icon (e.g. star)" value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} />
        <Select value={formData.rarity} onValueChange={(v) => setFormData({ ...formData, rarity: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Rarity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="common">Common</SelectItem>
            <SelectItem value="rare">Rare</SelectItem>
            <SelectItem value="epic">Epic</SelectItem>
            <SelectItem value="legendary">Legendary</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={() => onSave(formData)} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
    </div>
  );
};

export default AdminDashboard;
