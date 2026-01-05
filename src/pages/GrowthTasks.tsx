import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
}

interface Perk {
  id: string;
  name: string;
  description: string;
  token_cost: number;
  perk_type: string;
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
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [unlockedMilestoneIds, setUnlockedMilestoneIds] = useState<Set<string>>(new Set());
  const [claimedMilestoneIds, setClaimedMilestoneIds] = useState<Set<string>>(new Set());
  const [unlockedPerkIds, setUnlockedPerkIds] = useState<Set<string>>(new Set());
  const [userTokens, setUserTokens] = useState<UserTokens>({ balance: 0, total_earned: 0, current_xp: 0 });
  const [activeTab, setActiveTab] = useState("tasks");
  const [processingTask, setProcessingTask] = useState<string | null>(null);
  const [processingMilestone, setProcessingMilestone] = useState<string | null>(null);
  const [processingPerk, setProcessingPerk] = useState<string | null>(null);

  const currentPlan = subscription?.plan || "free";
  const userTier = currentPlan === "free" ? "basic" : currentPlan === "basic" ? "basic" : currentPlan === "pro" ? "pro" : "advanced";

  useEffect(() => {
    fetchData();
  }, [user]);

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

      // Fetch user progress
      const { data: progressData } = await supabase
        .from("user_task_progress")
        .select("task_id")
        .eq("user_id", user.id)
        .not("completed_at", "is", null);
      setCompletedTaskIds(new Set(progressData?.map(p => p.task_id) || []));

      // Fetch user milestones
      const { data: userMilestonesData } = await supabase
        .from("user_milestones")
        .select("milestone_id, claimed")
        .eq("user_id", user.id);
      setUnlockedMilestoneIds(new Set(userMilestonesData?.map(m => m.milestone_id) || []));
      setClaimedMilestoneIds(new Set(userMilestonesData?.filter(m => m.claimed).map(m => m.milestone_id) || []));

      // Fetch user perks
      const { data: userPerksData } = await supabase
        .from("user_perks")
        .select("perk_id")
        .eq("user_id", user.id);
      setUnlockedPerkIds(new Set(userPerksData?.map(p => p.perk_id) || []));

      // Fetch user tokens
      const { data: tokensData } = await supabase
        .from("user_tokens")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (tokensData) {
        setUserTokens(tokensData);
      } else {
        // Create initial tokens record
        const { data: newTokens } = await supabase
          .from("user_tokens")
          .insert({ user_id: user.id })
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

  const completeTask = async (task: GrowthTask) => {
    if (!user || completedTaskIds.has(task.id)) return;
    setProcessingTask(task.id);

    try {
      // Add task progress
      await supabase.from("user_task_progress").upsert({
        user_id: user.id,
        task_id: task.id,
        completed_at: new Date().toISOString(),
        last_completed_at: new Date().toISOString(),
        completion_count: 1,
      });

      // Update tokens
      const newBalance = userTokens.balance + task.token_reward;
      const newXp = userTokens.current_xp + task.xp_reward;
      const newTotalEarned = userTokens.total_earned + task.token_reward;

      await supabase.from("user_tokens").update({
        balance: newBalance,
        current_xp: newXp,
        total_earned: newTotalEarned,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      setUserTokens({ ...userTokens, balance: newBalance, current_xp: newXp, total_earned: newTotalEarned });
      setCompletedTaskIds(new Set([...completedTaskIds, task.id]));

      // Check for milestone unlocks
      await checkMilestoneUnlocks(newXp);

      toast({
        title: "Task Completed!",
        description: `+${task.token_reward} tokens, +${task.xp_reward} XP`,
      });
    } catch (error: any) {
      toast({
        title: "Error completing task",
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
      // Update milestone as claimed
      await supabase.from("user_milestones").update({
        claimed: true,
        claimed_at: new Date().toISOString(),
      }).eq("user_id", user.id).eq("milestone_id", milestone.id);

      // Add tokens
      const newBalance = userTokens.balance + milestone.token_reward;
      const newTotalEarned = userTokens.total_earned + milestone.token_reward;

      await supabase.from("user_tokens").update({
        balance: newBalance,
        total_earned: newTotalEarned,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

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
      // Add user perk
      await supabase.from("user_perks").insert({
        user_id: user.id,
        perk_id: perk.id,
      });

      // Deduct tokens
      const newBalance = userTokens.balance - perk.token_cost;
      const newTotalSpent = (userTokens as any).total_spent + perk.token_cost;

      await supabase.from("user_tokens").update({
        balance: newBalance,
        total_spent: newTotalSpent,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

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
      case "basic": return "from-blue-500 to-blue-600";
      case "pro": return "from-purple-500 to-purple-600";
      case "advanced": return "from-orange-500 to-orange-600";
      default: return "from-slate-500 to-slate-600";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "hard": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-muted";
    }
  };

  const canAccessTier = (tier: string) => {
    if (tier === "basic") return true;
    if (tier === "pro") return userTier === "pro" || userTier === "advanced";
    if (tier === "advanced") return userTier === "advanced";
    return false;
  };

  const getNextMilestone = () => {
    return milestones.find(m => userTokens.current_xp < m.required_xp);
  };

  const nextMilestone = getNextMilestone();
  const progressToNext = nextMilestone 
    ? (userTokens.current_xp / nextMilestone.required_xp) * 100 
    : 100;

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
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                <Target className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                Growth Tasks & Milestones
              </h1>
            </div>
            <p className="text-muted-foreground">
              Complete tasks to earn tokens and unlock perks for your channel growth journey.
            </p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                  <p className="text-sm text-muted-foreground">Token Balance</p>
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
                  <p className="text-sm text-muted-foreground">Current XP</p>
                  <p className="text-2xl font-bold">{userTokens.current_xp}</p>
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
                  <p className="text-2xl font-bold">{completedTaskIds.size}</p>
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
                  <p className="text-2xl font-bold">{unlockedMilestoneIds.size}/{milestones.length}</p>
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
                {nextMilestone.required_xp - userTokens.current_xp} XP to unlock • +{nextMilestone.token_reward} token reward
              </p>
            </motion.div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="tasks" className="gap-2">
                <Target className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="milestones" className="gap-2">
                <Trophy className="h-4 w-4" />
                Milestones
              </TabsTrigger>
              <TabsTrigger value="perks" className="gap-2">
                <Gift className="h-4 w-4" />
                Perks Shop
              </TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent value="tasks">
              <div className="space-y-4">
                {["basic", "pro", "advanced"].map((tier) => (
                  <div key={tier}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getTierColor(tier)} flex items-center justify-center`}>
                        {tier === "basic" ? <Star className="h-4 w-4 text-white" /> :
                         tier === "pro" ? <Crown className="h-4 w-4 text-white" /> :
                         <Rocket className="h-4 w-4 text-white" />}
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
                      {tasks.filter(t => t.tier === tier).map((task, index) => {
                        const isCompleted = completedTaskIds.has(task.id);
                        const isLocked = !canAccessTier(tier);

                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`glass rounded-xl p-4 ${isCompleted ? "bg-green-500/5 border-green-500/20" : ""} ${isLocked ? "opacity-50" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCompleted ? "bg-green-500" : "bg-muted"}`}>
                                  {isCompleted ? (
                                    <Check className="h-5 w-5 text-white" />
                                  ) : isLocked ? (
                                    <Lock className="h-5 w-5 text-muted-foreground" />
                                  ) : (
                                    <Target className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold">{task.title}</h4>
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
                                  variant={isCompleted ? "outline" : "default"}
                                  disabled={isCompleted || isLocked || processingTask === task.id}
                                  onClick={() => completeTask(task)}
                                >
                                  {processingTask === task.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : isCompleted ? (
                                    "Done"
                                  ) : (
                                    <>Complete<ChevronRight className="h-4 w-4 ml-1" /></>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
                      <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                        isUnlocked ? `bg-gradient-to-br ${getTierColor(milestone.tier)}` : "bg-muted"
                      }`}>
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

export default GrowthTasks;
