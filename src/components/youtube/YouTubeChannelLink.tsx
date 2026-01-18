import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPlanLimits } from "@/lib/planLimits";
import {
  Youtube,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  Users,
  Video,
  Eye,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface YouTubeChannel {
  id: string;
  channel_id: string;
  channel_name: string | null;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  video_count: number | null;
  view_count: number | null;
  is_primary: boolean | null;
  updated_at: string;
}

interface ChannelAnalyticsSummary {
  views: number;
  minutesWatched: number;
  subscribersGained: number;
  subscribersLost: number;
  averageViewDuration: number;
  periodLabel: string;
}

export const YouTubeChannelLink = () => {
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<ChannelAnalyticsSummary | null>(null);

  const planLimits = getPlanLimits(subscription?.plan || "free");
  const maxChannelsReached = channels.length >= planLimits.maxChannels;

  useEffect(() => {
    if (user) {
      fetchChannels();
    }
  }, [user]);

  const fetchChannels = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select(
          "id, channel_id, channel_name, thumbnail_url, subscriber_count, video_count, view_count, is_primary, updated_at"
        )
        .eq("user_id", user.id)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error("Error fetching channels:", error);
    } finally {
      setLoading(false);
    }
  };

  const initiateOAuth = async () => {
    if (!user) return;
    setLinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const redirectUri = `${window.location.origin}/youtube-callback`;
      const state = btoa(JSON.stringify({ userId: user.id, timestamp: Date.now() }));

      const { data, error } = await supabase.functions.invoke("youtube-oauth", {
        body: { action: "auth-url", redirectUri, state },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to get auth URL");
      }

      const { authUrl } = data || {};
      if (!authUrl) {
        throw new Error("Failed to get auth URL");
      }

      // Store state in localStorage for verification
      localStorage.setItem("youtube_oauth_state", state);
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("OAuth error:", error);
      toast({
        title: "Failed to connect YouTube",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setLinking(false);
    }
  };

  const unlinkChannel = async (channelId: string) => {
    setUnlinking(channelId);

    try {
      const { error } = await supabase
        .from("youtube_channels")
        .delete()
        .eq("channel_id", channelId)
        .eq("user_id", user?.id);

      if (error) throw error;

      setChannels(channels.filter((c) => c.channel_id !== channelId));
      toast({
        title: "Channel unlinked",
        description: "Your YouTube channel has been disconnected",
      });
    } catch (error: any) {
      toast({
        title: "Failed to unlink",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUnlinking(null);
    }
  };

  const setPrimaryChannel = async (channelId: string) => {
    try {
      // First, unset all primary flags
      await supabase
        .from("youtube_channels")
        .update({ is_primary: false })
        .eq("user_id", user?.id);

      // Set the selected channel as primary
      const { error } = await supabase
        .from("youtube_channels")
        .update({ is_primary: true })
        .eq("channel_id", channelId)
        .eq("user_id", user?.id);

      if (error) throw error;

      setChannels(
        channels.map((c) => ({
          ...c,
          is_primary: c.channel_id === channelId,
        }))
      );

      toast({
        title: "Primary channel set",
        description: "This channel will be used for AI recommendations",
      });
    } catch (error: any) {
      toast({
        title: "Failed to update",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const parseAnalyticsSummary = (
    analytics: any,
    startDate: string,
    endDate: string
  ): ChannelAnalyticsSummary | null => {
    const rows = analytics?.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    const totals = rows.reduce(
      (acc: any, row: any[]) => {
        acc.views += Number(row?.[1] ?? 0);
        acc.minutesWatched += Number(row?.[2] ?? 0);
        acc.subscribersGained += Number(row?.[3] ?? 0);
        acc.subscribersLost += Number(row?.[4] ?? 0);
        acc.averageViewDuration += Number(row?.[5] ?? 0);
        acc.count += 1;
        return acc;
      },
      {
        views: 0,
        minutesWatched: 0,
        subscribersGained: 0,
        subscribersLost: 0,
        averageViewDuration: 0,
        count: 0,
      }
    );

    return {
      views: totals.views,
      minutesWatched: totals.minutesWatched,
      subscribersGained: totals.subscribersGained,
      subscribersLost: totals.subscribersLost,
      averageViewDuration: totals.count ? totals.averageViewDuration / totals.count : 0,
      periodLabel: `${startDate} to ${endDate}`,
    };
  };

  const loadAnalytics = async (channel: YouTubeChannel) => {
    if (!user) return;
    setSelectedChannelId(channel.channel_id);
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 27 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { data, error } = await supabase.functions.invoke("youtube-oauth", {
        body: {
          action: "analytics",
          channelId: channel.channel_id,
          userId: user.id,
          startDate,
          endDate,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to load analytics");
      }

      const summary = parseAnalyticsSummary(data?.analytics, startDate, endDate);
      if (!summary) {
        setAnalyticsSummary(null);
        setAnalyticsError("No analytics data available yet for this channel.");
        return;
      }

      setAnalyticsSummary(summary);
    } catch (error: any) {
      console.error("Analytics error:", error);
      setAnalyticsSummary(null);
      setAnalyticsError(error.message || "Failed to load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatHours = (minutes: number) => {
    if (!minutes || Number.isNaN(minutes)) return "0";
    return (minutes / 60).toFixed(1);
  };

  const formatNumber = (num: number | null) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <Youtube className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">YouTube Channels</h2>
            <p className="text-sm text-muted-foreground">
              Connect your YouTube channel for personalized AI insights
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {channels.length}/{planLimits.maxChannels} channels connected
          </span>
          <Button onClick={initiateOAuth} disabled={linking || maxChannelsReached} className="gap-2">
          {linking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
            {maxChannelsReached ? "Limit Reached" : channels.length > 0 ? "Add Channel" : "Connect YouTube"}
        </Button>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {channels.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8 border-2 border-dashed rounded-xl"
          >
            <Youtube className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">No channels connected</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Connect your YouTube channel to get personalized growth recommendations,
              competitor insights, and AI-powered content suggestions based on your
              channel's performance.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {channels.map((channel, index) => (
              <motion.div
                key={channel.channel_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => loadAnalytics(channel)}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer ${
                  channel.is_primary
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                } ${selectedChannelId === channel.channel_id ? "ring-2 ring-primary/30" : ""}`}
              >
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.channel_name || "Channel"}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <Youtube className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">
                      {channel.channel_name || "Unknown Channel"}
                    </h3>
                    {channel.is_primary && (
                      <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        Primary
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {formatNumber(channel.subscriber_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Video className="h-3.5 w-3.5" />
                      {formatNumber(channel.video_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {formatNumber(channel.view_count)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!channel.is_primary && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPrimaryChannel(channel.channel_id);
                      }}
                    >
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      loadAnalytics(channel);
                    }}
                    disabled={analyticsLoading && selectedChannelId === channel.channel_id}
                  >
                    {analyticsLoading && selectedChannelId === channel.channel_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Analytics"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/dashboard/analysis?channelId=${channel.channel_id}`);
                    }}
                  >
                    Analyze with AI
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      unlinkChannel(channel.channel_id);
                    }}
                    disabled={unlinking === channel.channel_id}
                  >
                    {unlinking === channel.channel_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {selectedChannelId && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold">Channel Analytics</h3>
              <p className="text-xs text-muted-foreground">
                {analyticsSummary?.periodLabel || "Last 28 days"}
              </p>
            </div>
            {analyticsLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>

          {analyticsError ? (
            <p className="text-sm text-muted-foreground">{analyticsError}</p>
          ) : analyticsSummary ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Views</p>
                <p className="font-semibold">{formatNumber(analyticsSummary.views)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Watch Hours</p>
                <p className="font-semibold">{formatHours(analyticsSummary.minutesWatched)}h</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Subs Gained</p>
                <p className="font-semibold">{formatNumber(analyticsSummary.subscribersGained)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Subs Lost</p>
                <p className="font-semibold">{formatNumber(analyticsSummary.subscribersLost)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Avg View Duration</p>
                <p className="font-semibold">{formatDuration(analyticsSummary.averageViewDuration)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a channel to load analytics.
            </p>
          )}
        </div>
      )}

      {channels.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Your primary channel is used for personalized AI recommendations
        </p>
      )}
    </div>
  );
};
