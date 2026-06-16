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
import { SubscriptionPlan } from "@/lib/planLimits";
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
  MessageSquare,
  Send,
} from "lucide-react";
import { Link } from "react-router-dom";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  plan: SubscriptionPlan | null;
  status: string;
}

interface AdminListUsersResponse {
  users: User[];
  total: number;
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

interface SupportChatSession {
  id: string;
  user_id: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface SupportChatMessage {
  id: string;
  session_id: string;
  sender: "user" | "agent" | "system";
  content: string;
  created_at: string;
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
  const [chatSessions, setChatSessions] = useState<SupportChatSession[]>([]);
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportChatMessage[]>([]);
  const [chatReply, setChatReply] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatSessionUserMap, setChatSessionUserMap] = useState<Record<string, { email: string; full_name: string | null }>>({});
  const [usersLoading, setUsersLoading] = useState(false);

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
      fetchChatSessions();
    }
  }, [isAdmin, currentPage, planFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [planFilter, searchTerm]);

  useEffect(() => {
    if (!selectedChatSessionId) {
      setChatMessages([]);
      return;
    }
    void fetchChatMessages(selectedChatSessionId);
  }, [selectedChatSessionId]);

  useEffect(() => {
    if (!selectedChatSessionId) return;

    const channel = supabase
      .channel(`admin-support-chat-${selectedChatSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_chat_messages",
          filter: `session_id=eq.${selectedChatSessionId}`,
        },
        (payload) => {
          const incoming = payload.new as SupportChatMessage;
          setChatMessages((prev) => {
            if (prev.some((item) => item.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          setChatSessions((prev) =>
            prev.map((session) =>
              session.id === incoming.session_id
                ? { ...session, updated_at: incoming.created_at, last_message_at: incoming.created_at }
                : session
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChatSessionId]);

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
    setUsersLoading(true);
    const { data, error } = await supabase.functions.invoke<AdminListUsersResponse>("account-actions", {
      body: {
        action: "admin-list-users",
        search: searchTerm,
        planFilter,
        page: currentPage,
        perPage: usersPerPage,
      },
    });

    if (error) {
      toast.error(`Failed to load users: ${error.message}`);
      setUsers([]);
      setTotalUsers(0);
      setUsersLoading(false);
      return;
    }

    setUsers(data?.users || []);
    setTotalUsers(data?.total || 0);
    setUsersLoading(false);
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

  const fetchChatSessions = async () => {
    setChatLoading(true);
    const db = supabase as any;

    const { data: sessions, error } = await db
      .from("support_chat_sessions")
      .select("id, user_id, status, created_at, updated_at, last_message_at")
      .order("last_message_at", { ascending: false });

    if (error) {
      toast.error("Failed to load live chats");
      setChatLoading(false);
      return;
    }

    const sessionRows = (sessions || []) as SupportChatSession[];
    setChatSessions(sessionRows);

    if (!selectedChatSessionId && sessionRows.length > 0) {
      setSelectedChatSessionId(sessionRows[0].id);
    }

    const userIds = Array.from(new Set(sessionRows.map((s) => s.user_id)));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds);

      const map: Record<string, { email: string; full_name: string | null }> = {};
      (profiles || []).forEach((p: any) => {
        map[p.user_id] = {
          email: p.email || "",
          full_name: p.full_name || null,
        };
      });
      setChatSessionUserMap(map);
    } else {
      setChatSessionUserMap({});
    }

    setChatLoading(false);
  };

  const fetchChatMessages = async (sessionId: string) => {
    const db = supabase as any;
    const { data, error } = await db
      .from("support_chat_messages")
      .select("id, session_id, sender, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load chat messages");
      return;
    }

    setChatMessages((data || []) as SupportChatMessage[]);
  };

  const handleSendAdminReply = async () => {
    if (!selectedChatSessionId || !chatReply.trim()) return;
    setChatSending(true);

    const { error } = await supabase.functions.invoke("send-support-chat-message", {
      body: {
        sessionId: selectedChatSessionId,
        content: chatReply.trim(),
      },
    });

    if (error) {
      toast.error("Failed to send reply");
    } else {
      setChatReply("");
      toast.success("Reply sent");
    }

    setChatSending(false);
  };

  const handleToggleChatSessionStatus = async (session: SupportChatSession) => {
    const db = supabase as any;
    const nextStatus = session.status === "open" ? "closed" : "open";
    const { error } = await db
      .from("support_chat_sessions")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", session.id);

    if (error) {
      toast.error("Failed to update chat status");
      return;
    }

    setChatSessions((prev) =>
      prev.map((item) => (item.id === session.id ? { ...item, status: nextStatus } : item))
    );
    toast.success(`Chat marked as ${nextStatus}`);
  };

  const handleOpenUserChat = async (targetUserId: string) => {
    const db = supabase as any;
    setActiveTab("chats");
    const { data: session } = await db
      .from("support_chat_sessions")
      .select("id")
      .eq("user_id", targetUserId)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session?.id) {
      setSelectedChatSessionId(session.id);
      return;
    }

    toast.error("No chat found for this user.");
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

  const handleEditUser = async (targetUser: User) => {
    const nextName = prompt("Update full name", targetUser.full_name || "");
    if (nextName === null) return;
    const nextEmail = prompt("Update email", targetUser.email || "");
    if (nextEmail === null) return;

    const { error } = await supabase.functions.invoke("account-actions", {
      body: {
        action: "admin-update-user",
        targetUserId: targetUser.id,
        fullName: nextName,
        email: nextEmail,
      },
    });

    if (error) {
      toast.error(`Failed to update user: ${error.message}`);
      return;
    }

    toast.success("User updated");
    fetchUsers();
    fetchStats();
  };

  const handleDeleteUser = async (targetUser: User) => {
    const confirmed = confirm(`Delete user ${targetUser.email}? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase.functions.invoke("account-actions", {
      body: {
        action: "delete-account",
        targetUserId: targetUser.id,
      },
    });

    if (error) {
      toast.error(`Failed to delete user: ${error.message}`);
      return;
    }

    toast.success("User deleted");
    fetchUsers();
    fetchStats();
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
                <span className="font-display font-bold text-sm sm:text-lg leading-tight">
                  YouTube <span className="gradient-text">Growth Planner</span>
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
            <TabsTrigger value="chats" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Live Chats
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
                    <SelectItem value="active">Active Subscribers</SelectItem>
                    <SelectItem value="none">No Active Plan</SelectItem>
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
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Loading users...
                        </TableCell>
                      </TableRow>
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No users found for this filter.
                        </TableCell>
                      </TableRow>
                    ) : users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.full_name || "No name"}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.plan ?? "none"}
                            onValueChange={(v) => {
                              if (v === "none") return;
                              handleUpdatePlan(u.id, v as SubscriptionPlan);
                            }}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Active Plan</SelectItem>
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
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleOpenUserChat(u.id)}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Open Chat
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleEditUser(u)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleDeleteUser(u)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
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

          <TabsContent value="chats">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="glass rounded-xl p-4 lg:col-span-1">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-bold">Conversations</h2>
                  <Button size="sm" variant="outline" onClick={() => void fetchChatSessions()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-[520px] overflow-auto">
                  {chatLoading ? (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading chats...
                    </div>
                  ) : chatSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No live chats yet.</p>
                  ) : (
                    chatSessions.map((session) => {
                      const profile = chatSessionUserMap[session.user_id];
                      const isSelected = selectedChatSessionId === session.id;

                      return (
                        <button
                          key={session.id}
                          className={`w-full text-left rounded-lg border p-3 transition ${isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"}`}
                          onClick={() => setSelectedChatSessionId(session.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{profile?.full_name || profile?.email || session.user_id.slice(0, 8)}</p>
                            <Badge variant="outline" className={session.status === "open" ? "text-green-500 border-green-500/30" : "text-muted-foreground"}>
                              {session.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{profile?.email || session.user_id}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Last activity: {new Date(session.last_message_at).toLocaleString()}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="glass rounded-xl p-4 lg:col-span-2">
                {!selectedChatSessionId ? (
                  <div className="h-[520px] flex items-center justify-center text-muted-foreground">
                    Select a chat conversation
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold">
                          {chatSessionUserMap[chatSessions.find((s) => s.id === selectedChatSessionId)?.user_id || ""]?.full_name ||
                            chatSessionUserMap[chatSessions.find((s) => s.id === selectedChatSessionId)?.user_id || ""]?.email ||
                            "User Chat"}
                        </p>
                        <p className="text-xs text-muted-foreground">Session: {selectedChatSessionId}</p>
                      </div>
                      {(() => {
                        const current = chatSessions.find((s) => s.id === selectedChatSessionId);
                        if (!current) return null;
                        return (
                          <Button
                            size="sm"
                            variant={current.status === "open" ? "outline" : "default"}
                            onClick={() => void handleToggleChatSessionStatus(current)}
                          >
                            {current.status === "open" ? "Close Chat" : "Reopen Chat"}
                          </Button>
                        );
                      })()}
                    </div>

                    <div className="h-[420px] overflow-auto rounded-lg border border-border bg-secondary/20 p-4 space-y-3 mb-4">
                      {chatMessages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No messages yet.</p>
                      ) : (
                        chatMessages.map((msg) => {
                          const isAgent = msg.sender === "agent";
                          return (
                            <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isAgent ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <p className={`text-[11px] mt-1 ${isAgent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                  {msg.sender} · {new Date(msg.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Write a reply..."
                        value={chatReply}
                        onChange={(e) => setChatReply(e.target.value)}
                        rows={2}
                      />
                      <Button
                        className="self-end"
                        onClick={() => void handleSendAdminReply()}
                        disabled={!chatReply.trim() || chatSending}
                      >
                        {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </>
                )}
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
        <Select
          value={formData.verification_metric || "none"}
          onValueChange={(v) =>
            setFormData({ ...formData, verification_metric: v === "none" ? "" : v })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Verification Metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
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
