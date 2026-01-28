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
  Check,
  Lock,
  Coins,
  Zap,
  Trophy,
  Target,
  Loader2,
  Sparkles,
  ChevronRight,
  RefreshCw,
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

const GrowthTasks = () => {
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [aiTasks, setAiTasks] = useState<AiTask[]>([]);
  const [aiStepIndex, setAiStepIndex] = useState<number | null>(null);
  const [isGeneratingAiTasks, setIsGeneratingAiTasks] = useState(false);
  const [unlockedMilestoneIds, setUnlockedMilestoneIds] = useState<Set<string>>(new Set());
  const [userTokens, setUserTokens] = useState<UserTokens>({ 
    balance: 0, total_earned: 0, current_xp: 0, ai_credits_balance: 0, ai_credits_used: 0 
  });
  const [activeTab, setActiveTab] = useState("tasks");
  const [processingTask, setProcessingTask] = useState<string | null>(null);
  const aiGenerateRef = useRef(false);

  const currentPlan = subscription?.plan || "free";
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

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch milestones
      const { data: milestonesData } = await supabase
        .from("milestones")
        .select("*")
        .order("order_index");
      setMilestones(milestonesData || []);

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

  const getNextMilestone = () => {
    return milestones.find((m) => userTokens.current_xp < m.required_xp);
  };

  const nextMilestone = getNextMilestone();
  const progressToNext = nextMilestone ? (userTokens.current_xp / nextMilestone.required_xp) * 100 : 100;
  const claimedAiCount = aiTasks.filter((task) => task.claimed_at).length;
  const totalTasksDone = claimedAiCount;

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

          {/* AI Tasks Only */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="tasks" className="gap-2">
                <Sparkles className="h-4 w-4" />
                AI Tasks
              </TabsTrigger>
            </TabsList>

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
