import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  Trophy,
  Medal,
  Crown,
  Coins,
  Zap,
  Loader2,
  TrendingUp,
  User,
  Star,
} from "lucide-react";

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  current_xp: number;
  tokens_earned: number;
  token_balance: number;
  avatar_url: string | null;
  xp_rank: number;
  tokens_rank: number;
}

const Leaderboard = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState("xp");
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .limit(100);

      if (error) throw error;
      setLeaderboard(data || []);

      // Find current user's rank
      if (user) {
        const userEntry = data?.find(e => e.user_id === user.id);
        setUserRank(userEntry || null);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2: return <Medal className="h-6 w-6 text-slate-400" />;
      case 3: return <Medal className="h-6 w-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1: return "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/30";
      case 2: return "bg-gradient-to-r from-slate-400/20 to-slate-500/10 border-slate-400/30";
      case 3: return "bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-amber-500/30";
      default: return "";
    }
  };

  const sortedByXp = [...leaderboard].sort((a, b) => a.xp_rank - b.xp_rank);
  const sortedByTokens = [...leaderboard].sort((a, b) => a.tokens_rank - b.tokens_rank);

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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                Creator Leaderboard
              </h1>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Top creators ranked by XP and tokens earned. Complete tasks and milestones to climb the ranks!
            </p>
          </motion.div>

          {/* Your Rank Card */}
          {userRank && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-xl p-6 mb-8 border-2 border-primary/20"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <User className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Your Ranking</p>
                  <p className="font-display text-xl font-bold">{userRank.display_name}</p>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="font-bold">#{userRank.xp_rank}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">XP Rank</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Coins className="h-4 w-4 text-yellow-500" />
                      <span className="font-bold">#{userRank.tokens_rank}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Token Rank</p>
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-primary">{userRank.current_xp.toLocaleString()}</span>
                    <p className="text-xs text-muted-foreground">Total XP</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Top 3 Podium */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            {/* 2nd Place */}
            <div className="flex flex-col items-center pt-8">
              {sortedByXp[1] && (
                <div className="glass rounded-xl p-4 text-center w-full">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 mx-auto mb-2 flex items-center justify-center">
                    <Medal className="h-8 w-8 text-white" />
                  </div>
                  <p className="font-semibold text-sm truncate">{sortedByXp[1].display_name}</p>
                  <p className="text-xs text-muted-foreground">{sortedByXp[1].current_xp.toLocaleString()} XP</p>
                  <Badge variant="secondary" className="mt-2">2nd</Badge>
                </div>
              )}
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center">
              {sortedByXp[0] && (
                <div className="glass rounded-xl p-4 text-center w-full border-2 border-yellow-500/30 bg-yellow-500/5">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 mx-auto mb-2 flex items-center justify-center">
                    <Crown className="h-10 w-10 text-white" />
                  </div>
                  <p className="font-semibold truncate">{sortedByXp[0].display_name}</p>
                  <p className="text-sm text-muted-foreground">{sortedByXp[0].current_xp.toLocaleString()} XP</p>
                  <Badge className="mt-2 bg-yellow-500 text-white">1st</Badge>
                </div>
              )}
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center pt-12">
              {sortedByXp[2] && (
                <div className="glass rounded-xl p-4 text-center w-full">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 mx-auto mb-2 flex items-center justify-center">
                    <Medal className="h-7 w-7 text-white" />
                  </div>
                  <p className="font-semibold text-sm truncate">{sortedByXp[2].display_name}</p>
                  <p className="text-xs text-muted-foreground">{sortedByXp[2].current_xp.toLocaleString()} XP</p>
                  <Badge variant="secondary" className="mt-2 bg-amber-500/10 text-amber-500">3rd</Badge>
                </div>
              )}
            </div>
          </motion.div>

          {/* Full Leaderboard */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 w-full justify-start">
              <TabsTrigger value="xp" className="gap-2">
                <Zap className="h-4 w-4" />
                By XP
              </TabsTrigger>
              <TabsTrigger value="tokens" className="gap-2">
                <Coins className="h-4 w-4" />
                By Tokens
              </TabsTrigger>
            </TabsList>

            <TabsContent value="xp">
              <div className="space-y-2">
                {sortedByXp.map((entry, index) => (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`glass rounded-xl p-4 flex items-center gap-4 ${getRankBg(entry.xp_rank)} ${
                      entry.user_id === user?.id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className="w-10 flex justify-center">
                      {getRankIcon(entry.xp_rank)}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{entry.display_name}</p>
                      {entry.user_id === user?.id && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-bold text-primary">{entry.current_xp.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">XP</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-yellow-500">{entry.tokens_earned.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Tokens</p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {leaderboard.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No entries yet. Be the first to complete tasks!</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tokens">
              <div className="space-y-2">
                {sortedByTokens.map((entry, index) => (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`glass rounded-xl p-4 flex items-center gap-4 ${getRankBg(entry.tokens_rank)} ${
                      entry.user_id === user?.id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className="w-10 flex justify-center">
                      {getRankIcon(entry.tokens_rank)}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{entry.display_name}</p>
                      {entry.user_id === user?.id && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-bold text-yellow-500">{entry.tokens_earned.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Earned</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{entry.token_balance.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Balance</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Leaderboard;
