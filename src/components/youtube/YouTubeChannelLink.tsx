import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

export const YouTubeChannelLink = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);

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
        .select("*")
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
      const redirectUri = `${window.location.origin}/youtube-callback`;
      const state = btoa(JSON.stringify({ userId: user.id, timestamp: Date.now() }));

      const { data, error } = await supabase.functions.invoke("youtube-oauth", {
        body: { redirectUri, state },
        headers: { "Content-Type": "application/json" },
      });

      // Handle query params for action
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-oauth?action=auth-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ redirectUri, state }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get auth URL");
      }

      const { authUrl } = await response.json();
      
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
        <Button onClick={initiateOAuth} disabled={linking} className="gap-2">
          {linking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {channels.length > 0 ? "Add Channel" : "Connect YouTube"}
        </Button>
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
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  channel.is_primary
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
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
                      onClick={() => setPrimaryChannel(channel.channel_id)}
                    >
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => unlinkChannel(channel.channel_id)}
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

      {channels.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Your primary channel is used for personalized AI recommendations
        </p>
      )}
    </div>
  );
};
