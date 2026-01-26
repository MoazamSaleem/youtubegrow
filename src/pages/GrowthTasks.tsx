import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_LIMITS } from "@/lib/planLimits";
import {
  Rocket,
  Star,
  Crown,
  Check,
  Lock,
  Coins,
  Zap,
  Gift,
  Trophy,
  Target,
  Loader2,
  Sparkles,
  ChevronRight,
  Award,
  TrendingUp,
  Heart,
  Video,
  CheckCircle,
  DollarSign,
  RefreshCw,
  Calendar,
  Clock,
} from "lucide-react";

interface GrowthTask {
  id: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  token_reward: number;
  xp_reward: number;
  difficulty: string;
  order_index: number;
  is_recurring: boolean;
  reset_frequency: string | null;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  tier: string;
  required_xp: number;
  token_reward: number;
  icon: string;
  order_index: number;
}

interface UserTokens {
  balance: number;
  total_earned: number;
  current_xp: number;
  ai_credits_balance: number;
  ai_credits_used: number;
}

interface Perk {
  id: string;
  name: string;
  description: string;
  token_cost: number;
  perk_type: string;
}

interface RecurringCompletion {
  task_id: string;
  period_start: string;
  verified_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
}

interface AiTask {
  id: string;
  task_set_id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  token_reward: number;
  xp_reward: number;
  order_index: number;
  verified_at: string | null;
  claimed_at: string | null;
  verification_metric?: string | null;
  verification_operator?: string | null;
  verification_threshold?: number | null;
  verification_window_days?: number | null;
}

const ICON_MAP: Record<string, React.ElementType> = {
  rocket: Rocket,
  star: Star,
  crown: Crown,
  "check-circle": CheckCircle,
  video: Video,
  heart: Heart,
  "trending-up": TrendingUp,
  "dollar-sign": DollarSign,
  award: Award,
};

const GrowthTasks = () => {
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<GrowthTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [taskProgress, setTaskProgress] = useState<Record<string, { verified_at: string | null; claimed_at: string | null }>>({});
  const [recurringCompletions, setRecurringCompletions] = useState<RecurringCompletion[]>([]);
  const [aiTasks, setAiTasks] = useState<AiTask[]>([]);
  const [aiStepIndex, setAiStepIndex] = useState<number | null>(null);
  const [isGeneratingAiTasks, setIsGeneratingAiTasks] = useState(false);
  const [unlockedMilestoneIds, setUnlockedMilestoneIds] = useState<Set<string>>(new Set());
  const [claimedMilestoneIds, setClaimedMilestoneIds] = useState<Set<string>>(new Set());
  const [unlockedPerkIds, setUnlockedPerkIds] = useState<Set<string>>(new Set());
  const [userTokens, setUserTokens] = useState<UserTokens>({ 
    balance: 0, total_earned: 0, current_xp: 0, ai_credits_balance: 0, ai_credits_used: 0 
  });
  const [activeTab, setActiveTab] = useState("tasks");
  const [processingTask, setProcessingTask] = useState<string | null>(null);
  const [processingMilestone, setProcessingMilestone] = useState<string | null>(null);
  const [processingPerk, setProcessingPerk] = useState<string | null>(null);
  const aiGenerateRef = useRef(false);

  const currentPlan = subscription?.plan || "free";
  const userTier = currentPlan === "free" ? "basic" : currentPlan === "basic" ? "basic" : currentPlan === "pro" ? "pro" : "advanced";
  const planLimits = PLAN_LIMITS[currentPlan];

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!user || loading) return;
    if (aiGenerateRef.current) return;
    const allClaimed = aiTasks.length > 0 && aiTasks.every((task) => task.claimed_at);
    if (aiTasks.length === 0 || allClaimed) {
      aiGenerateRef.current = true;
      generateAiTasks(allClaimed);
    }
  }, [user, loading, aiTasks]);

  // Get current period start/end for a recurring task
  const getCurrentPeriod = (frequency: string) => {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (frequency === "daily") {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);
    } else if (frequency === "weekly") {
      const dayOfWeek = now.getDay();
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - dayOfWeek);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 7);
    } else {
      // monthly
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return {
      periodStart: periodStart.toISOString().split("T")[0],
      periodEnd: periodEnd.toISOString().split("T")[0],
    };
  };

  const isRecurringTaskVerified = (task: GrowthTask) => {
    if (!task.is_recurring || !task.reset_frequency) return false;
    const { periodStart } = getCurrentPeriod(task.reset_frequency);
    return recurringCompletions.some(
      (c) => c.task_id === task.id && c.period_start === periodStart && Boolean(c.verified_at)
    );
  };

  const isRecurringTaskClaimed = (task: GrowthTask) => {
    if (!task.is_recurring || !task.reset_frequency) return false;
    const { periodStart } = getCurrentPeriod(task.reset_frequency);
    return recurringCompletions.some(
      (c) => c.task_id === task.id && c.period_start === periodStart && Boolean(c.claimed_at)
    );
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch tasks
      const { data: tasksData } = await supabase
        .from("growth_tasks")
        .select("*")
        .order("order_index");
      setTasks(tasksData || []);

      // Fetch milestones
      const { data: milestonesData } = await supabase
        .from("milestones")
        .select("*")
        .order("order_index");
      setMilestones(milestonesData || []);

      // Fetch perks
      const { data: perksData } = await supabase
        .from("perks")
        .select("*")
        .eq("is_active", true);
      setPerks(perksData || []);

      // Fetch user progress for one-time tasks
      const { data: progressData } = await supabase
        .from("user_task_progress")
        .select("task_id, verified_at, claimed_at, completed_at")
        .eq("user_id", user.id);
      const progressMap: Record<string, { verified_at: string | null; claimed_at: string | null }> = {};
      (progressData || []).forEach((progress) => {
        const verifiedAt = progress.verified_at ?? progress.completed_at ?? null;
        const claimedAt = progress.claimed_at ?? progress.completed_at ?? null;
        progressMap[progress.task_id] = { verified_at: verifiedAt, claimed_at: claimedAt };
      });
      setTaskProgress(progressMap);

      // Fetch recurring task completions
      const { data: recurringData } = await supabase
        .from("recurring_task_completions")
        .select("task_id, period_start, verified_at, claimed_at, completed_at")
        .eq("user_id", user.id);
      const normalizedRecurring = (recurringData || []).map((item) => ({
        ...item,
        verified_at: item.verified_at ?? item.completed_at ?? null,
        claimed_at: item.claimed_at ?? item.completed_at ?? null,
      }));
      setRecurringCompletions(normalizedRecurring);

      // Fetch AI-generated task set + tasks
      const { data: aiSet } = await supabase
        .from("user_growth_task_sets")
        .select("id, step_index")
        .eq("user_id", user.id)
        .order("step_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aiSet?.id) {
        const { data: aiTasksData } = await supabase
          .from("user_growth_tasks")
          .select("id, task_set_id, title, description, category, difficulty, token_reward, xp_reward, order_index, verified_at, claimed_at, verification_metric, verification_operator, verification_threshold, verification_window_days")
          .eq("task_set_id", aiSet.id)
          .order("order_index");
        setAiTasks(aiTasksData || []);
        setAiStepIndex(aiSet.step_index);
      } else {
        setAiTasks([]);
        setAiStepIndex(null);
      }

      // Fetch user milestones
      const { data: userMilestonesData } = await supabase
        .from("user_milestones")
        .select("milestone_id, claimed")
        .eq("user_id", user.id);
      setUnlockedMilestoneIds(new Set(userMilestonesData?.map((m) => m.milestone_id) || []));
      setClaimedMilestoneIds(new Set(userMilestonesData?.filter((m) => m.claimed).map((m) => m.milestone_id) || []));

      // Fetch user perks
      const { data: userPerksData } = await supabase
        .from("user_perks")
        .select("perk_id")
        .eq("user_id", user.id);
      setUnlockedPerkIds(new Set(userPerksData?.map((p) => p.perk_id) || []));

      // Fetch user tokens
      const { data: tokensData } = await supabase
        .from("user_tokens")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (tokensData) {
        setUserTokens(tokensData);
      } else {
        // Create initial tokens record with plan's AI credits
        const { data: newTokens } = await supabase
          .from("user_tokens")
          .insert({ 
            user_id: user.id,
            ai_credits_balance: planLimits.aiStrategistCredits 
          })
          .select()
          .single();
        if (newTokens) setUserTokens(newTokens);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const verifyTask = async (task: GrowthTask) => {
    if (!user) return;
    if (task.is_recurring) {
      toast({
        title: "Manual task",
        description: "Recurring tasks cannot be verified via YouTube API.",
        variant: "destructive",
      });
      return;
    }

    if (taskProgress[task.id]?.verified_at) return;
    setProcessingTask(task.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-growth-task`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId: task.id, taskType: "legacy" }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Task verification failed");
      }

      if (!data.verified) {
        toast({
          title: "Not completed yet",
          description: `Current ${data.metric}: ${data.actual}. Target: ${data.target}.`,
          variant: "destructive",
        });
        return;
      }

      await fetchData();
      toast({ title: "Task Verified", description: "You can now claim the reward." });
    } catch (error: any) {
      toast({
        title: "Error verifying task",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingTask(null);
    }
  };

  const generateAiTasks = async (advanceStep: boolean) => {
    if (!user || isGeneratingAiTasks) return;
    setIsGeneratingAiTasks(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const nextStep = advanceStep && aiStepIndex ? aiStepIndex + 1 : undefined;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-growth-tasks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ stepIndex: nextStep }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate growth tasks");
      }

      await fetchData();
      toast({
        title: advanceStep ? "Next steps unlocked" : "Growth tasks ready",
        description: advanceStep
          ? "New growth tasks are available."
          : "Your personalized growth tasks have been generated.",
      });
    } catch (error: any) {
      toast({
        title: "Task generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAiTasks(false);
      aiGenerateRef.current = false;
    }
  };

  const claimTask = async (task: GrowthTask) => {
    if (!user) return;
    const now = new Date().toISOString();

    const isVerified = task.is_recurring
      ? isRecurringTaskVerified(task)
      : Boolean(taskProgress[task.id]?.verified_at);
    const isClaimed = task.is_recurring
      ? isRecurringTaskClaimed(task)
      : Boolean(taskProgress[task.id]?.claimed_at);

    if (!isVerified || isClaimed) return;
    setProcessingTask(task.id);

    try {
      if (task.is_recurring && task.reset_frequency) {
        const { periodStart } = getCurrentPeriod(task.reset_frequency);
        await supabase
          .from("recurring_task_completions")
          .update({ claimed_at: now })
          .eq("user_id", user.id)
          .eq("task_id", task.id)
          .eq("period_start", periodStart);
      } else {
        await supabase
          .from("user_task_progress")
          .update({
            claimed_at: now,
            completed_at: now,
            last_completed_at: now,
            completion_count: 1,
          })
          .eq("user_id", user.id)
          .eq("task_id", task.id);
      }

      // Update tokens
      const newBalance = userTokens.balance + task.token_reward;
      const newXp = userTokens.current_xp + task.xp_reward;
      const newTotalEarned = userTokens.total_earned + task.token_reward;

      await supabase
        .from("user_tokens")
        .update({
          balance: newBalance,
          current_xp: newXp,
          total_earned: newTotalEarned,
          updated_at: now,
        })
        .eq("user_id", user.id);

      setUserTokens({ ...userTokens, balance: newBalance, current_xp: newXp, total_earned: newTotalEarned });
      await fetchData();
      await checkMilestoneUnlocks(newXp);

      toast({
        title: "Reward Claimed!",
        description: `+${task.token_reward} tokens, +${task.xp_reward} XP`,
      });
    } catch (error: any) {
      toast({
        title: "Error claiming reward",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingTask(null);
    }
  };

  const verifyAiTask = async (task: AiTask) => {
    if (!user || task.verified_at) return;
    setProcessingTask(task.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-growth-task`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId: task.id, taskType: "ai" }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Task verification failed");
      }

      if (!data.verified) {
        toast({
          title: "Not completed yet",
          description: `Current ${data.metric}: ${data.actual}. Target: ${data.target}.`,
          variant: "destructive",
        });
        return;
      }

      await fetchData();
      toast({ title: "Task Verified", description: "You can now claim the reward." });
    } catch (error: any) {
      toast({
        title: "Error verifying task",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingTask(null);
    }
  };

  const claimAiTask = async (task: AiTask) => {
    if (!user || task.claimed_at || !task.verified_at) return;
    const now = new Date().toISOString();
    setProcessingTask(task.id);

    try {
      await supabase
        .from("user_growth_tasks")
        .update({ claimed_at: now })
        .eq("id", task.id)
        .eq("user_id", user.id);

      const newBalance = userTokens.balance + task.token_reward;
      const newXp = userTokens.current_xp + task.xp_reward;
      const newTotalEarned = userTokens.total_earned + task.token_reward;

      await supabase
        .from("user_tokens")
        .update({
          balance: newBalance,
          current_xp: newXp,
          total_earned: newTotalEarned,
          updated_at: now,
        })
        .eq("user_id", user.id);

      setUserTokens({ ...userTokens, balance: newBalance, current_xp: newXp, total_earned: newTotalEarned });
      setAiTasks((prev) =>
        prev.map((item) => (item.id === task.id ? { ...item, claimed_at: now } : item))
      );
      await checkMilestoneUnlocks(newXp);
      toast({
        title: "Reward Claimed!",
        description: `+${task.token_reward} tokens, +${task.xp_reward} XP`,
      });
    } catch (error: any) {
      toast({
        title: "Error claiming reward",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingTask(null);
    }
  };

  const checkMilestoneUnlocks = async (currentXp: number) => {
    if (!user) return;

    for (const milestone of milestones) {
      if (!unlockedMilestoneIds.has(milestone.id) && currentXp >= milestone.required_xp) {
        await supabase.from("user_milestones").insert({
          user_id: user.id,
          milestone_id: milestone.id,
        });
        setUnlockedMilestoneIds(new Set([...unlockedMilestoneIds, milestone.id]));

        toast({
          title: "Milestone Unlocked!",
          description: `${milestone.title} - Claim your reward!`,
        });
      }
    }
  };

  const claimMilestone = async (milestone: Milestone) => {
    if (!user || !unlockedMilestoneIds.has(milestone.id) || claimedMilestoneIds.has(milestone.id)) return;
    setProcessingMilestone(milestone.id);

    try {
      await supabase
        .from("user_milestones")
        .update({
          claimed: true,
          claimed_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("milestone_id", milestone.id);

      const newBalance = userTokens.balance + milestone.token_reward;
      const newTotalEarned = userTokens.total_earned + milestone.token_reward;

      await supabase
        .from("user_tokens")
        .update({
          balance: newBalance,
          total_earned: newTotalEarned,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      setUserTokens({ ...userTokens, balance: newBalance, total_earned: newTotalEarned });
      setClaimedMilestoneIds(new Set([...claimedMilestoneIds, milestone.id]));

      toast({
        title: "Reward Claimed!",
        description: `+${milestone.token_reward} tokens added to your balance`,
      });
    } catch (error: any) {
      toast({
        title: "Error claiming reward",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingMilestone(null);
    }
  };

  const unlockPerk = async (perk: Perk) => {
    if (!user || unlockedPerkIds.has(perk.id) || userTokens.balance < perk.token_cost) return;
    setProcessingPerk(perk.id);

    try {
      await supabase.from("user_perks").insert({
        user_id: user.id,
        perk_id: perk.id,
      });

      const newBalance = userTokens.balance - perk.token_cost;

      await supabase
        .from("user_tokens")
        .update({
          balance: newBalance,
          total_spent: (userTokens as any).total_spent + perk.token_cost,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      setUserTokens({ ...userTokens, balance: newBalance });
      setUnlockedPerkIds(new Set([...unlockedPerkIds, perk.id]));

      toast({
        title: "Perk Unlocked!",
        description: `${perk.name} is now active`,
      });
    } catch (error: any) {
      toast({
        title: "Error unlocking perk",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingPerk(null);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "basic":
        return "from-blue-500 to-blue-600";
      case "pro":
        return "from-purple-500 to-purple-600";
      case "advanced":
        return "from-orange-500 to-orange-600";
      default:
        return "from-slate-500 to-slate-600";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "hard":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted";
    }
  };

  const canAccessTier = (tier: string) => {
    if (tier === "basic") return true;
    if (tier === "pro") return userTier === "pro" || userTier === "advanced";
    if (tier === "advanced") return userTier === "advanced";
    return false;
  };

  const getNextMilestone = () => {
    return milestones.find((m) => userTokens.current_xp < m.required_xp);
  };

  const nextMilestone = getNextMilestone();
  const progressToNext = nextMilestone ? (userTokens.current_xp / nextMilestone.required_xp) * 100 : 100;
  const claimedOneTimeCount = Object.values(taskProgress).filter((progress) => progress.claimed_at).length;
  const claimedRecurringCount = recurringCompletions.filter((completion) => completion.claimed_at).length;
  const claimedAiCount = aiTasks.filter((task) => task.claimed_at).length;
  const totalTasksDone = claimedOneTimeCount + claimedRecurringCount + claimedAiCount;

  // Separate tasks by type
  const oneTimeTasks = tasks.filter((t) => !t.is_recurring);
  const dailyTasks = tasks.filter((t) => t.is_recurring && t.reset_frequency === "daily");
  const weeklyTasks = tasks.filter((t) => t.is_recurring && t.reset_frequency === "weekly");

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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                <Target className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Growth Tasks & Milestones</h1>
            </div>
            <p className="text-muted-foreground">
              Complete tasks to earn tokens and unlock perks for your channel growth journey.
            </p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Coins className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tokens</p>
                  <p className="text-2xl font-bold">{userTokens.balance}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">XP</p>
                  <p className="text-2xl font-bold">{userTokens.current_xp}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Sparkles className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AI Credits</p>
                  <p className="text-2xl font-bold">{userTokens.ai_credits_balance}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Done</p>
                  <p className="text-2xl font-bold">{totalTasksDone}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Trophy className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Milestones</p>
                  <p className="text-2xl font-bold">
                    {unlockedMilestoneIds.size}/{milestones.length}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Progress to Next Milestone */}
          {nextMilestone && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-xl p-6 mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Next Milestone: {nextMilestone.title}</span>
                </div>
                <Badge variant="secondary">
                  {userTokens.current_xp} / {nextMilestone.required_xp} XP
                </Badge>
              </div>
              <Progress value={progressToNext} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {nextMilestone.required_xp - userTokens.current_xp} XP to unlock • +{nextMilestone.token_reward} token
                reward
              </p>
            </motion.div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="tasks" className="gap-2">
                <Target className="h-4 w-4" />
                One-Time Tasks
              </TabsTrigger>
              <TabsTrigger value="daily" className="gap-2">
                <Clock className="h-4 w-4" />
                Daily
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2">
                <Calendar className="h-4 w-4" />
                Weekly
              </TabsTrigger>
              <TabsTrigger value="milestones" className="gap-2">
                <Trophy className="h-4 w-4" />
                Milestones
              </TabsTrigger>
              <TabsTrigger value="perks" className="gap-2">
                <Gift className="h-4 w-4" />
                Perks
              </TabsTrigger>
            </TabsList>

            {/* One-Time Tasks Tab */}
            <TabsContent value="tasks">
              <div className="space-y-4">
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="font-display text-lg font-semibold">
                        AI Growth Tasks {aiStepIndex ? `- Step ${aiStepIndex}` : ""}
                      </h3>
                    </div>
                    {isGeneratingAiTasks && (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generating
                      </Badge>
                    )}
                  </div>
                  {aiTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Generating your personalized growth tasks...
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {aiTasks.map((task, index) => {
                        const isVerified = Boolean(task.verified_at);
                        const isClaimed = Boolean(task.claimed_at);
                        const taskData: GrowthTask = {
                          id: task.id,
                          title: task.title,
                          description: task.description || "",
                          category: task.category,
                          tier: "basic",
                          token_reward: task.token_reward,
                          xp_reward: task.xp_reward,
                          difficulty: task.difficulty,
                          order_index: task.order_index,
                          is_recurring: false,
                          reset_frequency: null,
                        };

                        return (
                          <TaskCard
                            key={task.id}
                            task={taskData}
                            isVerified={isVerified}
                            isClaimed={isClaimed}
                            isLocked={false}
                            isProcessing={processingTask === task.id}
                            onVerify={() => verifyAiTask(task)}
                            onClaim={() => claimAiTask(task)}
                            getDifficultyColor={getDifficultyColor}
                            index={index}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                {["basic", "pro", "advanced"].map((tier) => (
                  <div key={tier}>
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getTierColor(tier)} flex items-center justify-center`}
                      >
                        {tier === "basic" ? (
                          <Star className="h-4 w-4 text-white" />
                        ) : tier === "pro" ? (
                          <Crown className="h-4 w-4 text-white" />
                        ) : (
                          <Rocket className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <h3 className="font-display text-lg font-semibold capitalize">{tier} Tasks</h3>
                      {!canAccessTier(tier) && (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Lock className="h-3 w-3 mr-1" />
                          Upgrade Required
                        </Badge>
                      )}
                    </div>

                    <div className="grid gap-3 mb-6">
                      {oneTimeTasks
                        .filter((t) => t.tier === tier)
                        .map((task, index) => {
                          const progress = taskProgress[task.id];
                          const isVerified = Boolean(progress?.verified_at);
                          const isClaimed = Boolean(progress?.claimed_at);
                          const isLocked = !canAccessTier(tier);

                          return (
                            <TaskCard
                              key={task.id}
                              task={task}
                              isVerified={isVerified}
                              isClaimed={isClaimed}
                              isLocked={isLocked}
                              isProcessing={processingTask === task.id}
                              onVerify={() => verifyTask(task)}
                              onClaim={() => claimTask(task)}
                              getDifficultyColor={getDifficultyColor}
                              index={index}
                            />
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Daily Tasks Tab */}
            <TabsContent value="daily">
              <div className="mb-4 p-4 glass rounded-xl bg-primary/5 flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Daily Tasks</p>
                  <p className="text-sm text-muted-foreground">These tasks reset every day at midnight</p>
                </div>
              </div>
              <div className="grid gap-3">
                {dailyTasks.map((task, index) => {
                  const isVerified = isRecurringTaskVerified(task);
                  const isClaimed = isRecurringTaskClaimed(task);
                  const isLocked = !canAccessTier(task.tier);

                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isVerified={isVerified}
                      isClaimed={isClaimed}
                      isLocked={isLocked}
                      isProcessing={processingTask === task.id}
                      onVerify={() => verifyTask(task)}
                      onClaim={() => claimTask(task)}
                      getDifficultyColor={getDifficultyColor}
                      index={index}
                      isRecurring
                    />
                  );
                })}
              </div>
            </TabsContent>

            {/* Weekly Tasks Tab */}
            <TabsContent value="weekly">
              <div className="mb-4 p-4 glass rounded-xl bg-purple-500/5 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-semibold">Weekly Tasks</p>
                  <p className="text-sm text-muted-foreground">These tasks reset every Sunday</p>
                </div>
              </div>
              <div className="grid gap-3">
                {weeklyTasks.map((task, index) => {
                  const isVerified = isRecurringTaskVerified(task);
                  const isClaimed = isRecurringTaskClaimed(task);
                  const isLocked = !canAccessTier(task.tier);

                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isVerified={isVerified}
                      isClaimed={isClaimed}
                      isLocked={isLocked}
                      isProcessing={processingTask === task.id}
                      onVerify={() => verifyTask(task)}
                      onClaim={() => claimTask(task)}
                      getDifficultyColor={getDifficultyColor}
                      index={index}
                      isRecurring
                    />
                  );
                })}
              </div>
            </TabsContent>

            {/* Milestones Tab */}
            <TabsContent value="milestones">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {milestones.map((milestone, index) => {
                  const isUnlocked = unlockedMilestoneIds.has(milestone.id);
                  const isClaimed = claimedMilestoneIds.has(milestone.id);
                  const IconComponent = ICON_MAP[milestone.icon] || Trophy;
                  const progress = Math.min((userTokens.current_xp / milestone.required_xp) * 100, 100);

                  return (
                    <motion.div
                      key={milestone.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className={`glass rounded-xl p-6 text-center ${isUnlocked ? "bg-primary/5 ring-2 ring-primary" : ""}`}
                    >
                      <div
                        className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                          isUnlocked ? `bg-gradient-to-br ${getTierColor(milestone.tier)}` : "bg-muted"
                        }`}
                      >
                        <IconComponent className={`h-8 w-8 ${isUnlocked ? "text-white" : "text-muted-foreground"}`} />
                      </div>

                      <h3 className="font-display text-lg font-bold mb-1">{milestone.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{milestone.description}</p>

                      {!isUnlocked && (
                        <div className="mb-3">
                          <Progress value={progress} className="h-2 mb-1" />
                          <p className="text-xs text-muted-foreground">
                            {userTokens.current_xp} / {milestone.required_xp} XP
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Badge className={`bg-gradient-to-r ${getTierColor(milestone.tier)} text-white border-0`}>
                          {milestone.tier}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Coins className="h-3 w-3" />
                          {milestone.token_reward}
                        </Badge>
                      </div>

                      {isUnlocked && !isClaimed ? (
                        <Button
                          onClick={() => claimMilestone(milestone)}
                          disabled={processingMilestone === milestone.id}
                          className="w-full"
                        >
                          {processingMilestone === milestone.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Gift className="h-4 w-4 mr-2" />
                              Claim Reward
                            </>
                          )}
                        </Button>
                      ) : isClaimed ? (
                        <Button variant="outline" disabled className="w-full">
                          <Check className="h-4 w-4 mr-2" />
                          Claimed
                        </Button>
                      ) : (
                        <Button variant="outline" disabled className="w-full">
                          <Lock className="h-4 w-4 mr-2" />
                          Locked
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Perks Tab */}
            <TabsContent value="perks">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {perks.map((perk, index) => {
                  const isUnlocked = unlockedPerkIds.has(perk.id);
                  const canAfford = userTokens.balance >= perk.token_cost;

                  return (
                    <motion.div
                      key={perk.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className={`glass rounded-xl p-6 ${isUnlocked ? "bg-green-500/5 ring-2 ring-green-500" : ""}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${isUnlocked ? "bg-green-500" : "bg-primary/10"}`}>
                          <Sparkles className={`h-5 w-5 ${isUnlocked ? "text-white" : "text-primary"}`} />
                        </div>
                        <h3 className="font-semibold">{perk.name}</h3>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4">{perk.description}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Coins className="h-4 w-4 text-yellow-500" />
                          <span className="font-bold">{perk.token_cost}</span>
                          <span className="text-sm text-muted-foreground">tokens</span>
                        </div>

                        {isUnlocked ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Unlocked
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!canAfford || processingPerk === perk.id}
                            onClick={() => unlockPerk(perk)}
                          >
                            {processingPerk === perk.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : canAfford ? (
                              "Unlock"
                            ) : (
                              <>
                                <Lock className="h-4 w-4 mr-1" />
                                Need {perk.token_cost - userTokens.balance}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

// Task Card Component
interface TaskCardProps {
  task: GrowthTask;
  isVerified: boolean;
  isClaimed: boolean;
  isLocked: boolean;
  isProcessing: boolean;
  onVerify: () => void;
  onClaim: () => void;
  getDifficultyColor: (difficulty: string) => string;
  index: number;
  isRecurring?: boolean;
}

const TaskCard = ({
  task,
  isVerified,
  isClaimed,
  isLocked,
  isProcessing,
  onVerify,
  onClaim,
  getDifficultyColor,
  index,
  isRecurring,
}: TaskCardProps) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className={`glass rounded-xl p-4 ${isClaimed ? "bg-green-500/5 border-green-500/20" : ""} ${isLocked ? "opacity-50" : ""}`}
  >
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isClaimed ? "bg-green-500" : "bg-muted"}`}>
          {isClaimed ? (
            <Check className="h-5 w-5 text-white" />
          ) : isLocked ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : isRecurring ? (
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Target className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{task.title}</h4>
            {isRecurring && (
              <Badge variant="outline" className="text-xs">
                {task.reset_frequency}
              </Badge>
            )}
            {isVerified && !isClaimed && !isLocked && (
              <Badge variant="secondary" className="text-xs">
                Verified
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{task.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className={getDifficultyColor(task.difficulty)}>
          {task.difficulty}
        </Badge>
        <div className="text-right">
          <div className="flex items-center gap-1 text-yellow-500">
            <Coins className="h-4 w-4" />
            <span className="font-semibold">{task.token_reward}</span>
          </div>
          <div className="text-xs text-muted-foreground">+{task.xp_reward} XP</div>
        </div>
        <Button
          size="sm"
          variant={isClaimed ? "outline" : "default"}
          disabled={isClaimed || isLocked || isProcessing}
          onClick={isVerified ? onClaim : onVerify}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isClaimed ? (
            "Claimed"
          ) : isVerified ? (
            <>
              Claim
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              Verify
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  </motion.div>
);

export default GrowthTasks;
