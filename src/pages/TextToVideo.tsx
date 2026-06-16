import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { canAccessFeature } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
import {
  calculateTextToVideoCredits,
  estimateTextToVideoDurationSeconds,
  TEXT_TO_VIDEO_COST_PER_10_SECONDS,
  TEXT_TO_VIDEO_ASPECTS,
  TEXT_TO_VIDEO_CAPTION_THEMES,
  TEXT_TO_VIDEO_VOICES,
  type TextToVideoAspect,
  type TextToVideoCaptionTheme,
  type TextToVideoVoice,
} from "@/lib/textToVideo";
import { Download, Film, Loader2, Menu, Monitor, Play, Smartphone, Sparkles, Square, Wand2 } from "lucide-react";

interface UserCredits {
  ai_credits_balance: number;
  ai_credits_used: number;
}

interface TextToVideoGeneration {
  id: string;
  prompt: string;
  style: string;
  aspect_ratio: TextToVideoAspect;
  duration_seconds: number;
  credits_used: number;
  status: "processing" | "completed" | "failed";
  video_url: string | null;
  provider_job_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface GenerateVideoResponse {
  generation?: TextToVideoGeneration;
  remainingCredits?: number;
  error?: string;
  message?: string;
}

const TextToVideo = () => {
  const { user, subscription, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userCredits, setUserCredits] = useState<UserCredits>({
    ai_credits_balance: 0,
    ai_credits_used: 0,
  });
  const [history, setHistory] = useState<TextToVideoGeneration[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    prompt: "",
    aspectRatio: "9:16" as TextToVideoAspect,
    voice: "nova" as TextToVideoVoice,
    captionTheme: "viral_pop" as TextToVideoCaptionTheme,
  });
  const [generationStep, setGenerationStep] = useState("");

  const currentPlan = getActiveSubscriptionPlan(subscription);
  const hasAccess = canAccessFeature(currentPlan, "hasTextToVideo");
  const estimatedDurationSeconds = estimateTextToVideoDurationSeconds(formData.prompt);
  const estimatedCredits = calculateTextToVideoCredits(estimatedDurationSeconds);
  const canSubmit = Boolean(formData.prompt.trim()) && !isGenerating;
  const wordCount = formData.prompt.trim().split(/\s+/).filter(Boolean).length;

  const getSessionWithRefresh = useCallback(async (forceRefresh = false) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn("Unable to read auth session:", sessionError.message);
      return null;
    }

    if (session?.access_token) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;
      if (!forceRefresh && !shouldRefresh) return session;
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("Auth session refresh failed:", refreshError.message);
      return null;
    }

    return refreshed.session ?? session ?? null;
  }, []);

  const invokeGenerateVideo = useCallback(async (
    body: Record<string, unknown>,
    forceSessionRefresh = false
  ) => {
    const session = await getSessionWithRefresh(forceSessionRefresh);
    if (!session?.access_token) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const headers = {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    let parsed: GenerateVideoResponse | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (response.status === 401 && !forceSessionRefresh) {
      return invokeGenerateVideo(body, true);
    }

    if (!response.ok) {
      return {
        data: null,
        error: parsed?.error || parsed?.message || raw || `Request failed with status ${response.status}`,
      };
    }

    return { data: parsed, error: null as string | null };
  }, [getSessionWithRefresh]);

  const pollGenerationStatus = useCallback(async (generationId: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt < 6 ? 5000 : 10000));
      const { data, error } = await invokeGenerateVideo({
        action: "status",
        generationId,
      });

      if (error) {
        console.warn("Unable to poll video status:", error);
        return;
      }

      if (!data?.generation) continue;

      setHistory((previous) =>
        previous.map((item) => (item.id === data.generation?.id ? data.generation : item))
      );

      if (data.generation.status === "completed") {
        toast({
          title: "Video ready",
          description: "Your text-to-video render is complete.",
        });
        return;
      }

      if (data.generation.status === "failed") {
        toast({
          title: "Video render failed",
          description: data.generation.error_message || "The video provider could not complete this render.",
          variant: "destructive",
        });
        return;
      }
    }
  }, [invokeGenerateVideo, toast]);

  const startStepFlow = useCallback(() => {
    const steps = [
      "Splitting scenes with AI",
      "Generating voiceover",
      "Aligning word captions",
      "Finding stock visuals",
      "Rendering final video",
      "Finalizing",
    ];
    let index = 0;
    setGenerationStep(steps[index]);
    return window.setInterval(() => {
      index = Math.min(steps.length - 1, index + 1);
      setGenerationStep(steps[index]);
    }, 4500);
  }, []);

  const fetchCredits = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("user_tokens")
      .select("ai_credits_balance, ai_credits_used")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setUserCredits({
        ai_credits_balance: data.ai_credits_balance || 0,
        ai_credits_used: data.ai_credits_used || 0,
      });
    }
  }, [user?.id]);

  const fetchHistory = useCallback(async () => {
    if (!user?.id || !hasAccess) return;
    const { data, error } = await supabase
      .from("text_to_video_generations" as never)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setHistory(data as unknown as TextToVideoGeneration[]);
    }
  }, [hasAccess, user?.id]);

  useEffect(() => {
    if (!loading && !user) navigate("/signin");
  }, [loading, navigate, user]);

  useEffect(() => {
    void fetchCredits();
    void fetchHistory();
  }, [fetchCredits, fetchHistory]);

  const creditsPercentage = useMemo(() => {
    const total = userCredits.ai_credits_balance + userCredits.ai_credits_used;
    if (total <= 0) return 0;
    return Math.min((userCredits.ai_credits_balance / total) * 100, 100);
  }, [userCredits]);

  const handleGenerate = async () => {
    if (!user?.id || !canSubmit) return;

    const durationSeconds = estimatedDurationSeconds;
    const credits = calculateTextToVideoCredits(durationSeconds);

    if (userCredits.ai_credits_balance < credits) {
      toast({
        title: "Insufficient AI credits",
        description: `This generation needs ${credits} credits. Add more credits or reduce the duration.`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    const stepTimer = startStepFlow();
    try {
      const { data, error } = await invokeGenerateVideo({
        title: formData.title,
        prompt: formData.prompt,
        durationSeconds,
        aspectRatio: formData.aspectRatio,
        voice: formData.voice,
        captionTheme: formData.captionTheme,
      });

      if (error) throw new Error(error);
      if (!data?.generation) throw new Error("No video generation returned");

      setHistory((previous) => [data.generation, ...previous].slice(0, 10));
      setUserCredits((previous) => ({
        ai_credits_balance: data.remainingCredits ?? previous.ai_credits_balance - data.generation.credits_used,
        ai_credits_used: previous.ai_credits_used + data.generation.credits_used,
      }));
      toast({
        title: data.generation.video_url ? "Video generated" : "Video job started",
        description: `${data.generation.credits_used} AI credits used for this request.`,
      });

      if (data.generation.status === "processing") {
        void pollGenerationStatus(data.generation.id);
      }
    } catch (error) {
      toast({
        title: "Unable to generate video",
        description:
          error instanceof Error
            ? error.message
            : "Make sure the text-to-video migration and generate-video function are deployed.",
        variant: "destructive",
      });
    } finally {
      window.clearInterval(stepTimer);
      setGenerationStep("");
      setIsGenerating(false);
    }
  };

  const getAspectIcon = (aspect: TextToVideoAspect) => {
    if (aspect === "16:9") return Monitor;
    if (aspect === "1:1") return Square;
    return Smartphone;
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className="min-h-screen p-4 lg:p-8">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden mb-4 p-2 rounded-lg glass"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        {!hasAccess ? (
          <SubscriptionRequiredState
            title="Active subscription required"
            description="Text to video is available on Basic, Pro, and Advanced plans."
          />
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="mb-3">
                  {TEXT_TO_VIDEO_COST_PER_10_SECONDS} credits / 10 seconds
                </Badge>
                <h1 className="font-display text-3xl font-bold">Text to Video</h1>
                <p className="text-muted-foreground">
                  Paste a script. The module splits scenes, generates voiceover, aligns captions, finds stock visuals, and renders a short video.
                </p>
              </div>
              <Card className="md:w-72">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI credits</span>
                    <span className="font-semibold">{userCredits.ai_credits_balance.toLocaleString()}</span>
                  </div>
                  <Progress value={creditsPercentage} className="mt-3 h-2" />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="h-5 w-5 text-primary" />
                    Generate Video
                  </CardTitle>
                  <CardDescription>
                    Cost is estimated from spoken script length and rounded up to the next 10 seconds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="video-title">Title</Label>
                    <Input
                      id="video-title"
                      placeholder="Optional video title"
                      value={formData.title}
                      onChange={(event) =>
                        setFormData((previous) => ({ ...previous, title: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video-prompt">Script</Label>
                    <Textarea
                      id="video-prompt"
                      rows={7}
                      placeholder="Paste your hook and body copy. The generator will split it into scenes and create captions."
                      value={formData.prompt}
                      onChange={(event) =>
                        setFormData((previous) => ({ ...previous, prompt: event.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.prompt.length} chars - {wordCount} words - ~{estimatedDurationSeconds}s
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Aspect Ratio</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {TEXT_TO_VIDEO_ASPECTS.map((aspect) => {
                        const Icon = getAspectIcon(aspect);
                        const selected = formData.aspectRatio === aspect;
                        return (
                          <button
                            key={aspect}
                            type="button"
                            onClick={() =>
                              setFormData((previous) => ({ ...previous, aspectRatio: aspect }))
                            }
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <Icon className="mb-2 h-5 w-5" />
                            <p className="font-mono text-sm">{aspect}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {aspect === "9:16"
                                ? "Shorts"
                                : aspect === "1:1"
                                  ? "Square"
                                  : "Landscape"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Voice</Label>
                      <Select
                        value={formData.voice}
                        onValueChange={(value: TextToVideoVoice) =>
                          setFormData((previous) => ({ ...previous, voice: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEXT_TO_VIDEO_VOICES.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Caption Theme</Label>
                      <Select
                        value={formData.captionTheme}
                        onValueChange={(value: TextToVideoCaptionTheme) =>
                          setFormData((previous) => ({ ...previous, captionTheme: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEXT_TO_VIDEO_CAPTION_THEMES.map((theme) => (
                            <SelectItem key={theme.id} value={theme.id}>
                              {theme.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Estimated cost</p>
                      <p className="text-2xl font-bold text-primary">{estimatedCredits} credits</p>
                      <p className="text-xs text-muted-foreground">~{estimatedDurationSeconds}s at 80 credits / 10 seconds</p>
                    </div>
                    <Button onClick={handleGenerate} disabled={!canSubmit} size="lg">
                      {isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      {isGenerating ? generationStep || "Generating" : "Generate Video"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Videos</CardTitle>
                  <CardDescription>Your latest text-to-video generations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {history.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Generated videos will appear here.
                    </div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-medium">{item.prompt}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.duration_seconds}s · {item.aspect_ratio} · {item.credits_used} credits
                            </p>
                          </div>
                          <Badge variant={item.status === "failed" ? "destructive" : "outline"}>
                            {item.status}
                          </Badge>
                        </div>
                        {item.video_url && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={item.video_url} target="_blank" rel="noreferrer">
                                <Play className="mr-2 h-4 w-4" />
                                Open
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={item.video_url} download>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </a>
                            </Button>
                          </div>
                        )}
                        {item.error_message && (
                          <p className="mt-3 text-xs text-destructive">{item.error_message}</p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TextToVideo;
