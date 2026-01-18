import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle, XCircle, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

const YouTubeCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting your YouTube channel...");
  const [channelName, setChannelName] = useState<string | null>(null);

  const getSessionWithRefresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session;

    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) return refreshed.session;

    return null;
  };

  const invokeWithAuthRetry = async <T,>(payload: {
    body: Record<string, unknown>;
    accessToken: string;
  }) => {
    let { data, error } = await supabase.functions.invoke<T>("youtube-oauth", {
      body: payload.body,
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (!error) return { data, error };

    const message = error?.message?.toLowerCase() || "";
    if (!message.includes("invalid jwt") && !message.includes("401")) {
      return { data, error };
    }

    const refreshed = await getSessionWithRefresh();
    if (!refreshed?.access_token) {
      return { data, error };
    }

    return supabase.functions.invoke<T>("youtube-oauth", {
      body: payload.body,
      headers: {
        Authorization: `Bearer ${refreshed.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
  };

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(error === "access_denied" 
          ? "You denied access to your YouTube account" 
          : `Error: ${error}`);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Invalid callback parameters");
        return;
      }

      // Verify state
      const storedState = localStorage.getItem("youtube_oauth_state");
      if (storedState !== state) {
        setStatus("error");
        setMessage("Security verification failed. Please try again.");
        return;
      }

      // Clear stored state
      localStorage.removeItem("youtube_oauth_state");

      try {
        const session = await getSessionWithRefresh();
        if (!session?.access_token) {
          throw new Error("Your session expired. Please sign in again.");
        }

        // Parse state to get user ID
        const stateData = JSON.parse(atob(state));
        const userId = stateData.userId;

        if (!userId) {
          throw new Error("User ID not found in state");
        }

        const redirectUri = `${window.location.origin}/youtube-callback`;

        const { data, error } = await invokeWithAuthRetry<{ channel?: { name?: string } }>({
          body: { action: "callback", code, redirectUri, userId },
          accessToken: session.access_token,
        });

        if (error) {
          throw new Error(error.message || "Failed to connect channel");
        }

        setStatus("success");
        setChannelName(data.channel?.name || "Your channel");
        setMessage("Successfully connected!");

        // Redirect after a short delay
        setTimeout(() => {
          navigate("/dashboard/profile", { replace: true });
        }, 2000);
      } catch (error: any) {
        console.error("Callback error:", error);
        setStatus("error");
        setMessage(error.message || "Failed to connect channel");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl p-8 max-w-md w-full text-center"
      >
        <div className="mb-6">
          {status === "loading" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
            >
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </motion.div>
          )}
          {status === "success" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center"
            >
              <CheckCircle className="h-10 w-10 text-green-500" />
            </motion.div>
          )}
          {status === "error" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center"
            >
              <XCircle className="h-10 w-10 text-destructive" />
            </motion.div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <Youtube className="h-6 w-6 text-red-500" />
          <h1 className="font-display text-2xl font-bold">YouTube Connection</h1>
        </div>

        <p className="text-muted-foreground mb-6">{message}</p>

        {status === "success" && channelName && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 rounded-lg p-4 mb-6"
          >
            <p className="font-medium text-green-600 dark:text-green-400">
              Connected: {channelName}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Redirecting to your profile...
            </p>
          </motion.div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <Button onClick={() => navigate("/dashboard/profile")} className="w-full">
              Go to Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default YouTubeCallback;
