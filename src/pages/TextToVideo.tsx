import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { canAccessFeature } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
import {
  calculateTextToVideoCredits,
  estimateTextToVideoDurationSeconds,
  normalizeTextToVideoProject,
  projectIdFromGeneration,
  TEXT_TO_VIDEO_ASPECTS,
  TEXT_TO_VIDEO_CAPTION_THEMES,
  TEXT_TO_VIDEO_COST_PER_10_SECONDS,
  TEXT_TO_VIDEO_VOICES,
  type TextToVideoAspect,
  type TextToVideoCaption,
  type TextToVideoCaptionStyle,
  type TextToVideoCaptionTheme,
  type TextToVideoGeneration,
  type TextToVideoProject,
  type TextToVideoRenderJob,
  type TextToVideoScene,
  type TextToVideoTimelineLayer,
  type TextToVideoVoice,
} from "@/lib/textToVideo";
import {
  Captions,
  Download,
  Edit3,
  Film,
  ImagePlus,
  Layers,
  Loader2,
  Menu,
  Monitor,
  MousePointer2,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Type,
  Video,
  Volume2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface UserCredits {
  ai_credits_balance: number;
  ai_credits_used: number;
}

interface GenerateVideoResponse {
  generation?: TextToVideoGeneration;
  project?: TextToVideoProject;
  render?: TextToVideoRenderJob;
  deleted?: boolean;
  remainingCredits?: number;
  meta?: Record<string, unknown>;
  items?: LibraryItem[];
  error?: string;
  message?: string;
}

interface LibraryItem {
  id?: string | number;
  title?: string;
  url?: string;
  image_url?: string;
  video_url?: string;
  preview_url?: string;
  previewURL?: string;
  webformatURL?: string;
  tags?: string;
}

const EFFECTS = ["shake", "rgb_split", "glitch", "blur_reveal", "vignette", "film_burn", "flash", "speed_ramp"];
const ANIMATIONS = ["ken_burns_in", "ken_burns_out", "punch_in", "slow_pan", "none"];
const TRANSITIONS = ["fade", "flash", "zoom", "swipe"];
const CAPTION_PRESETS = ["viral_pop", "hormozi", "mrbeast", "minimal", "subtitle"];
const CAPTION_FONTS = ["bold_sans", "display", "narrow", "mono", "serif"];
const CAPTION_POSITIONS = ["top", "middle", "bottom"];
const CAPTION_BACKGROUNDS = ["none", "accent_box", "dark_box"];
const CAPTION_ANIMATIONS = ["pop", "fade", "slide", "none"];

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(16).slice(2);

const formatSeconds = (value: number) => `${Math.max(0, Number(value) || 0).toFixed(1)}s`;

const mediaUrlFromLibraryItem = (item: LibraryItem) =>
  item.video_url || item.image_url || item.url || item.webformatURL || item.preview_url || item.previewURL || "";

const previewFrameClass = (aspect: TextToVideoAspect) => {
  if (aspect === "9:16") return "aspect-[9/16] max-w-sm";
  if (aspect === "1:1") return "aspect-square max-w-lg";
  return "aspect-video max-w-4xl";
};

const clipStyle = (start: number, duration: number, total: number) => ({
  left: `${Math.max(0, (start / Math.max(total, 0.1)) * 100)}%`,
  width: `${Math.max(3, (duration / Math.max(total, 0.1)) * 100)}%`,
});

const TextToVideo = () => {
  const { user, subscription, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [userCredits, setUserCredits] = useState<UserCredits>({ ai_credits_balance: 0, ai_credits_used: 0 });
  const [history, setHistory] = useState<TextToVideoGeneration[]>([]);
  const [activeGeneration, setActiveGeneration] = useState<TextToVideoGeneration | null>(null);
  const [project, setProject] = useState<TextToVideoProject | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [renderJob, setRenderJob] = useState<TextToVideoRenderJob | null>(null);
  const [renderSettings, setRenderSettings] = useState({ fps: 30, outFormat: "mp4" });
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [isSearchingLibrary, setIsSearchingLibrary] = useState(false);
  const [newLayer, setNewLayer] = useState({
    type: "image" as TextToVideoTimelineLayer["type"],
    url: "",
    start: 0,
    duration: 3,
  });
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(48);
  const [formData, setFormData] = useState({
    title: "",
    prompt: "",
    aspectRatio: "9:16" as TextToVideoAspect,
    voice: "nova" as TextToVideoVoice,
    captionTheme: "viral_pop" as TextToVideoCaptionTheme,
  });

  const currentPlan = getActiveSubscriptionPlan(subscription);
  const hasAccess = canAccessFeature(currentPlan, "hasTextToVideo");
  const isEditorRoute = Boolean(projectId) || location.pathname.includes("/dashboard/text-to-video/editor/");
  const estimatedDurationSeconds = estimateTextToVideoDurationSeconds(formData.prompt);
  const estimatedCredits = calculateTextToVideoCredits(estimatedDurationSeconds);
  const canSubmit = Boolean(formData.prompt.trim()) && !isGenerating;
  const wordCount = formData.prompt.trim().split(/\s+/).filter(Boolean).length;
  const selectedScene = useMemo(
    () => project?.scenes.find((scene) => scene.id === selectedSceneId) ?? project?.scenes[0] ?? null,
    [project, selectedSceneId],
  );
  const activeVideoUrl = activeGeneration?.video_url || project?.final_video_url || null;
  const selectedLayer = useMemo(
    () => project?.timeline_layers?.find((layer) => layer.id === selectedLayerId) ?? null,
    [project?.timeline_layers, selectedLayerId],
  );
  const timelineDuration = useMemo(() => {
    const layerEnd = Math.max(
      0,
      ...((project?.timeline_layers ?? []).map((layer) => (Number(layer.start) || 0) + (Number(layer.duration) || 0)))
    );
    return Math.max(1, Number(project?.total_duration) || 0, layerEnd);
  }, [project?.timeline_layers, project?.total_duration]);
  const sceneTimeline = useMemo(() => {
    let cursor = 0;
    return (project?.scenes ?? []).map((scene) => {
      const start = cursor;
      const duration = Number(scene.duration) || 0.1;
      cursor += duration;
      return { scene, start, duration };
    });
  }, [project?.scenes]);
  const timelineTicks = useMemo(() => {
    const step = timelineDuration > 90 ? 10 : timelineDuration > 35 ? 5 : 2;
    const count = Math.floor(timelineDuration / step) + 1;
    return Array.from({ length: count + 1 }, (_, index) => Math.min(index * step, timelineDuration));
  }, [timelineDuration]);
  const timelineWidth = Math.max(960, Math.ceil(timelineDuration * timelineZoom));

  const getSessionWithRefresh = useCallback(async (forceRefresh = false) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) return null;
    if (session?.access_token) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;
      if (!forceRefresh && !shouldRefresh) return session;
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) return null;
    return refreshed.session ?? session ?? null;
  }, []);

  const invokeGenerateVideo = useCallback(async (body: Record<string, unknown>, forceSessionRefresh = false) => {
    const session = await getSessionWithRefresh(forceSessionRefresh);
    if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
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
      return { data: null, error: parsed?.error || parsed?.message || raw || `Request failed with status ${response.status}` };
    }

    return { data: parsed, error: null as string | null };
  }, [getSessionWithRefresh]);

  const startStepFlow = useCallback(() => {
    const steps = ["Splitting scenes", "Generating voiceover", "Aligning captions", "Finding visuals", "Rendering draft", "Finalizing"];
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
      .limit(12);

    if (!error && data) setHistory(data as unknown as TextToVideoGeneration[]);
  }, [hasAccess, user?.id]);

  const loadProjectById = useCallback(async (providerProjectId: string) => {
    setProject(null);
    setRenderJob(null);
    const { data, error } = await invokeGenerateVideo({ action: "getProject", projectId: providerProjectId });
    if (error || !data?.project) {
      toast({ title: "Unable to load editor", description: error || "Project was not returned.", variant: "destructive" });
      navigate("/dashboard/text-to-video");
      return;
    }

    const normalized = normalizeTextToVideoProject(data.project);
    setProject(normalized);
    setSelectedSceneId(normalized.scenes[0]?.id ?? null);
  }, [invokeGenerateVideo, navigate, toast]);

  const pollGenerationStatus = useCallback(async (generationId: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt < 6 ? 5000 : 10000));
      const { data, error } = await invokeGenerateVideo({ action: "status", generationId });
      if (error || !data?.generation) continue;

      setHistory((previous) => previous.map((item) => (item.id === data.generation?.id ? data.generation : item)));
      setActiveGeneration((previous) => (previous?.id === data.generation?.id ? data.generation : previous));

      if (data.generation.status === "completed") {
        toast({ title: "Video ready", description: "Your text-to-video render is complete." });
        return;
      }

      if (data.generation.status === "failed") {
        toast({
          title: "Video render failed",
          description: data.generation.error_message || "The video backend could not complete this render.",
          variant: "destructive",
        });
        return;
      }
    }
  }, [invokeGenerateVideo, toast]);

  useEffect(() => {
    if (!loading && !user) navigate("/signin");
  }, [loading, navigate, user]);

  useEffect(() => {
    void fetchCredits();
    void fetchHistory();
  }, [fetchCredits, fetchHistory]);

  useEffect(() => {
    if (!loading && hasAccess && projectId) {
      void loadProjectById(projectId);
    }
  }, [hasAccess, loadProjectById, loading, projectId]);

  const creditsPercentage = useMemo(() => {
    const total = userCredits.ai_credits_balance + userCredits.ai_credits_used;
    if (total <= 0) return 0;
    return Math.min((userCredits.ai_credits_balance / total) * 100, 100);
  }, [userCredits]);

  const handleGenerate = async () => {
    if (!user?.id || !canSubmit) return;
    const credits = calculateTextToVideoCredits(estimatedDurationSeconds);

    if (userCredits.ai_credits_balance < credits) {
      toast({
        title: "Insufficient AI credits",
        description: `This generation needs ${credits} credits. Add more credits or reduce the script length.`,
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
        durationSeconds: estimatedDurationSeconds,
        aspectRatio: formData.aspectRatio,
        voice: formData.voice,
        captionTheme: formData.captionTheme,
      });

      if (error) throw new Error(error);
      if (!data?.generation) throw new Error("No video generation returned");

      setHistory((previous) => [data.generation!, ...previous].slice(0, 12));
      setActiveGeneration(data.generation);
      if (data.project) {
        const normalized = normalizeTextToVideoProject(data.project);
        setProject(normalized);
        setSelectedSceneId(normalized.scenes[0]?.id ?? null);
      }
      if (data.render) setRenderJob(data.render);
      setUserCredits((previous) => ({
        ai_credits_balance: data.remainingCredits ?? previous.ai_credits_balance - data.generation!.credits_used,
        ai_credits_used: previous.ai_credits_used + data.generation!.credits_used,
      }));
      toast({ title: "Video job started", description: `${data.generation.credits_used} AI credits used for this request.` });
      if (data.generation.status === "processing") void pollGenerationStatus(data.generation.id);
    } catch (error) {
      toast({
        title: "Unable to generate video",
        description: error instanceof Error ? error.message : "Make sure the text-to-video service and Edge Function are configured.",
        variant: "destructive",
      });
    } finally {
      window.clearInterval(stepTimer);
      setGenerationStep("");
      setIsGenerating(false);
    }
  };

  const deleteProject = async (generation: TextToVideoGeneration) => {
    const providerProjectId = projectIdFromGeneration(generation);
    if (!providerProjectId) {
      toast({ title: "Unable to delete project", description: "This generation has no provider project id.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await invokeGenerateVideo({ action: "deleteProject", projectId: providerProjectId });
      if (error) throw new Error(error);
      setHistory((previous) => previous.filter((item) => item.id !== generation.id));
      if (project?.id === providerProjectId) setProject(null);
      toast({ title: "Project deleted" });
    } catch (error) {
      toast({
        title: "Unable to delete project",
        description: error instanceof Error ? error.message : "Project delete failed.",
        variant: "destructive",
      });
    }
  };

  const saveProjectPatch = async (patch: Partial<TextToVideoProject>, successTitle = "Project saved") => {
    if (!project) return null;
    setIsSaving(true);
    try {
      const { data, error } = await invokeGenerateVideo({ action: "updateProject", projectId: project.id, patch });
      if (error) throw new Error(error);
      if (!data?.project) throw new Error("Updated project was not returned");
      const normalized = normalizeTextToVideoProject(data.project);
      setProject(normalized);
      if (!normalized.scenes.some((scene) => scene.id === selectedSceneId)) {
        setSelectedSceneId(normalized.scenes[0]?.id ?? null);
      }
      toast({ title: successTitle });
      return normalized;
    } catch (error) {
      toast({
        title: "Unable to save project",
        description: error instanceof Error ? error.message : "Project update failed.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const updateProjectLocal = (patch: Partial<TextToVideoProject>) => {
    setProject((previous) => (previous ? normalizeTextToVideoProject({ ...previous, ...patch }) : previous));
  };

  const updateSceneLocal = (sceneId: string, patch: Partial<TextToVideoScene>) => {
    setProject((previous) => {
      if (!previous) return previous;
      const scenes = previous.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene));
      const totalDuration = scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0);
      return normalizeTextToVideoProject({ ...previous, scenes, total_duration: totalDuration });
    });
  };

  const saveScenes = async (successTitle = "Scenes saved") => {
    if (!project) return;
    await saveProjectPatch({
      scenes: project.scenes,
      total_duration: project.scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0),
      thumbnail_url: project.scenes.find((scene) => scene.image_url)?.image_url ?? project.thumbnail_url,
    }, successTitle);
  };

  const updateCaptionLocal = (sceneId: string, captionId: string, patch: Partial<TextToVideoCaption>) => {
    setProject((previous) => {
      if (!previous) return previous;
      return normalizeTextToVideoProject({
        ...previous,
        scenes: previous.scenes.map((scene) =>
          scene.id === sceneId
            ? {
                ...scene,
                captions: (scene.captions ?? []).map((caption) =>
                  caption.id === captionId ? { ...caption, ...patch } : caption,
                ),
              }
            : scene,
        ),
      });
    });
  };

  const updateCaptionStyle = async (patch: Partial<TextToVideoCaptionStyle>) => {
    if (!project) return;
    const nextStyle = { ...project.caption_style, ...patch };
    updateProjectLocal({ caption_style: nextStyle });
    await saveProjectPatch({ caption_style: nextStyle }, "Caption style saved");
  };

  const addLayer = async () => {
    if (!project || !newLayer.url.trim()) return;
    const layer: TextToVideoTimelineLayer = {
      id: makeId(),
      type: newLayer.type,
      url: newLayer.url.trim(),
      start: Math.max(0, Number(newLayer.start) || 0),
      duration: Math.max(0.25, Number(newLayer.duration) || 3),
      track: project.timeline_layers?.length ?? 0,
      volume: newLayer.type === "audio" ? 1 : 0,
      opacity: newLayer.type === "audio" ? 1 : 0.85,
      trim_start: 0,
      trim_end: 0,
    };
    const timeline_layers = [...(project.timeline_layers ?? []), layer];
    updateProjectLocal({ timeline_layers });
    setNewLayer({ type: "image", url: "", start: 0, duration: 3 });
    await saveProjectPatch({ timeline_layers }, "Timeline layer added");
  };

  const updateLayer = async (layerId: string, patch: Partial<TextToVideoTimelineLayer>) => {
    if (!project) return;
    const timeline_layers = (project.timeline_layers ?? []).map((layer) =>
      layer.id === layerId ? { ...layer, ...patch } : layer,
    );
    updateProjectLocal({ timeline_layers });
    await saveProjectPatch({ timeline_layers }, "Timeline layer saved");
  };

  const removeLayer = async (layerId: string) => {
    if (!project) return;
    const timeline_layers = (project.timeline_layers ?? []).filter((layer) => layer.id !== layerId);
    updateProjectLocal({ timeline_layers });
    await saveProjectPatch({ timeline_layers }, "Timeline layer removed");
  };

  const searchLibrary = async () => {
    if (!libraryQuery.trim()) return;
    setIsSearchingLibrary(true);
    try {
      const { data, error } = await invokeGenerateVideo({ action: "librarySearch", q: libraryQuery, type: "image" });
      if (error) throw new Error(error);
      setLibraryItems(data?.items ?? []);
    } catch (error) {
      toast({
        title: "Library search failed",
        description: error instanceof Error ? error.message : "The media library did not return results.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingLibrary(false);
    }
  };

  const applyLibraryItemToScene = async (item: LibraryItem) => {
    if (!selectedScene) return;
    const url = mediaUrlFromLibraryItem(item);
    if (!url) return;
    updateSceneLocal(selectedScene.id, { image_url: url, video_url: null });
    await saveScenes("Scene visual saved");
  };

  const pollRenderJob = useCallback(async (projectId: string, jobId: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt < 8 ? 4000 : 8000));
      const { data, error } = await invokeGenerateVideo({ action: "renderStatus", projectId, jobId });
      if (error || !data?.render) continue;

      setRenderJob(data.render);
      if (data.generation) {
        setActiveGeneration(data.generation);
        setHistory((previous) => previous.map((item) => (item.id === data.generation?.id ? data.generation : item)));
      }

      if (data.render.status === "completed") {
        toast({ title: "Render complete", description: "The edited video is ready." });
        setIsRendering(false);
        return;
      }

      if (data.render.status === "failed") {
        toast({
          title: "Render failed",
          description: data.render.error || data.render.message || "The backend could not render this project.",
          variant: "destructive",
        });
        setIsRendering(false);
        return;
      }
    }
    setIsRendering(false);
  }, [invokeGenerateVideo, toast]);

  const renderProject = async () => {
    if (!project) return;
    setIsRendering(true);
    try {
      await saveProjectPatch({
        title: project.title,
        aspect: project.aspect,
        scenes: project.scenes,
        caption_style: project.caption_style,
        music_url: project.music_url,
        music_tracks: project.music_tracks,
        music_timeline: project.music_timeline,
        timeline_layers: project.timeline_layers,
        total_duration: project.total_duration,
      }, "Project saved for render");
      const { data, error } = await invokeGenerateVideo({
        action: "renderProject",
        projectId: project.id,
        fps: renderSettings.fps,
        outFormat: renderSettings.outFormat,
      });
      if (error) throw new Error(error);
      if (!data?.render) throw new Error("Render job was not returned");

      setRenderJob(data.render);
      if (data.generation) setActiveGeneration(data.generation);
      const jobId = data.render.job_id || data.render.id;
      if (jobId) void pollRenderJob(project.id, jobId);
      toast({ title: "Render started", description: `${renderSettings.outFormat.toUpperCase()} at ${renderSettings.fps}fps.` });
    } catch (error) {
      setIsRendering(false);
      toast({
        title: "Unable to start render",
        description: error instanceof Error ? error.message : "Render request failed.",
        variant: "destructive",
      });
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
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden mb-4 p-2 rounded-lg glass" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>

        {!hasAccess ? (
          <SubscriptionRequiredState
            title="Active subscription required"
            description="Text to video is available on Basic, Pro, and Advanced plans."
          />
        ) : (
          <div className="mx-auto max-w-none space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="mb-3">{TEXT_TO_VIDEO_COST_PER_10_SECONDS} credits / 10 seconds</Badge>
                <h1 className="font-display text-3xl font-bold">{isEditorRoute ? "Timeline Editor" : "Text to Video"}</h1>
                <p className="text-muted-foreground">
                  {isEditorRoute
                    ? "Edit scenes, captions, media layers, timing, and render settings for this video project."
                    : "Generate videos from scripts, then open the timeline editor for professional edits and final rendering."}
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

            <div className="space-y-6">
              {!isEditorRoute && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /> Generate</CardTitle>
                    <CardDescription>Creates scenes, voiceover, word captions, stock visuals, and an initial render.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="video-title">Title</Label>
                      <Input id="video-title" placeholder="Optional video title" value={formData.title} onChange={(event) => setFormData((previous) => ({ ...previous, title: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="video-prompt">Script</Label>
                      <Textarea id="video-prompt" rows={7} value={formData.prompt} onChange={(event) => setFormData((previous) => ({ ...previous, prompt: event.target.value }))} placeholder="Paste a complete short-form script." />
                      <p className="text-xs text-muted-foreground">{formData.prompt.length} chars - {wordCount} words - ~{estimatedDurationSeconds}s</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {TEXT_TO_VIDEO_ASPECTS.map((aspect) => {
                        const Icon = getAspectIcon(aspect);
                        const selected = formData.aspectRatio === aspect;
                        return (
                          <button
                            key={aspect}
                            type="button"
                            onClick={() => setFormData((previous) => ({ ...previous, aspectRatio: aspect }))}
                            className={`rounded-lg border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}
                          >
                            <Icon className="mb-2 h-5 w-5" />
                            <p className="font-mono text-sm">{aspect}</p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Voice</Label>
                        <Select value={formData.voice} onValueChange={(value: TextToVideoVoice) => setFormData((previous) => ({ ...previous, voice: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TEXT_TO_VIDEO_VOICES.map((voice) => <SelectItem key={voice.id} value={voice.id}>{voice.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Theme</Label>
                        <Select value={formData.captionTheme} onValueChange={(value: TextToVideoCaptionTheme) => setFormData((previous) => ({ ...previous, captionTheme: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TEXT_TO_VIDEO_CAPTION_THEMES.map((theme) => <SelectItem key={theme.id} value={theme.id}>{theme.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Estimated cost</p>
                          <p className="text-2xl font-bold text-primary">{estimatedCredits} credits</p>
                        </div>
                        <Button onClick={handleGenerate} disabled={!canSubmit} size="lg">
                          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                          {isGenerating ? generationStep || "Generating" : "Generate"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Projects</CardTitle>
                    <CardDescription>Update, delete, or open a project in the timeline editor.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {history.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Generated projects will appear here.</div>
                    ) : history.map((item) => (
                      <div
                        key={item.id}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${activeGeneration?.id === item.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 text-sm font-medium">{item.prompt}</p>
                          <Badge variant={item.status === "failed" ? "destructive" : "outline"}>{item.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.duration_seconds}s - {item.aspect_ratio} - {item.credits_used} credits</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const providerProjectId = projectIdFromGeneration(item);
                              if (!providerProjectId) {
                                toast({ title: "Project unavailable", description: "This project has no editor id.", variant: "destructive" });
                                return;
                              }
                              navigate(`/dashboard/text-to-video/editor/${providerProjectId}`);
                            }}
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Edit Timeline
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void deleteProject(item)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
              )}

              {isEditorRoute && (
              <div className="space-y-6">
                {!project ? (
                  <Card>
                    <CardContent className="flex min-h-[520px] items-center justify-center">
                      <div className="max-w-sm text-center">
                        <Film className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                        <h2 className="text-xl font-semibold">No project open</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Generate a new video or open a recent project to edit scenes, captions, timeline layers, and render settings.</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <Input className="h-11 text-lg font-semibold" value={project.title} onChange={(event) => updateProjectLocal({ title: event.target.value })} />
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{project.aspect}</Badge>
                              <span>{project.scenes.length} scenes</span>
                              <span>{formatSeconds(project.total_duration)}</span>
                              <span>{project.status}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => void saveProjectPatch({ title: project.title, aspect: project.aspect }, "Project settings saved")} disabled={isSaving}>
                              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                              Save
                            </Button>
                            {activeVideoUrl && (
                              <Button variant="outline" asChild>
                                <a href={activeVideoUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Open Video</a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr),1.2fr]">
                          <div className="space-y-4">
                            <div className={`mx-auto overflow-hidden rounded-lg border border-border bg-black ${previewFrameClass(project.aspect)}`}>
                              {activeVideoUrl ? (
                                <video src={activeVideoUrl} controls className="h-full w-full bg-black object-contain" />
                              ) : selectedScene?.image_url ? (
                                <img src={selectedScene.image_url} alt="" className="h-full w-full bg-black object-contain" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Preview</div>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {project.scenes.map((scene) => (
                                <button
                                  key={scene.id}
                                  type="button"
                                  onClick={() => setSelectedSceneId(scene.id)}
                                  className={`rounded-lg border p-2 text-left ${selectedScene?.id === scene.id ? "border-primary bg-primary/10" : "border-border"}`}
                                >
                                  <div className="mb-2 aspect-video overflow-hidden rounded bg-muted">
                                    {scene.image_url ? <img src={scene.image_url} alt="" className="h-full w-full object-cover" /> : null}
                                  </div>
                                  <p className="truncate text-xs font-medium">Scene {scene.index + 1}</p>
                                  <p className="text-xs text-muted-foreground">{formatSeconds(scene.duration)}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          <Tabs defaultValue="scene" className="min-w-0">
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="scene"><Scissors className="mr-2 h-4 w-4" />Scene</TabsTrigger>
                              <TabsTrigger value="captions"><Captions className="mr-2 h-4 w-4" />Captions</TabsTrigger>
                              <TabsTrigger value="media"><ImagePlus className="mr-2 h-4 w-4" />Media</TabsTrigger>
                            </TabsList>

                            <TabsContent value="scene" className="mt-4 space-y-4">
                              {selectedScene && (
                                <>
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label>Duration</Label>
                                      <Input type="number" min={0.25} step={0.25} value={selectedScene.duration} onChange={(event) => updateSceneLocal(selectedScene.id, { duration: Number(event.target.value) || 0.25 })} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Speaker</Label>
                                      <Select value={selectedScene.speaker ?? "primary"} onValueChange={(value) => updateSceneLocal(selectedScene.id, { speaker: value })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {["primary", "speaker2", "speaker3", "speaker4"].map((speaker) => <SelectItem key={speaker} value={speaker}>{speaker}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Scene script</Label>
                                    <Textarea rows={5} value={selectedScene.script} onChange={(event) => updateSceneLocal(selectedScene.id, { script: event.target.value })} />
                                  </div>
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label>Animation</Label>
                                      <Select value={selectedScene.animation ?? "ken_burns_in"} onValueChange={(value) => updateSceneLocal(selectedScene.id, { animation: value })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{ANIMATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Transition</Label>
                                      <Select value={selectedScene.transition_in ?? "fade"} onValueChange={(value) => updateSceneLocal(selectedScene.id, { transition_in: value })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{TRANSITIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                      <Label>Crop X</Label>
                                      <Slider value={[selectedScene.crop_x ?? 0]} min={-100} max={100} step={1} onValueChange={([value]) => updateSceneLocal(selectedScene.id, { crop_x: value })} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Crop Y</Label>
                                      <Slider value={[selectedScene.crop_y ?? 0]} min={-100} max={100} step={1} onValueChange={([value]) => updateSceneLocal(selectedScene.id, { crop_y: value })} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Zoom</Label>
                                      <Slider value={[selectedScene.crop_zoom ?? 1]} min={1} max={2.5} step={0.05} onValueChange={([value]) => updateSceneLocal(selectedScene.id, { crop_zoom: value })} />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Effects</Label>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {EFFECTS.map((effect) => {
                                        const checked = (selectedScene.effects ?? []).includes(effect);
                                        return (
                                          <label key={effect} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                                            <Checkbox
                                              checked={checked}
                                              onCheckedChange={(next) => {
                                                const effects = new Set(selectedScene.effects ?? []);
                                                if (next) effects.add(effect);
                                                else effects.delete(effect);
                                                updateSceneLocal(selectedScene.id, { effects: [...effects] });
                                              }}
                                            />
                                            {effect}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <Button onClick={() => void saveScenes()} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Scene
                                  </Button>
                                </>
                              )}
                            </TabsContent>

                            <TabsContent value="captions" className="mt-4 space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Preset</Label>
                                  <Select value={project.caption_style.preset} onValueChange={(value) => void updateCaptionStyle({ preset: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{CAPTION_PRESETS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Font</Label>
                                  <Select value={project.caption_style.font} onValueChange={(value) => void updateCaptionStyle({ font: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{CAPTION_FONTS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Position</Label>
                                  <Select value={project.caption_style.position} onValueChange={(value) => void updateCaptionStyle({ position: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{CAPTION_POSITIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Background</Label>
                                  <Select value={project.caption_style.background} onValueChange={(value) => void updateCaptionStyle({ background: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{CAPTION_BACKGROUNDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Active color</Label>
                                  <Input type="color" value={project.caption_style.active_color} onChange={(event) => updateProjectLocal({ caption_style: { ...project.caption_style, active_color: event.target.value } })} onBlur={() => void saveProjectPatch({ caption_style: project.caption_style }, "Caption color saved")} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Phrase color</Label>
                                  <Input type="color" value={project.caption_style.phrase_color} onChange={(event) => updateProjectLocal({ caption_style: { ...project.caption_style, phrase_color: event.target.value } })} onBlur={() => void saveProjectPatch({ caption_style: project.caption_style }, "Caption color saved")} />
                                </div>
                              </div>
                              <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                  <Label>Active size</Label>
                                  <Input type="number" value={project.caption_style.size_active} onChange={(event) => updateProjectLocal({ caption_style: { ...project.caption_style, size_active: Number(event.target.value) || 72 } })} onBlur={() => void saveProjectPatch({ caption_style: project.caption_style }, "Caption size saved")} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Phrase size</Label>
                                  <Input type="number" value={project.caption_style.size_phrase} onChange={(event) => updateProjectLocal({ caption_style: { ...project.caption_style, size_phrase: Number(event.target.value) || 0 } })} onBlur={() => void saveProjectPatch({ caption_style: project.caption_style }, "Caption size saved")} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Stroke</Label>
                                  <Input type="number" value={project.caption_style.stroke_width} onChange={(event) => updateProjectLocal({ caption_style: { ...project.caption_style, stroke_width: Number(event.target.value) || 0 } })} onBlur={() => void saveProjectPatch({ caption_style: project.caption_style }, "Caption stroke saved")} />
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 text-sm"><Switch checked={project.caption_style.uppercase} onCheckedChange={(checked) => void updateCaptionStyle({ uppercase: checked })} />Uppercase</label>
                                <label className="flex items-center gap-2 text-sm"><Switch checked={project.caption_style.show_phrase} onCheckedChange={(checked) => void updateCaptionStyle({ show_phrase: checked })} />Show phrase</label>
                                <Select value={project.caption_style.animation} onValueChange={(value) => void updateCaptionStyle({ animation: value })}>
                                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                  <SelectContent>{CAPTION_ANIMATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <Separator />
                              <div className="space-y-3">
                                {(selectedScene?.captions ?? []).map((caption) => (
                                  <div key={caption.id} className="rounded-lg border border-border p-3">
                                    <Textarea rows={2} value={caption.text} onChange={(event) => selectedScene && updateCaptionLocal(selectedScene.id, caption.id, { text: event.target.value })} />
                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                      <Input type="number" step="0.05" value={caption.start} onChange={(event) => selectedScene && updateCaptionLocal(selectedScene.id, caption.id, { start: Number(event.target.value) || 0 })} />
                                      <Input type="number" step="0.05" value={caption.end} onChange={(event) => selectedScene && updateCaptionLocal(selectedScene.id, caption.id, { end: Number(event.target.value) || 0 })} />
                                      <Select value={caption.style_preset ?? project.caption_style.preset} onValueChange={(value) => selectedScene && updateCaptionLocal(selectedScene.id, caption.id, { style_preset: value })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{CAPTION_PRESETS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <Button onClick={() => void saveScenes("Captions saved")} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Captions
                              </Button>
                            </TabsContent>

                            <TabsContent value="media" className="mt-4 space-y-4">
                              {selectedScene && (
                                <>
                                  <div className="space-y-2">
                                    <Label>Image URL</Label>
                                    <Input value={selectedScene.image_url ?? ""} onChange={(event) => updateSceneLocal(selectedScene.id, { image_url: event.target.value })} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Video URL</Label>
                                    <Input value={selectedScene.video_url ?? ""} onChange={(event) => updateSceneLocal(selectedScene.id, { video_url: event.target.value })} />
                                  </div>
                                  <Button onClick={() => void saveScenes("Scene media saved")} disabled={isSaving}>
                                    <Save className="mr-2 h-4 w-4" />Save Media
                                  </Button>
                                  <Separator />
                                  <div className="flex gap-2">
                                    <Input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search stock media" onKeyDown={(event) => { if (event.key === "Enter") void searchLibrary(); }} />
                                    <Button onClick={() => void searchLibrary()} disabled={isSearchingLibrary}>
                                      {isSearchingLibrary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                                    {libraryItems.map((item, index) => {
                                      const url = mediaUrlFromLibraryItem(item);
                                      return (
                                        <button key={`${item.id ?? index}`} type="button" onClick={() => void applyLibraryItemToScene(item)} className="overflow-hidden rounded-lg border border-border text-left">
                                          {url ? <img src={url} alt="" className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-muted" />}
                                          <p className="truncate p-2 text-xs">{item.title || item.tags || "Media item"}</p>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </TabsContent>

                          </Tabs>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Layers className="h-5 w-5 text-primary" />
                              Timeline Editor
                            </CardTitle>
                            <CardDescription>Multi-track scene, caption, overlay, and audio editing for the final render.</CardDescription>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setTimelineZoom((value) => Math.max(24, value - 12))}>
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Badge variant="outline">{Math.round(timelineZoom)} px/s</Badge>
                            <Button variant="outline" size="sm" onClick={() => setTimelineZoom((value) => Math.min(96, value + 12))}>
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Select value={String(renderSettings.fps)} onValueChange={(value) => setRenderSettings((previous) => ({ ...previous, fps: Number(value) }))}>
                              <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>{[20, 24, 30, 48, 60, 90].map((fps) => <SelectItem key={fps} value={String(fps)}>{fps} fps</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={renderSettings.outFormat} onValueChange={(value) => setRenderSettings((previous) => ({ ...previous, outFormat: value }))}>
                              <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>{["mp4", "webm", "mov", "gif"].map((format) => <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button onClick={() => void renderProject()} disabled={isRendering || isSaving}>
                              {isRendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                              Render
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {renderJob && (
                          <div className="rounded-lg border border-border bg-muted/20 p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">{renderJob.message || renderJob.status}</span>
                              <Badge variant={renderJob.status === "failed" ? "destructive" : "outline"}>{renderJob.status}</Badge>
                            </div>
                            <Progress value={renderJob.progress ?? (renderJob.status === "completed" ? 100 : 0)} />
                            {renderJob.error && <p className="mt-2 text-sm text-destructive">{renderJob.error}</p>}
                          </div>
                        )}
                        <div className="grid gap-4 xl:grid-cols-[1fr,320px]">
                          <div className="overflow-hidden rounded-lg border border-border bg-background">
                            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm"><MousePointer2 className="mr-2 h-4 w-4" />Select</Button>
                                <Button variant="outline" size="sm"><Scissors className="mr-2 h-4 w-4" />Split</Button>
                                <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Layer</Button>
                              </div>
                              <div className="text-xs text-muted-foreground">{formatSeconds(timelineDuration)} total</div>
                            </div>

                            <div className="overflow-x-auto">
                              <div className="relative" style={{ width: `${timelineWidth}px` }}>
                                <div className="sticky top-0 z-20 h-9 border-b border-border bg-background">
                                  {timelineTicks.map((tick) => (
                                    <div key={tick} className="absolute top-0 h-full border-l border-border/70 pl-1 text-[10px] text-muted-foreground" style={{ left: `${(tick / timelineDuration) * 100}%` }}>
                                      {formatSeconds(tick)}
                                    </div>
                                  ))}
                                </div>

                                <div className="pointer-events-none absolute bottom-0 top-9 z-30 w-px bg-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]" style={{ left: `${selectedScene ? (sceneTimeline.find((item) => item.scene.id === selectedScene.id)?.start ?? 0) / timelineDuration * 100 : 0}%` }}>
                                  <div className="-ml-2 h-3 w-4 rounded-b bg-primary" />
                                </div>

                                <div className="space-y-1 p-3">
                                  <div className="grid grid-cols-[110px,1fr] gap-3">
                                    <div className="flex h-14 items-center gap-2 text-xs font-medium text-muted-foreground"><Film className="h-4 w-4" />Scenes</div>
                                    <div className="relative h-14 rounded-md border border-border bg-muted/20">
                                      {sceneTimeline.map(({ scene, start, duration }) => (
                                        <button
                                          key={scene.id}
                                          type="button"
                                          onClick={() => setSelectedSceneId(scene.id)}
                                          className={`absolute top-1 h-12 rounded-md border px-3 text-left text-xs shadow-sm transition-colors ${selectedScene?.id === scene.id ? "border-primary bg-primary/20 text-primary" : "border-cyan-500/30 bg-cyan-500/10 text-foreground"}`}
                                          style={clipStyle(start, duration, timelineDuration)}
                                        >
                                          <p className="truncate font-medium">Scene {scene.index + 1}</p>
                                          <p className="text-muted-foreground">{formatSeconds(duration)}</p>
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-[110px,1fr] gap-3">
                                    <div className="flex h-12 items-center gap-2 text-xs font-medium text-muted-foreground"><Type className="h-4 w-4" />Captions</div>
                                    <div className="relative h-12 rounded-md border border-border bg-muted/10">
                                      {(selectedScene?.captions ?? []).map((caption) => (
                                        <button
                                          key={caption.id}
                                          type="button"
                                          className="absolute top-1 h-10 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 text-left text-[11px] text-amber-100"
                                          style={clipStyle(caption.start, Math.max(0.2, caption.end - caption.start), timelineDuration)}
                                        >
                                          <span className="line-clamp-1">{caption.text}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {(["video", "image"] as const).map((type) => (
                                    <div key={type} className="grid grid-cols-[110px,1fr] gap-3">
                                      <div className="flex h-12 items-center gap-2 text-xs font-medium text-muted-foreground">
                                        {type === "video" ? <Video className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                                        {type === "video" ? "Video" : "Images"}
                                      </div>
                                      <div className="relative h-12 rounded-md border border-border bg-muted/10">
                                        {(project.timeline_layers ?? []).filter((layer) => layer.type === type).map((layer) => (
                                          <button
                                            key={layer.id}
                                            type="button"
                                            onClick={() => setSelectedLayerId(layer.id)}
                                            className={`absolute top-1 h-10 rounded-md border px-2 text-left text-[11px] transition-colors ${selectedLayerId === layer.id ? "border-primary bg-primary/20 text-primary" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"}`}
                                            style={clipStyle(layer.start, layer.duration, timelineDuration)}
                                          >
                                            <span className="line-clamp-1">{layer.url}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}

                                  <div className="grid grid-cols-[110px,1fr] gap-3">
                                    <div className="flex h-12 items-center gap-2 text-xs font-medium text-muted-foreground"><Volume2 className="h-4 w-4" />Audio</div>
                                    <div className="relative h-12 rounded-md border border-border bg-muted/10">
                                      {(project.timeline_layers ?? []).filter((layer) => layer.type === "audio").map((layer) => (
                                        <button
                                          key={layer.id}
                                          type="button"
                                          onClick={() => setSelectedLayerId(layer.id)}
                                          className={`absolute top-1 h-10 rounded-md border px-2 text-left text-[11px] transition-colors ${selectedLayerId === layer.id ? "border-primary bg-primary/20 text-primary" : "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100"}`}
                                          style={clipStyle(layer.start, layer.duration, timelineDuration)}
                                        >
                                          <span className="line-clamp-1">{layer.url}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-3 border-t border-border bg-muted/10 p-3 md:grid-cols-[120px,1fr,90px,90px,auto]">
                              <Select value={newLayer.type} onValueChange={(value: TextToVideoTimelineLayer["type"]) => setNewLayer((previous) => ({ ...previous, type: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="image">Image</SelectItem>
                                  <SelectItem value="video">Video</SelectItem>
                                  <SelectItem value="audio">Audio</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input value={newLayer.url} onChange={(event) => setNewLayer((previous) => ({ ...previous, url: event.target.value }))} placeholder="Layer media URL or /api/storage path" />
                              <Input type="number" min={0} step={0.25} value={newLayer.start} onChange={(event) => setNewLayer((previous) => ({ ...previous, start: Number(event.target.value) || 0 }))} />
                              <Input type="number" min={0.25} step={0.25} value={newLayer.duration} onChange={(event) => setNewLayer((previous) => ({ ...previous, duration: Number(event.target.value) || 0.25 }))} />
                              <Button onClick={() => void addLayer()}><Plus className="mr-2 h-4 w-4" />Add</Button>
                            </div>
                          </div>

                          <div className="rounded-lg border border-border bg-muted/10 p-4">
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">Inspector</p>
                                <p className="text-xs text-muted-foreground">{selectedLayer ? selectedLayer.type : selectedScene ? `Scene ${selectedScene.index + 1}` : "Select a clip"}</p>
                              </div>
                              {selectedLayer && (
                                <Button variant="ghost" size="icon" onClick={() => void removeLayer(selectedLayer.id)} aria-label="Remove selected layer">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            {selectedLayer ? (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label>Source</Label>
                                  <Input value={selectedLayer.url} onChange={(event) => updateProjectLocal({ timeline_layers: (project.timeline_layers ?? []).map((item) => item.id === selectedLayer.id ? { ...item, url: event.target.value } : item) })} onBlur={(event) => void updateLayer(selectedLayer.id, { url: event.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Start</Label>
                                    <Input type="number" step={0.25} value={selectedLayer.start} onChange={(event) => updateProjectLocal({ timeline_layers: (project.timeline_layers ?? []).map((item) => item.id === selectedLayer.id ? { ...item, start: Number(event.target.value) || 0 } : item) })} onBlur={(event) => void updateLayer(selectedLayer.id, { start: Number(event.target.value) || 0 })} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Duration</Label>
                                    <Input type="number" step={0.25} value={selectedLayer.duration} onChange={(event) => updateProjectLocal({ timeline_layers: (project.timeline_layers ?? []).map((item) => item.id === selectedLayer.id ? { ...item, duration: Number(event.target.value) || 0.25 } : item) })} onBlur={(event) => void updateLayer(selectedLayer.id, { duration: Math.max(0.25, Number(event.target.value) || 0.25) })} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Volume</Label>
                                    <Input type="number" step={0.05} disabled={selectedLayer.type !== "audio"} value={selectedLayer.volume} onChange={(event) => updateProjectLocal({ timeline_layers: (project.timeline_layers ?? []).map((item) => item.id === selectedLayer.id ? { ...item, volume: Number(event.target.value) || 0 } : item) })} onBlur={(event) => void updateLayer(selectedLayer.id, { volume: Number(event.target.value) || 0 })} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Opacity</Label>
                                    <Input type="number" step={0.05} disabled={selectedLayer.type === "audio"} value={selectedLayer.opacity} onChange={(event) => updateProjectLocal({ timeline_layers: (project.timeline_layers ?? []).map((item) => item.id === selectedLayer.id ? { ...item, opacity: Number(event.target.value) || 0 } : item) })} onBlur={(event) => void updateLayer(selectedLayer.id, { opacity: Number(event.target.value) || 0 })} />
                                  </div>
                                </div>
                              </div>
                            ) : selectedScene ? (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label>Scene script</Label>
                                  <Textarea rows={5} value={selectedScene.script} onChange={(event) => updateSceneLocal(selectedScene.id, { script: event.target.value })} onBlur={() => void saveScenes("Scene saved")} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Duration</Label>
                                    <Input type="number" min={0.25} step={0.25} value={selectedScene.duration} onChange={(event) => updateSceneLocal(selectedScene.id, { duration: Number(event.target.value) || 0.25 })} onBlur={() => void saveScenes("Scene timing saved")} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Animation</Label>
                                    <Select value={selectedScene.animation ?? "ken_burns_in"} onValueChange={(value) => updateSceneLocal(selectedScene.id, { animation: value })}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>{ANIMATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <Button onClick={() => void saveScenes()} disabled={isSaving}>
                                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                  Save Scene
                                </Button>
                              </div>
                            ) : (
                              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Select a clip on the timeline.</div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TextToVideo;
