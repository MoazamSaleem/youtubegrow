import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { YouTubeChannelLink } from "@/components/youtube/YouTubeChannelLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  Award,
  Sparkles,
  Loader2,
  Check,
  Rocket,
  Star,
  Crown,
  CheckCircle,
  Video,
  Heart,
  TrendingUp,
  DollarSign,
  Target,
  Coins,
  Flame,
  Save,
} from "lucide-react";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: string;
}

interface UserBadge {
  badge_id: string;
  earned_at: string;
  is_displayed: boolean;
  badge: BadgeData;
}

interface ProfileData {
  display_name: string | null;
  show_on_leaderboard: boolean;
  displayed_badges: string[];
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
  sparkles: Sparkles,
  target: Target,
  coins: Coins,
  flame: Flame,
};

const RARITY_COLORS: Record<string, string> = {
  common: "from-slate-400 to-slate-500",
  rare: "from-blue-400 to-blue-600",
  epic: "from-purple-400 to-purple-600",
  legendary: "from-yellow-400 to-orange-500",
};

const RARITY_BORDER: Record<string, string> = {
  common: "border-slate-400/30",
  rare: "border-blue-400/30",
  epic: "border-purple-400/30",
  legendary: "border-yellow-400/30 ring-2 ring-yellow-400/20",
};

const Profile = () => {
  const { user, profile: authProfile } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allBadges, setAllBadges] = useState<BadgeData[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [profileData, setProfileData] = useState<ProfileData>({
    display_name: null,
    show_on_leaderboard: true,
    displayed_badges: [],
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch all badges
      const { data: badges } = await supabase.from("badges").select("*");
      setAllBadges(badges || []);

      // Fetch user's earned badges
      const { data: earned } = await supabase
        .from("user_badges")
        .select("badge_id, earned_at, is_displayed, badges(*)")
        .eq("user_id", user.id);

      const mappedBadges = earned?.map((e: any) => ({
        badge_id: e.badge_id,
        earned_at: e.earned_at,
        is_displayed: e.is_displayed,
        badge: e.badges,
      })) || [];
      setUserBadges(mappedBadges);

      // Fetch profile settings from user_tokens
      const { data: tokens } = await supabase
        .from("user_tokens")
        .select("display_name, show_on_leaderboard, displayed_badges")
        .eq("user_id", user.id)
        .maybeSingle();

      if (tokens) {
        setProfileData({
          display_name: tokens.display_name,
          show_on_leaderboard: tokens.show_on_leaderboard,
          displayed_badges: tokens.displayed_badges || [],
        });
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBadgeDisplay = (badgeId: string) => {
    const current = profileData.displayed_badges;
    let updated: string[];

    if (current.includes(badgeId)) {
      updated = current.filter((id) => id !== badgeId);
    } else if (current.length < 5) {
      updated = [...current, badgeId];
    } else {
      toast({
        title: "Maximum badges reached",
        description: "You can display up to 5 badges on your profile",
        variant: "destructive",
      });
      return;
    }

    setProfileData({ ...profileData, displayed_badges: updated });
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await supabase
        .from("user_tokens")
        .update({
          display_name: profileData.display_name,
          show_on_leaderboard: profileData.show_on_leaderboard,
          displayed_badges: profileData.displayed_badges,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      toast({
        title: "Profile saved",
        description: "Your profile settings have been updated",
      });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const earnedBadgeIds = new Set(userBadges.map((b) => b.badge_id));

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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                <User className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Profile & Badges</h1>
            </div>
            <p className="text-muted-foreground">Customize your profile and showcase your achievements.</p>
          </motion.div>

          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <h2 className="font-display text-lg font-bold mb-4">Profile Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Display Name</label>
                <Input
                  value={profileData.display_name || ""}
                  onChange={(e) => setProfileData({ ...profileData, display_name: e.target.value })}
                  placeholder={authProfile?.full_name || "Enter display name"}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This name will be shown on the leaderboard instead of your real name
                </p>
              </div>

              <div className="flex items-center justify-between max-w-md">
                <div>
                  <p className="font-medium">Show on Leaderboard</p>
                  <p className="text-sm text-muted-foreground">Allow others to see your progress</p>
                </div>
                <Switch
                  checked={profileData.show_on_leaderboard}
                  onCheckedChange={(checked) => setProfileData({ ...profileData, show_on_leaderboard: checked })}
                />
              </div>

              <Button onClick={saveProfile} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </motion.div>

          {/* YouTube Channel Link */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <YouTubeChannelLink />
          </motion.div>

          {/* Displayed Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">Displayed Badges</h2>
              <Badge variant="secondary">{profileData.displayed_badges.length}/5</Badge>
            </div>

            {profileData.displayed_badges.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {profileData.displayed_badges.map((badgeId) => {
                  const badge = allBadges.find((b) => b.id === badgeId);
                  if (!badge) return null;
                  const IconComponent = ICON_MAP[badge.icon] || Award;

                  return (
                    <motion.div
                      key={badgeId}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`relative p-3 rounded-xl bg-gradient-to-br ${RARITY_COLORS[badge.rarity]} flex items-center gap-2`}
                    >
                      <IconComponent className="h-5 w-5 text-white" />
                      <span className="text-white font-medium text-sm">{badge.name}</span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">Select badges from below to display on your profile</p>
            )}
          </motion.div>

          {/* All Badges */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="font-display text-lg font-bold mb-4">All Badges</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allBadges.map((badge, index) => {
                const isEarned = earnedBadgeIds.has(badge.id);
                const isDisplayed = profileData.displayed_badges.includes(badge.id);
                const IconComponent = ICON_MAP[badge.icon] || Award;

                return (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className={`glass rounded-xl p-4 text-center relative ${
                      isEarned ? RARITY_BORDER[badge.rarity] : "opacity-50 grayscale"
                    } ${isDisplayed ? "ring-2 ring-primary" : ""}`}
                  >
                    {isDisplayed && (
                      <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}

                    <div
                      className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-gradient-to-br ${
                        isEarned ? RARITY_COLORS[badge.rarity] : "from-slate-600 to-slate-700"
                      }`}
                    >
                      <IconComponent className="h-7 w-7 text-white" />
                    </div>

                    <h3 className="font-semibold text-sm mb-1">{badge.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{badge.description}</p>

                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        badge.rarity === "legendary"
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                          : badge.rarity === "epic"
                          ? "bg-purple-500/10 text-purple-500 border-purple-500/30"
                          : badge.rarity === "rare"
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                          : "bg-slate-500/10 text-slate-500 border-slate-500/30"
                      }`}
                    >
                      {badge.rarity}
                    </Badge>

                    {isEarned && (
                      <Button
                        size="sm"
                        variant={isDisplayed ? "default" : "outline"}
                        className="w-full mt-3"
                        onClick={() => toggleBadgeDisplay(badge.id)}
                      >
                        {isDisplayed ? "Remove" : "Display"}
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
