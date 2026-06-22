import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import { VideoEditorWorkspace } from "@/components/text-to-video/VideoEditorWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Edit3,
  Film,
  Loader2,
  Menu,
  Monitor,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Wand2,
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

interface UploadMediaResponse {
  upload?: {
    url?: string;
    media_type?: "image" | "video" | "audio" | string;
    filename?: string;
    size?: number;
    kind?: string;
  };
  error?: string;
  message?: string;
}

interface LibraryItem {
  id?: string | number;
  type?: "image" | "video" | "audio" | string;
  title?: string;
  url?: string;
  image_url?: string;
  video_url?: string;
  thumb?: string;
  preview_url?: string;
  previewURL?: string;
  webformatURL?: string;
  source_url?: string;
  tags?: string;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(16).slice(2);

const mediaUrlFromLibraryItem = (item: LibraryItem) =>
  item.video_url || item.image_url || item.url || item.webformatURL || item.preview_url || item.previewURL || item.thumb || "";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const renderStateFromGeneration = (generation: TextToVideoGeneration | null | undefined) => {
  const render = isRecord(generation?.provider_response?.render) ? generation.provider_response.render : {};
  const progress = typeof render.progress === "number"
    ? render.progress
    : generation?.status === "completed"
      ? 100
      : generation?.status === "processing"
        ? 5
        : 0;
  const message = typeof render.message === "string"
    ? render.message
    : generation?.status === "completed"
      ? "Completed"
      : generation?.status === "failed"
        ? generation.error_message || "Failed"
        : "Processing";
  const status = typeof render.status === "string" ? render.status : generation?.status || "queued";
  return { progress: clampPercent(progress), message, status };
};

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
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationProgressMessage, setGenerationProgressMessage] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [isSearchingLibrary, setIsSearchingLibrary] = useState(false);
  const [newLayer, setNewLayer] = useState({
    type: "video" as TextToVideoTimelineLayer["type"],
    url: "",
    start: 0,
    duration: 3,
  });
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(48);
  const pollingGenerationRef = useRef<string | null>(null);
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
  const activeGenerationRenderState = useMemo(
    () => renderStateFromGeneration(activeGeneration),
    [activeGeneration],
  );
  const visibleGenerationProgress = isGenerating
    ? generationProgress
    : activeGeneration?.status === "processing" || activeGeneration?.status === "completed"
      ? activeGenerationRenderState.progress
      : 0;
  const visibleGenerationMessage = isGenerating
    ? generationProgressMessage || generationStep || "Processing"
    : activeGeneration?.status === "processing" || activeGeneration?.status === "completed"
      ? activeGenerationRenderState.message
      : "";
  const shouldShowGenerationProgress =
    isGenerating || activeGeneration?.status === "processing" || activeGeneration?.status === "completed";

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

  const uploadProjectMedia = useCallback(async (file: File, kind: "image" | "video" | "audio" = "video", forceSessionRefresh = false) => {
    const session = await getSessionWithRefresh(forceSessionRefresh);
    if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");

    const formData = new FormData();
    formData.append("action", "uploadMedia");
    formData.append("kind", kind);
    formData.append("file", file);

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: formData,
    });

    const raw = await response.text();
    let parsed: UploadMediaResponse | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (response.status === 401 && !forceSessionRefresh) {
      return uploadProjectMedia(file, kind, true);
    }

    if (!response.ok) {
      return { data: null, error: parsed?.error || parsed?.message || raw || `Upload failed with status ${response.status}` };
    }

    return { data: parsed, error: null as string | null };
  }, [getSessionWithRefresh]);

  const startStepFlow = useCallback(() => {
    const steps = [
      { label: "Splitting scenes", progress: 8 },
      { label: "Generating voiceover", progress: 22 },
      { label: "Aligning captions", progress: 38 },
      { label: "Finding Pixabay videos", progress: 52 },
      { label: "Starting render", progress: 64 },
      { label: "Rendering draft", progress: 72 },
    ];
    let index = 0;
    setGenerationStep(steps[index].label);
    setGenerationProgressMessage(steps[index].label);
    setGenerationProgress(steps[index].progress);
    return window.setInterval(() => {
      index = Math.min(steps.length - 1, index + 1);
      setGenerationStep(steps[index].label);
      setGenerationProgressMessage(steps[index].label);
      setGenerationProgress(steps[index].progress);
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
    pollingGenerationRef.current = generationId;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, attempt < 6 ? 5000 : 10000));
      }
      const { data, error } = await invokeGenerateVideo({ action: "status", generationId });
      if (error || !data?.generation) continue;

      setHistory((previous) => previous.map((item) => (item.id === data.generation?.id ? data.generation : item)));
      setActiveGeneration((previous) => (!previous || previous.id === data.generation?.id ? data.generation : previous));
      const renderState = renderStateFromGeneration(data.generation);
      setGenerationProgress(renderState.progress);
      setGenerationProgressMessage(renderState.message);
      if (data.project) {
        const normalized = normalizeTextToVideoProject(data.project);
        setProject((previous) => (!previous || previous.id === normalized.id ? normalized : previous));
        setSelectedSceneId((previous) => previous ?? normalized.scenes[0]?.id ?? null);
      }
      if (data.render) {
        setRenderJob(data.render);
      } else if (isRecord(data.generation.provider_response?.render)) {
        setRenderJob(data.generation.provider_response.render as unknown as TextToVideoRenderJob);
      }

      if (data.generation.status === "completed") {
        setGenerationProgress(100);
        setGenerationProgressMessage("Completed");
        pollingGenerationRef.current = null;
        toast({ title: "Video ready", description: "Your text-to-video render is complete." });
        return;
      }

      if (data.generation.status === "failed") {
        setGenerationProgressMessage(data.generation.error_message || "Failed");
        pollingGenerationRef.current = null;
        toast({
          title: "Video render failed",
          description: data.generation.error_message || "The video backend could not complete this render.",
          variant: "destructive",
        });
        return;
      }
    }
    pollingGenerationRef.current = null;
  }, [invokeGenerateVideo, toast]);

  useEffect(() => {
    if (!loading && !user) navigate("/signin");
  }, [loading, navigate, user]);

  useEffect(() => {
    void fetchCredits();
    void fetchHistory();
  }, [fetchCredits, fetchHistory]);

  useEffect(() => {
    if (loading || !hasAccess) return;
    const processing = history.find((item) => item.status === "processing");
    if (!processing || pollingGenerationRef.current === processing.id) return;
    setActiveGeneration((previous) => previous ?? processing);
    const renderState = renderStateFromGeneration(processing);
    setGenerationProgress(renderState.progress);
    setGenerationProgressMessage(renderState.message);
    void pollGenerationStatus(processing.id);
  }, [hasAccess, history, loading, pollGenerationStatus]);

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
      if (data.render) {
        setRenderJob(data.render);
        setGenerationProgress(clampPercent(data.render.progress ?? 65));
        setGenerationProgressMessage(data.render.message || "Rendering draft");
      }
      setUserCredits((previous) => ({
        ai_credits_balance: data.remainingCredits ?? previous.ai_credits_balance - data.generation!.credits_used,
        ai_credits_used: previous.ai_credits_used + data.generation!.credits_used,
      }));
      toast({ title: "Video job started", description: `${data.generation.credits_used} AI credits used for this request.` });
      if (data.generation.status === "processing") void pollGenerationStatus(data.generation.id);
    } catch (error) {
      setGenerationProgress(0);
      setGenerationProgressMessage("");
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

    try {
      const { error } = await invokeGenerateVideo({
        action: "deleteProject",
        generationId: generation.id,
        projectId: providerProjectId,
      });
      if (error) throw new Error(error);
      setHistory((previous) => previous.filter((item) => item.id !== generation.id));
      if (project?.id === providerProjectId) setProject(null);
      if (activeGeneration?.id === generation.id) setActiveGeneration(null);
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

  const searchLibrary = async (mediaType: "image" | "video" = "video") => {
    if (!libraryQuery.trim()) return;
    setIsSearchingLibrary(true);
    try {
      const { data, error } = await invokeGenerateVideo({ action: "librarySearch", q: libraryQuery, type: mediaType });
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
    const isVideo = item.type === "video" || Boolean(item.video_url);
    updateSceneLocal(selectedScene.id, isVideo ? { video_url: item.video_url || item.url || url, image_url: null } : { image_url: item.image_url || item.url || url, video_url: null });
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
    <div className={`min-h-screen ${isEditorRoute ? "bg-[#111014]" : "bg-background"}`}>
      {!isEditorRoute && <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
      <main className={isEditorRoute ? "min-h-screen" : "min-h-screen p-4 lg:p-8"}>
        {!isEditorRoute && (
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mb-4 p-2 rounded-lg glass" aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
        )}

        {!hasAccess ? (
          <SubscriptionRequiredState
            title="Active subscription required"
            description="Text to video is available on Basic, Pro, and Advanced plans."
          />
        ) : (
          <div className={isEditorRoute ? "max-w-none" : "mx-auto max-w-none space-y-6"}>
            {!isEditorRoute && (
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
            )}

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
                      {shouldShowGenerationProgress && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{visibleGenerationMessage || "Processing"}</span>
                            <span>{visibleGenerationProgress}%</span>
                          </div>
                          <Progress value={visibleGenerationProgress} className="h-2" />
                        </div>
                      )}
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
                    ) : history.map((item) => {
                      const itemRenderState = renderStateFromGeneration(item);
                      return (
                        <div
                          key={item.id}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${activeGeneration?.id === item.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-medium">{item.prompt}</p>
                            <Badge variant={item.status === "failed" ? "destructive" : "outline"}>{item.status}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{item.duration_seconds}s - {item.aspect_ratio} - {item.credits_used} credits</p>
                          {(item.status === "processing" || item.status === "completed") && (
                            <div className="mt-3 space-y-1.5">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{itemRenderState.message}</span>
                                <span>{itemRenderState.progress}%</span>
                              </div>
                              <Progress value={itemRenderState.progress} className="h-1.5" />
                            </div>
                          )}
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
                      );
                    })}
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
                  <VideoEditorWorkspace
                    project={project}
                    selectedScene={selectedScene}
                    selectedSceneId={selectedSceneId}
                    selectedLayer={selectedLayer}
                    selectedLayerId={selectedLayerId}
                    activeVideoUrl={activeVideoUrl}
                    renderJob={renderJob}
                    renderSettings={renderSettings}
                    timelineZoom={timelineZoom}
                    isSaving={isSaving}
                    isRendering={isRendering}
                    libraryQuery={libraryQuery}
                    libraryItems={libraryItems}
                    isSearchingLibrary={isSearchingLibrary}
                    newLayer={newLayer}
                    setSelectedSceneId={setSelectedSceneId}
                    setSelectedLayerId={setSelectedLayerId}
                    setRenderSettings={setRenderSettings}
                    setTimelineZoom={setTimelineZoom}
                    setLibraryQuery={setLibraryQuery}
                    setNewLayer={setNewLayer}
                    updateProjectLocal={updateProjectLocal}
                    updateSceneLocal={updateSceneLocal}
                    updateCaptionLocal={updateCaptionLocal}
                    updateCaptionStyle={updateCaptionStyle}
                    saveProjectPatch={saveProjectPatch}
                    saveScenes={saveScenes}
                    updateLayer={updateLayer}
                    removeLayer={removeLayer}
                    addLayer={addLayer}
                    searchLibrary={searchLibrary}
                    applyLibraryItemToScene={applyLibraryItemToScene}
                    uploadProjectMedia={uploadProjectMedia}
                    renderProject={renderProject}
                  />
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
