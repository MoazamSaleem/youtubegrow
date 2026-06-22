import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type CSSProperties,
  type Dispatch,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Captions,
  ChevronLeft,
  Copy,
  Download,
  Film,
  ImagePlus,
  Layers,
  Loader2,
  Maximize2,
  Mic2,
  MousePointer2,
  Music2,
  PanelRight,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  Video,
  Volume2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  TEXT_TO_VIDEO_ASPECTS,
  type TextToVideoAspect,
  type TextToVideoCaption,
  type TextToVideoCaptionStyle,
  type TextToVideoProject,
  type TextToVideoRenderJob,
  type TextToVideoScene,
  type TextToVideoTimelineLayer,
} from "@/lib/textToVideo";

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

interface RenderSettings {
  fps: number;
  outFormat: string;
}

interface NewLayerDraft {
  type: TextToVideoTimelineLayer["type"];
  url: string;
  start: number;
  duration: number;
}

type EditorPanel = "text" | "scene" | "media" | "audio" | "settings";
type ReplaceTarget =
  | { kind: "scene"; id: string }
  | { kind: "layer"; id: string; mediaType: TextToVideoTimelineLayer["type"] };

interface UploadMediaResult {
  url?: string;
  media_type?: "image" | "video" | "audio" | string;
  filename?: string;
  size?: number;
  kind?: string;
}

interface VideoEditorWorkspaceProps {
  project: TextToVideoProject;
  selectedScene: TextToVideoScene | null;
  selectedSceneId: string | null;
  selectedLayer: TextToVideoTimelineLayer | null;
  selectedLayerId: string | null;
  activeVideoUrl: string | null;
  renderJob: TextToVideoRenderJob | null;
  renderSettings: RenderSettings;
  timelineZoom: number;
  isSaving: boolean;
  isRendering: boolean;
  libraryQuery: string;
  libraryItems: LibraryItem[];
  isSearchingLibrary: boolean;
  newLayer: NewLayerDraft;
  setSelectedSceneId: Dispatch<SetStateAction<string | null>>;
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>;
  setRenderSettings: Dispatch<SetStateAction<RenderSettings>>;
  setTimelineZoom: Dispatch<SetStateAction<number>>;
  setLibraryQuery: Dispatch<SetStateAction<string>>;
  setNewLayer: Dispatch<SetStateAction<NewLayerDraft>>;
  updateProjectLocal: (patch: Partial<TextToVideoProject>) => void;
  updateSceneLocal: (sceneId: string, patch: Partial<TextToVideoScene>) => void;
  updateCaptionLocal: (sceneId: string, captionId: string, patch: Partial<TextToVideoCaption>) => void;
  updateCaptionStyle: (patch: Partial<TextToVideoCaptionStyle>) => Promise<void>;
  saveProjectPatch: (patch: Partial<TextToVideoProject>, successTitle?: string) => Promise<TextToVideoProject | null>;
  saveScenes: (successTitle?: string) => Promise<void>;
  updateLayer: (layerId: string, patch: Partial<TextToVideoTimelineLayer>) => Promise<void>;
  removeLayer: (layerId: string) => Promise<void>;
  addLayer: () => Promise<void>;
  searchLibrary: (mediaType?: "image" | "video") => Promise<void>;
  applyLibraryItemToScene: (item: LibraryItem) => Promise<void>;
  uploadProjectMedia: (
    file: File,
    kind?: "image" | "video" | "audio",
  ) => Promise<{ data: { upload?: UploadMediaResult } | null; error: string | null }>;
  renderProject: () => Promise<void>;
}

const EFFECTS = ["shake", "rgb_split", "glitch", "blur_reveal", "vignette", "film_burn", "flash", "speed_ramp"];
const ANIMATIONS = ["ken_burns_in", "ken_burns_out", "punch_in", "slow_pan", "none"];
const TRANSITIONS = ["fade", "flash", "zoom", "swipe"];
const CAPTION_PRESETS = ["viral_pop", "hormozi", "mrbeast", "minimal", "subtitle"];
const CAPTION_FONTS = ["bold_sans", "display", "narrow", "mono", "serif"];
const CAPTION_POSITIONS = ["top", "middle", "bottom"];
const CAPTION_BACKGROUNDS = ["none", "accent_box", "dark_box"];
const CAPTION_ANIMATIONS = ["pop", "fade", "slide", "none"];
const LABEL_COLUMN_WIDTH = 124;
const MIN_CLIP_SECONDS = 0.25;
const LIBRARY_DRAG_MIME = "application/x-video-editor-library-item";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(16).slice(2);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const snapTime = (value: number) => Math.round(value * 20) / 20;

const formatSeconds = (value: number) => `${Math.max(0, Number(value) || 0).toFixed(1)}s`;

const formatClock = (value: number) => {
  const safe = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
};

const mediaUrlFromLibraryItem = (item: LibraryItem) =>
  item.video_url || item.image_url || item.url || item.webformatURL || item.preview_url || item.previewURL || item.thumb || "";

const thumbnailUrlFromLibraryItem = (item: LibraryItem) =>
  item.thumb || item.image_url || item.preview_url || item.previewURL || item.webformatURL || "";

const isLibraryVideoItem = (item: LibraryItem) => item.type === "video" || Boolean(item.video_url);

const isTimelineMediaType = (value: unknown): value is TextToVideoTimelineLayer["type"] =>
  value === "image" || value === "video" || value === "audio";

const labelFromUrl = (url: string) => {
  if (!url) return "Untitled layer";
  try {
    const parsed = new URL(url);
    const part = parsed.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(part || parsed.hostname);
  } catch {
    return url.split("/").filter(Boolean).pop() || url;
  }
};

const isPlayableBrowserUrl = (url: string | null | undefined) =>
  Boolean(url) && !/^[A-Za-z]:[\\/]/.test(String(url)) && !String(url).startsWith("/app/storage/");

const sceneAtTime = (
  sceneTimeline: { scene: TextToVideoScene; start: number; duration: number }[],
  time: number,
) =>
  sceneTimeline.find(({ start, duration }) => time >= start && time < start + duration) ??
  sceneTimeline[sceneTimeline.length - 1] ??
  null;

const captionBounds = (caption: TextToVideoCaption, sceneStart: number, sceneDuration: number) => {
  const start = Number(caption.start) || 0;
  const end = Number(caption.end) || start + 0.5;
  const looksLocal = end <= sceneDuration + 0.75;
  return {
    start: looksLocal ? sceneStart + start : start,
    end: looksLocal ? sceneStart + end : end,
  };
};

const captionPositionClass = (position: string) => {
  if (position === "top") return "top-[12%]";
  if (position === "middle") return "top-1/2 -translate-y-1/2";
  return "bottom-[12%]";
};

type DragState =
  | {
      kind: "layer";
      action: "move" | "resize-start" | "resize-end";
      id: string;
      startX: number;
      initialLayers: TextToVideoTimelineLayer[];
      draftLayers: TextToVideoTimelineLayer[];
    }
  | {
      kind: "scene";
      action: "resize-end";
      id: string;
      startX: number;
      initialScenes: TextToVideoScene[];
      draftScenes: TextToVideoScene[];
    };

interface PreviewAudioSource {
  id: string;
  url: string;
  start: number;
  trimStart: number;
  volume: number;
  loop: boolean;
}

const TimelineClip = ({
  children,
  left,
  width,
  selected,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  onDragOver,
  onDrop,
}: {
  children: ReactNode;
  left: number;
  width: number;
  selected: boolean;
  className: string;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDragOver?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLDivElement>) => void;
}) => (
  <div
    role="button"
    tabIndex={0}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
    onDoubleClick={onDoubleClick}
    onDragOver={onDragOver}
    onDrop={onDrop}
    className={`absolute top-1 h-[calc(100%-8px)] overflow-hidden rounded-md border text-left text-xs shadow-sm transition-colors ${
      selected ? "ring-2 ring-white/80" : ""
    } ${className}`}
    style={{ left, width: Math.max(18, width) }}
  >
    {children}
  </div>
);

export const VideoEditorWorkspace = ({
  project,
  selectedScene,
  selectedSceneId,
  selectedLayer,
  selectedLayerId,
  activeVideoUrl,
  renderJob,
  renderSettings,
  timelineZoom,
  isSaving,
  isRendering,
  libraryQuery,
  libraryItems,
  isSearchingLibrary,
  newLayer,
  setSelectedSceneId,
  setSelectedLayerId,
  setRenderSettings,
  setTimelineZoom,
  setLibraryQuery,
  setNewLayer,
  updateProjectLocal,
  updateSceneLocal,
  updateCaptionLocal,
  updateCaptionStyle,
  saveProjectPatch,
  saveScenes,
  updateLayer,
  removeLayer,
  addLayer,
  searchLibrary,
  applyLibraryItemToScene,
  uploadProjectMedia,
  renderProject,
}: VideoEditorWorkspaceProps) => {
  const [activePanel, setActivePanel] = useState<EditorPanel>("text");
  const [playheadTime, setPlayheadTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [libraryMediaType, setLibraryMediaType] = useState<"image" | "video">("video");
  const [replaceMenu, setReplaceMenu] = useState<{ x: number; y: number; target: ReplaceTarget } | null>(null);
  const [pendingReplaceTarget, setPendingReplaceTarget] = useState<ReplaceTarget | null>(null);
  const [isUploadingReplacement, setIsUploadingReplacement] = useState(false);
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [isDragOverEditor, setIsDragOverEditor] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const timelineDuration = useMemo(() => {
    const layerEnd = Math.max(
      0,
      ...((project.timeline_layers ?? []).map((layer) => (Number(layer.start) || 0) + (Number(layer.duration) || 0))),
    );
    return Math.max(1, Number(project.total_duration) || 0, layerEnd);
  }, [project.timeline_layers, project.total_duration]);

  const sceneTimeline = useMemo(() => {
    let cursor = 0;
    return (project.scenes ?? []).map((scene) => {
      const start = cursor;
      const duration = Math.max(MIN_CLIP_SECONDS, Number(scene.duration) || MIN_CLIP_SECONDS);
      cursor += duration;
      return { scene, start, duration };
    });
  }, [project.scenes]);

  const timelineTicks = useMemo(() => {
    const step = timelineDuration > 90 ? 10 : timelineDuration > 35 ? 5 : 2;
    const count = Math.floor(timelineDuration / step) + 1;
    return Array.from({ length: count + 1 }, (_, index) => Math.min(index * step, timelineDuration));
  }, [timelineDuration]);

  const timelineWidth = Math.max(920, Math.ceil(timelineDuration * timelineZoom));
  const pixelsPerSecond = timelineWidth / Math.max(timelineDuration, 0.1);
  const playheadLeft = playheadTime * pixelsPerSecond;

  const captionTimeline = useMemo(
    () =>
      sceneTimeline.flatMap(({ scene, start, duration }) =>
        (scene.captions ?? []).map((caption) => {
          const bounds = captionBounds(caption, start, duration);
          return { scene, caption, ...bounds };
        }),
      ),
    [sceneTimeline],
  );

  const activeSceneItem = sceneAtTime(sceneTimeline, playheadTime);
  const previewScene = activeSceneItem?.scene ?? selectedScene ?? project.scenes[0] ?? null;
  const selectedCaption =
    captionTimeline.find((item) => item.caption.id === selectedCaptionId)?.caption ??
    captionTimeline.find((item) => playheadTime >= item.start && playheadTime <= item.end)?.caption ??
    previewScene?.captions?.[0] ??
    null;
  const activeLayers = (project.timeline_layers ?? []).filter(
    (layer) => playheadTime >= layer.start && playheadTime <= layer.start + layer.duration,
  );
  const activeVisualLayer =
    activeLayers.find((layer) => layer.type === "video") ?? activeLayers.find((layer) => layer.type === "image") ?? null;
  const previewVideoUrl = activeVisualLayer?.type === "video" ? activeVisualLayer.url : previewScene?.video_url ?? null;
  const previewVideoStart = activeVisualLayer?.type === "video" ? activeVisualLayer.start : activeSceneItem?.start ?? 0;
  const previewVideoTrimStart = activeVisualLayer?.type === "video" ? activeVisualLayer.trim_start : 0;
  const previewImageUrl = activeVisualLayer?.type === "image" ? activeVisualLayer.url : previewScene?.image_url ?? null;
  const previewAudioSources = useMemo<PreviewAudioSource[]>(() => {
    const sources: PreviewAudioSource[] = [];
    if (previewScene?.voiceover_url && activeSceneItem && isPlayableBrowserUrl(previewScene.voiceover_url)) {
      sources.push({
        id: `voiceover-${previewScene.id}`,
        url: previewScene.voiceover_url,
        start: activeSceneItem.start,
        trimStart: 0,
        volume: 1,
        loop: false,
      });
    }
    if (project.music_url && isPlayableBrowserUrl(project.music_url)) {
      const timeline = project.music_timeline ?? { start: 0, trim_start: 0 };
      sources.push({
        id: "project-music",
        url: project.music_url,
        start: Number(timeline.start) || 0,
        trimStart: Number(timeline.trim_start) || 0,
        volume: 0.25,
        loop: true,
      });
    }
    for (const layer of activeLayers.filter((item) => item.type === "audio" && isPlayableBrowserUrl(item.url))) {
      sources.push({
        id: `layer-${layer.id}`,
        url: layer.url,
        start: Number(layer.start) || 0,
        trimStart: Number(layer.trim_start) || 0,
        volume: clamp(Number(layer.volume) || 0, 0, 2),
        loop: true,
      });
    }
    return sources;
  }, [activeLayers, activeSceneItem, previewScene, project.music_timeline, project.music_url]);
  const captionStyle = project.caption_style;

  useEffect(() => {
    setPlayheadTime((value) => clamp(value, 0, timelineDuration));
  }, [timelineDuration]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setPlayheadTime((current) => {
        const next = snapTime(current + 0.05);
        if (next >= timelineDuration) {
          setIsPlaying(false);
          return timelineDuration;
        }
        return next;
      });
    }, 50);

    return () => window.clearInterval(timer);
  }, [isPlaying, timelineDuration]);

  useEffect(() => {
    const active = sceneAtTime(sceneTimeline, playheadTime);
    if (active && active.scene.id !== selectedSceneId) {
      setSelectedSceneId(active.scene.id);
    }
  }, [playheadTime, sceneTimeline, selectedSceneId, setSelectedSceneId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const targetTime = Math.max(0, playheadTime - previewVideoStart + (Number(previewVideoTrimStart) || 0));
    if (Number.isFinite(video.duration) && Math.abs(video.currentTime - targetTime) > 0.25) {
      try {
        video.currentTime = clamp(targetTime, 0, video.duration || timelineDuration);
      } catch {
        // Metadata can lag behind a remote source swap; the next effect tick will retry.
      }
    }
    if (isPlaying) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [activeVideoUrl, isPlaying, playheadTime, previewVideoStart, previewVideoTrimStart, previewVideoUrl, timelineDuration]);

  useEffect(() => {
    const activeIds = new Set(previewAudioSources.map((source) => source.id));

    for (const [id, audio] of Object.entries(audioRefs.current)) {
      if (!activeIds.has(id)) {
        audio.pause();
        delete audioRefs.current[id];
      }
    }

    for (const source of previewAudioSources) {
      let audio = audioRefs.current[source.id];
      if (!audio || audio.src !== source.url) {
        if (audio) audio.pause();
        audio = new Audio(source.url);
        audio.preload = "auto";
        audioRefs.current[source.id] = audio;
      }

      audio.loop = source.loop;
      audio.volume = clamp(source.volume, 0, 1);
      const targetTime = Math.max(0, playheadTime - source.start + source.trimStart);
      if (Math.abs(audio.currentTime - targetTime) > 0.35) {
        audio.currentTime = targetTime;
      }

      if (isPlaying) {
        void audio.play().catch(() => undefined);
      } else {
        audio.pause();
      }
    }
  }, [isPlaying, playheadTime, previewAudioSources]);

  useEffect(() => {
    return () => {
      for (const audio of Object.values(audioRefs.current)) {
        audio.pause();
      }
      audioRefs.current = {};
    };
  }, []);

  const selectScene = (sceneId: string) => {
    const item = sceneTimeline.find(({ scene }) => scene.id === sceneId);
    setSelectedSceneId(sceneId);
    setSelectedLayerId(null);
    setSelectedCaptionId(null);
    setActivePanel("scene");
    if (item) setPlayheadTime(item.start);
  };

  const selectCaption = (captionId: string, start: number) => {
    setSelectedCaptionId(captionId);
    setSelectedLayerId(null);
    setActivePanel("text");
    setPlayheadTime(clamp(start, 0, timelineDuration));
  };

  const selectLayer = (layer: TextToVideoTimelineLayer) => {
    setSelectedLayerId(layer.id);
    setSelectedCaptionId(null);
    setPlayheadTime(clamp(layer.start, 0, timelineDuration));
    setActivePanel(layer.type === "audio" ? "audio" : "media");
  };

  const scrubFromTrack = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.buttons !== 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = snapTime(((event.clientX - rect.left) / rect.width) * timelineDuration);
    setPlayheadTime(clamp(next, 0, timelineDuration));
  };

  const beginLayerDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    layer: TextToVideoTimelineLayer,
    action: DragState["action"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedLayerId(layer.id);
    setSelectedCaptionId(null);
    dragStateRef.current = {
      kind: "layer",
      action: action as "move" | "resize-start" | "resize-end",
      id: layer.id,
      startX: event.clientX,
      initialLayers: project.timeline_layers ?? [],
      draftLayers: project.timeline_layers ?? [],
    };
  };

  const beginSceneResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    scene: TextToVideoScene,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedSceneId(scene.id);
    setSelectedLayerId(null);
    dragStateRef.current = {
      kind: "scene",
      action: "resize-end",
      id: scene.id,
      startX: event.clientX,
      initialScenes: project.scenes,
      draftScenes: project.scenes,
    };
  };

  const handleTimelineDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    const deltaSeconds = snapTime((event.clientX - drag.startX) / pixelsPerSecond);
    if (drag.kind === "layer") {
      const draftLayers = drag.initialLayers.map((layer) => {
        if (layer.id !== drag.id) return layer;
        const initialStart = Number(layer.start) || 0;
        const initialDuration = Math.max(MIN_CLIP_SECONDS, Number(layer.duration) || MIN_CLIP_SECONDS);
        if (drag.action === "move") {
          return { ...layer, start: Math.max(0, snapTime(initialStart + deltaSeconds)) };
        }
        if (drag.action === "resize-start") {
          const end = initialStart + initialDuration;
          const start = clamp(snapTime(initialStart + deltaSeconds), 0, end - MIN_CLIP_SECONDS);
          return { ...layer, start, duration: snapTime(end - start) };
        }
        return { ...layer, duration: Math.max(MIN_CLIP_SECONDS, snapTime(initialDuration + deltaSeconds)) };
      });
      dragStateRef.current = { ...drag, draftLayers };
      updateProjectLocal({ timeline_layers: draftLayers });
      return;
    }

    const draftScenes = drag.initialScenes.map((scene) => {
      if (scene.id !== drag.id) return scene;
      const initialDuration = Math.max(MIN_CLIP_SECONDS, Number(scene.duration) || MIN_CLIP_SECONDS);
      return { ...scene, duration: Math.max(MIN_CLIP_SECONDS, snapTime(initialDuration + deltaSeconds)) };
    });
    dragStateRef.current = { ...drag, draftScenes };
    updateProjectLocal({
      scenes: draftScenes,
      total_duration: draftScenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0),
    });
  };

  const finishTimelineDrag = async () => {
    const drag = dragStateRef.current;
    if (!drag) return;
    dragStateRef.current = null;

    if (drag.kind === "layer") {
      await saveProjectPatch({ timeline_layers: drag.draftLayers }, "Timeline updated");
      return;
    }

    const totalDuration = drag.draftScenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0);
    await saveProjectPatch({ scenes: drag.draftScenes, total_duration: totalDuration }, "Scene timing saved");
  };

  const updateSelectedLayerLocal = (patch: Partial<TextToVideoTimelineLayer>) => {
    if (!selectedLayer) return;
    const timeline_layers = (project.timeline_layers ?? []).map((layer) =>
      layer.id === selectedLayer.id ? { ...layer, ...patch } : layer,
    );
    updateProjectLocal({ timeline_layers });
  };

  const commitSelectedLayer = async (patch: Partial<TextToVideoTimelineLayer>) => {
    if (!selectedLayer) return;
    await updateLayer(selectedLayer.id, patch);
  };

  const mediaKindFromFile = (file: File): TextToVideoTimelineLayer["type"] => {
    const mime = file.type.toLowerCase();
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("image/")) return "image";

    const name = file.name.toLowerCase();
    if (/\.(mp4|mov|webm|m4v)$/.test(name)) return "video";
    if (/\.(mp3|wav|m4a|ogg)$/.test(name)) return "audio";
    return "image";
  };

  const mediaKindFromUrl = (
    url: string,
    fallback: TextToVideoTimelineLayer["type"] = libraryMediaType,
  ): TextToVideoTimelineLayer["type"] => {
    const clean = url.split("?")[0].toLowerCase();
    if (/\.(mp4|mov|webm|m4v)$/.test(clean)) return "video";
    if (/\.(mp3|wav|m4a|ogg)$/.test(clean)) return "audio";
    if (/\.(jpg|jpeg|png|webp|gif)$/.test(clean)) return "image";
    return fallback;
  };

  const mediaKindFromLibraryItem = (item: LibraryItem): TextToVideoTimelineLayer["type"] => {
    if (isTimelineMediaType(item.type)) return item.type;
    if (item.video_url) return "video";
    if (item.image_url || item.webformatURL || item.preview_url || item.previewURL || item.thumb) return "image";
    return mediaKindFromUrl(mediaUrlFromLibraryItem(item), libraryMediaType);
  };

  const replacementTargetLabel = (target: ReplaceTarget | null) => {
    if (!target) return "timeline clip";
    if (target.kind === "layer") return `${target.mediaType} layer`;
    const scene = project.scenes.find((item) => item.id === target.id);
    return scene ? `Scene ${scene.index + 1}` : "scene";
  };

  const defaultReplaceTarget = (): ReplaceTarget | null => {
    if (selectedLayer) return { kind: "layer", id: selectedLayer.id, mediaType: selectedLayer.type };
    const sceneId = activeSceneItem?.scene.id ?? selectedSceneId ?? selectedScene?.id ?? project.scenes[0]?.id;
    return sceneId ? { kind: "scene", id: sceneId } : null;
  };

  const saveSceneMedia = async (
    sceneId: string,
    patch: Partial<TextToVideoScene>,
    successTitle: string,
  ) => {
    const scenes = project.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene));
    const total_duration = scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0);
    const thumbnail_url =
      typeof patch.image_url === "string" && patch.image_url
        ? patch.image_url
        : scenes.find((scene) => scene.image_url)?.image_url ?? project.thumbnail_url;

    updateProjectLocal({ scenes, total_duration, thumbnail_url });
    setSelectedSceneId(sceneId);
    setSelectedLayerId(null);
    await saveProjectPatch({ scenes, total_duration, thumbnail_url }, successTitle);
  };

  const addTimelineLayerFromMedia = async (
    mediaType: TextToVideoTimelineLayer["type"],
    url: string,
    targetSceneId?: string,
  ) => {
    const sceneItem = targetSceneId ? sceneTimeline.find(({ scene }) => scene.id === targetSceneId) : null;
    const layer: TextToVideoTimelineLayer = {
      id: makeId(),
      type: mediaType,
      url,
      start: sceneItem?.start ?? playheadTime,
      duration: Math.max(MIN_CLIP_SECONDS, sceneItem?.duration ?? 3),
      track: project.timeline_layers?.length ?? 0,
      volume: mediaType === "audio" ? 1 : 0,
      opacity: mediaType === "audio" ? 1 : 0.85,
      trim_start: 0,
      trim_end: 0,
    };
    const timeline_layers = [...(project.timeline_layers ?? []), layer];
    updateProjectLocal({ timeline_layers });
    setSelectedLayerId(layer.id);
    setSelectedSceneId(targetSceneId ?? selectedSceneId);
    await saveProjectPatch({ timeline_layers }, "Timeline layer added");
  };

  const applyMediaUrlToTarget = async (
    target: ReplaceTarget,
    url: string,
    mediaType: TextToVideoTimelineLayer["type"],
  ) => {
    if (!url) return;
    setReplacementError(null);

    if (target.kind === "scene") {
      const scene = project.scenes.find((item) => item.id === target.id);
      if (!scene) return;
      if (mediaType === "audio") {
        await addTimelineLayerFromMedia("audio", url, scene.id);
        setPendingReplaceTarget(null);
        return;
      }

      await saveSceneMedia(
        scene.id,
        mediaType === "video"
          ? { video_url: url, image_url: null }
          : { image_url: url, video_url: null },
        mediaType === "video" ? "Scene video replaced" : "Scene image replaced",
      );
      setPendingReplaceTarget(null);
      return;
    }

    setSelectedLayerId(target.id);
    await updateLayer(target.id, {
      type: mediaType,
      url,
      volume: mediaType === "audio" ? 1 : 0,
      opacity: mediaType === "audio" ? 1 : 0.85,
    });
    setPendingReplaceTarget(null);
  };

  const applyLibraryToTarget = async (item: LibraryItem, target: ReplaceTarget) => {
    const url = mediaUrlFromLibraryItem(item);
    if (!url) return;
    await applyMediaUrlToTarget(target, url, mediaKindFromLibraryItem(item));
  };

  const replaceFromFile = async (file: File, target: ReplaceTarget) => {
    const fallbackMediaType = mediaKindFromFile(file);
    setIsUploadingReplacement(true);
    setReplacementError(null);
    try {
      const { data, error } = await uploadProjectMedia(file, fallbackMediaType);
      if (error) throw new Error(error);
      const upload = data?.upload;
      const url = upload?.url;
      if (!url) throw new Error("Upload completed without a media URL.");
      const mediaType = isTimelineMediaType(upload.media_type) ? upload.media_type : fallbackMediaType;
      await applyMediaUrlToTarget(target, url, mediaType);
      setReplaceMenu(null);
    } catch (error) {
      setReplacementError(error instanceof Error ? error.message : "Media upload failed.");
    } finally {
      setIsUploadingReplacement(false);
    }
  };

  const openReplaceMenu = (event: ReactMouseEvent<HTMLDivElement>, target: ReplaceTarget) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 228;
    const menuHeight = 132;
    setReplacementError(null);
    setPendingReplaceTarget(target);
    setReplaceMenu({
      x: clamp(event.clientX, 8, window.innerWidth - menuWidth),
      y: clamp(event.clientY, 8, window.innerHeight - menuHeight),
      target,
    });
  };

  const openDeviceChooser = (target: ReplaceTarget) => {
    setPendingReplaceTarget(target);
    setReplacementError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const openCloudReplace = (target: ReplaceTarget) => {
    setPendingReplaceTarget(target);
    setReplacementError(null);
    setReplaceMenu(null);
    setShowAddLayer(false);
    setActivePanel("media");
    setLibraryMediaType(target.kind === "layer" && target.mediaType === "image" ? "image" : "video");
    if (target.kind === "scene") {
      setSelectedSceneId(target.id);
      setSelectedLayerId(null);
    } else {
      setSelectedLayerId(target.id);
    }
  };

  const handleDeviceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const target = pendingReplaceTarget ?? defaultReplaceTarget();
    if (!target) return;
    void replaceFromFile(file, target);
  };

  const handleCloudDragStart = (event: ReactDragEvent<HTMLButtonElement>, item: LibraryItem) => {
    const url = mediaUrlFromLibraryItem(item);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(item));
    if (url) {
      event.dataTransfer.setData("text/uri-list", url);
      event.dataTransfer.setData("text/plain", url);
    }
  };

  const handleLibraryItemClick = async (item: LibraryItem) => {
    if (pendingReplaceTarget) {
      await applyLibraryToTarget(item, pendingReplaceTarget);
      return;
    }
    await applyLibraryItemToScene(item);
  };

  const allowDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOverEditor(true);
  };

  const handleEditorDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files") && !event.dataTransfer.types.includes(LIBRARY_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOverEditor(true);
  };

  const handleEditorDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setIsDragOverEditor(false);
  };

  const handleEditorDrop = async (event: ReactDragEvent<HTMLElement>, explicitTarget?: ReplaceTarget) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOverEditor(false);
    const target = explicitTarget ?? defaultReplaceTarget();
    if (!target) return;

    const rawLibraryItem = event.dataTransfer.getData(LIBRARY_DRAG_MIME);
    if (rawLibraryItem) {
      try {
        await applyLibraryToTarget(JSON.parse(rawLibraryItem) as LibraryItem, target);
        setReplaceMenu(null);
      } catch {
        setReplacementError("Dropped media could not be applied.");
      }
      return;
    }

    const file = Array.from(event.dataTransfer.files).find((item) => item.type || item.name);
    if (file) {
      await replaceFromFile(file, target);
    }
  };

  const splitAtPlayhead = async () => {
    if (selectedLayer) {
      const clipStart = Number(selectedLayer.start) || 0;
      const clipEnd = clipStart + (Number(selectedLayer.duration) || 0);
      if (playheadTime <= clipStart + MIN_CLIP_SECONDS || playheadTime >= clipEnd - MIN_CLIP_SECONDS) return;

      const firstDuration = snapTime(playheadTime - clipStart);
      const secondDuration = snapTime(clipEnd - playheadTime);
      const secondLayer: TextToVideoTimelineLayer = {
        ...selectedLayer,
        id: makeId(),
        start: snapTime(playheadTime),
        duration: secondDuration,
        trim_start: snapTime((selectedLayer.trim_start || 0) + firstDuration),
      };
      const timeline_layers = (project.timeline_layers ?? [])
        .flatMap((layer) => (layer.id === selectedLayer.id ? [{ ...layer, duration: firstDuration }, secondLayer] : [layer]))
        .map((layer, index) => ({ ...layer, track: index }));
      updateProjectLocal({ timeline_layers });
      setSelectedLayerId(secondLayer.id);
      await saveProjectPatch({ timeline_layers }, "Layer split");
      return;
    }

    const active = sceneAtTime(sceneTimeline, playheadTime);
    if (!active) return;
    const localTime = snapTime(playheadTime - active.start);
    if (localTime <= MIN_CLIP_SECONDS || localTime >= active.duration - MIN_CLIP_SECONDS) return;

    const secondScene: TextToVideoScene = {
      ...active.scene,
      id: makeId(),
      duration: snapTime(active.duration - localTime),
      captions: (active.scene.captions ?? [])
        .filter((caption) => (Number(caption.start) || 0) >= localTime)
        .map((caption) => ({
          ...caption,
          id: makeId(),
          start: snapTime((Number(caption.start) || 0) - localTime),
          end: snapTime((Number(caption.end) || 0) - localTime),
        })),
    };
    const scenes = project.scenes
      .flatMap((scene) =>
        scene.id === active.scene.id
          ? [{ ...scene, duration: localTime, captions: (scene.captions ?? []).filter((caption) => (Number(caption.end) || 0) <= localTime) }, secondScene]
          : [scene],
      )
      .map((scene, index) => ({ ...scene, index }));
    const total_duration = scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0);
    updateProjectLocal({ scenes, total_duration });
    setSelectedSceneId(secondScene.id);
    await saveProjectPatch({ scenes, total_duration }, "Scene split");
  };

  const duplicateSelectedLayer = async () => {
    if (!selectedLayer) return;
    const copy = {
      ...selectedLayer,
      id: makeId(),
      start: snapTime(selectedLayer.start + 0.5),
      track: (project.timeline_layers ?? []).length,
    };
    const timeline_layers = [...(project.timeline_layers ?? []), copy];
    updateProjectLocal({ timeline_layers });
    setSelectedLayerId(copy.id);
    await saveProjectPatch({ timeline_layers }, "Layer duplicated");
  };

  const jumpBy = (seconds: number) => {
    setPlayheadTime((current) => clamp(snapTime(current + seconds), 0, timelineDuration));
  };

  const renderCaption = () => {
    if (!selectedCaption) return null;
    const displayText = captionStyle.uppercase ? selectedCaption.text.toUpperCase() : selectedCaption.text;
    const backgroundClass =
      captionStyle.background === "accent_box"
        ? "bg-yellow-400 text-black"
        : captionStyle.background === "dark_box"
          ? "bg-black/75 text-white"
          : "text-white";

    return (
      <button
        type="button"
        onClick={() => {
          const item = captionTimeline.find(({ caption }) => caption.id === selectedCaption.id);
          if (item) selectCaption(selectedCaption.id, item.start);
        }}
        className={`absolute left-1/2 max-w-[76%] -translate-x-1/2 rounded px-3 py-1.5 text-center font-semibold leading-tight shadow-lg outline outline-2 outline-transparent transition ${
          selectedCaptionId === selectedCaption.id ? "outline-white" : ""
        } ${captionPositionClass(captionStyle.position)} ${backgroundClass}`}
        style={{
          color: captionStyle.background === "accent_box" ? "#111111" : captionStyle.phrase_color,
          fontSize: clamp((captionStyle.size_phrase || 42) / 2.7, 14, 34),
          textShadow:
            captionStyle.background === "none"
              ? `0 2px ${Math.max(0, captionStyle.stroke_width || 0)}px rgba(0,0,0,0.8)`
              : undefined,
        }}
      >
        {displayText}
      </button>
    );
  };

  const panelItems: { id: EditorPanel; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: "text", label: "Text", icon: Type },
    { id: "scene", label: "Scene", icon: Wand2 },
    { id: "media", label: "Media", icon: ImagePlus },
    { id: "audio", label: "Audio", icon: Volume2 },
    { id: "settings", label: "Export", icon: Settings2 },
  ];

  return (
    <div
      className="relative flex h-screen min-h-[760px] overflow-hidden bg-[#111014] text-zinc-100"
      onDragOver={handleEditorDragOver}
      onDragLeave={handleEditorDragLeave}
      onDrop={(event) => void handleEditorDrop(event)}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="video/*,image/*,audio/*"
        onChange={handleDeviceFileChange}
      />

      {isDragOverEditor && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/35">
          <div className="rounded border border-white/20 bg-[#17161c]/95 px-5 py-3 text-sm font-medium text-white shadow-2xl">
            Drop media to replace the selected clip
          </div>
        </div>
      )}

      {replaceMenu && (
        <button
          type="button"
          aria-label="Close replacement menu"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          onClick={() => setReplaceMenu(null)}
        />
      )}

      {replaceMenu && (
        <div
          className="fixed z-50 w-56 rounded border border-white/10 bg-[#201f26] p-2 shadow-2xl"
          style={{ left: replaceMenu.x, top: replaceMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="mb-2 truncate px-2 text-xs text-zinc-400">{replacementTargetLabel(replaceMenu.target)}</p>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-60"
            disabled={isUploadingReplacement}
            onClick={() => openDeviceChooser(replaceMenu.target)}
          >
            <UploadCloud className="h-4 w-4 text-zinc-400" />
            Choose from device
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-60"
            disabled={isUploadingReplacement}
            onClick={() => openCloudReplace(replaceMenu.target)}
          >
            <Search className="h-4 w-4 text-zinc-400" />
            Search on cloud
          </button>
          {replacementError && <p className="mt-2 px-2 text-xs text-red-300">{replacementError}</p>}
        </div>
      )}

      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-white/10 bg-[#0c0b10] py-3">
        <Button variant="ghost" size="icon" className="mb-4 h-8 w-8 rounded-full bg-zinc-200 text-zinc-950 hover:bg-white">
          <Plus className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 flex-col items-center gap-2">
          {panelItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActivePanel(id)}
              className={`flex w-full flex-col items-center gap-1 border-l-2 px-1 py-2 text-[10px] transition ${
                activePanel === id
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-200"
              }`}
              title={label}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#15141a] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => history.back()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              value={project.title}
              onChange={(event) => updateProjectLocal({ title: event.target.value })}
              onBlur={() => void saveProjectPatch({ title: project.title, aspect: project.aspect }, "Project settings saved")}
              className="h-8 w-[min(420px,45vw)] border-white/10 bg-transparent text-sm font-semibold text-white"
            />
            <Badge className="border-white/10 bg-white/5 text-zinc-300" variant="outline">
              {project.aspect}
            </Badge>
            <span className="hidden text-xs text-zinc-500 md:inline">{project.scenes.length} scenes</span>
          </div>
          <div className="flex items-center gap-2">
            {activeVideoUrl && (
              <Button variant="ghost" size="sm" asChild className="text-zinc-300 hover:text-white">
                <a href={activeVideoUrl} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Open
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => void saveProjectPatch({ title: project.title, aspect: project.aspect }, "Project saved")} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
            <Button size="sm" onClick={() => void renderProject()} disabled={isRendering || isSaving} className="bg-white text-zinc-950 hover:bg-zinc-200">
              {isRendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Render
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            <section className="flex min-h-0 flex-1 items-center justify-center bg-[#1a191f] p-6">
              <div className="relative flex h-full max-h-[55vh] w-full max-w-5xl items-center justify-center overflow-hidden rounded border border-white/10 bg-[#242329] shadow-2xl">
                <div
                  className={`relative overflow-hidden bg-black ${
                    project.aspect === "9:16"
                      ? "h-full aspect-[9/16]"
                      : project.aspect === "1:1"
                        ? "h-[min(100%,680px)] aspect-square"
                        : "w-full max-w-4xl aspect-video"
                  }`}
                >
                  {previewVideoUrl ? (
                    <video
                      key={previewVideoUrl}
                      ref={videoRef}
                      src={previewVideoUrl}
                      className="h-full w-full object-cover"
                      playsInline
                      muted
                      preload="auto"
                    />
                  ) : previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt=""
                      className="video-editor-image-zoom h-full w-full object-cover"
                      style={{
                        objectPosition: `${50 + (previewScene?.crop_x ?? 0) / 2}% ${50 + (previewScene?.crop_y ?? 0) / 2}%`,
                        "--editor-image-scale": String(previewScene?.crop_zoom ?? 1),
                      } as CSSProperties}
                    />
                  ) : activeVideoUrl ? (
                    <video
                      key={activeVideoUrl}
                      ref={videoRef}
                      src={activeVideoUrl}
                      className="h-full w-full object-cover"
                      playsInline
                      muted
                      preload="auto"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">Preview</div>
                  )}

                  {renderCaption()}

                  {selectedLayer && selectedLayer.type !== "audio" && (
                    <div className="pointer-events-none absolute right-4 top-4 rounded bg-rose-500 px-2 py-1 text-xs font-semibold text-white">
                      {labelFromUrl(selectedLayer.url)}
                    </div>
                  )}
                </div>

                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded bg-black/40 px-2 py-1 backdrop-blur">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white" onClick={() => jumpBy(-1)}>
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white" onClick={() => setIsPlaying((value) => !value)}>
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white" onClick={() => jumpBy(1)}>
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="absolute bottom-4 right-4 h-8 w-8 text-zinc-300 hover:text-white">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </section>

            <section className="h-[286px] shrink-0 border-t border-white/10 bg-[#111014]">
              <div className="flex h-10 items-center justify-between border-b border-white/10 px-3">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 text-zinc-300 hover:text-white">
                    <MousePointer2 className="mr-2 h-4 w-4" />
                    Select
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-zinc-300 hover:text-white" onClick={() => void splitAtPlayhead()}>
                    <Scissors className="mr-2 h-4 w-4" />
                    Split
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-zinc-300 hover:text-white" onClick={() => setShowAddLayer((value) => !value)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Layer
                  </Button>
                  {selectedLayer && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-white" onClick={() => void duplicateSelectedLayer()}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-white" onClick={() => void removeLayer(selectedLayer.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-400">
                    {formatClock(playheadTime)} / {formatClock(timelineDuration)}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => setTimelineZoom((value) => Math.max(28, value - 12))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center text-[11px] text-zinc-500">{Math.round(timelineZoom)}px</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => setTimelineZoom((value) => Math.min(132, value + 12))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {renderJob && (
                <div className="border-b border-white/10 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{renderJob.message || renderJob.status}</span>
                    <Badge variant={renderJob.status === "failed" ? "destructive" : "outline"} className="border-white/10">
                      {renderJob.status}
                    </Badge>
                  </div>
                  <Progress value={renderJob.progress ?? (renderJob.status === "completed" ? 100 : 0)} className="h-1.5" />
                </div>
              )}

              {showAddLayer && (
                <div className="grid gap-2 border-b border-white/10 bg-[#17161c] p-2 md:grid-cols-[110px,1fr,88px,88px,auto]">
                  <Select value={newLayer.type} onValueChange={(value: TextToVideoTimelineLayer["type"]) => setNewLayer((previous) => ({ ...previous, type: value }))}>
                    <SelectTrigger className="h-8 border-white/10 bg-[#232229] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="h-8 border-white/10 bg-[#232229] text-xs" value={newLayer.url} onChange={(event) => setNewLayer((previous) => ({ ...previous, url: event.target.value }))} placeholder="Media URL or storage path" />
                  <Input className="h-8 border-white/10 bg-[#232229] text-xs" type="number" min={0} step={0.25} value={newLayer.start} onChange={(event) => setNewLayer((previous) => ({ ...previous, start: Number(event.target.value) || 0 }))} />
                  <Input className="h-8 border-white/10 bg-[#232229] text-xs" type="number" min={0.25} step={0.25} value={newLayer.duration} onChange={(event) => setNewLayer((previous) => ({ ...previous, duration: Number(event.target.value) || MIN_CLIP_SECONDS }))} />
                  <Button size="sm" className="h-8" onClick={() => void addLayer()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              )}

              <div className="h-[calc(100%-40px)] overflow-auto sidebar-scroll">
                <div className="relative" style={{ width: LABEL_COLUMN_WIDTH + timelineWidth }}>
                  <div
                    className="sticky top-0 z-30 grid h-8 border-b border-white/10 bg-[#111014]"
                    style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineWidth}px` }}
                  >
                    <div className="sticky left-0 z-40 border-r border-white/10 bg-[#111014]" />
                    <div
                      className="relative cursor-crosshair"
                      onPointerDown={scrubFromTrack}
                      onPointerMove={(event) => {
                        if (event.buttons === 1) scrubFromTrack(event);
                      }}
                    >
                      {timelineTicks.map((tick) => (
                        <div key={tick} className="absolute top-0 h-full border-l border-white/10 pl-1 text-[10px] text-zinc-500" style={{ left: tick * pixelsPerSecond }}>
                          {formatClock(tick)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="pointer-events-none absolute bottom-0 top-8 z-40 w-px bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.3)]"
                    style={{ left: LABEL_COLUMN_WIDTH + playheadLeft }}
                  >
                    <div className="-ml-2 h-3 w-4 rounded-b bg-white" />
                  </div>

                  <div className="space-y-1 p-2">
                    <div className="grid h-14" style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineWidth}px` }}>
                      <div className="sticky left-0 z-20 flex h-14 items-center gap-2 border-r border-white/10 bg-[#111014] pr-2 text-xs text-zinc-500">
                        <Film className="h-4 w-4" />
                        Video
                      </div>
                      <div
                        className="relative h-14 rounded border border-white/10 bg-[#1b1a20]"
                        onPointerDown={scrubFromTrack}
                        onPointerMove={(event) => {
                          if (event.buttons === 1) scrubFromTrack(event);
                        }}
                      >
                        {sceneTimeline.map(({ scene, start, duration }) => (
                          <TimelineClip
                            key={scene.id}
                            left={start * pixelsPerSecond}
                            width={duration * pixelsPerSecond}
                            selected={selectedSceneId === scene.id && !selectedLayer}
                            className="border-sky-400/40 bg-sky-500/20 text-sky-50"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              selectScene(scene.id);
                            }}
                            onDoubleClick={(event) => openReplaceMenu(event, { kind: "scene", id: scene.id })}
                            onDragOver={allowDrop}
                            onDrop={(event) => void handleEditorDrop(event, { kind: "scene", id: scene.id })}
                          >
                            {scene.image_url && (
                              <img
                                src={scene.image_url}
                                alt=""
                                className={`absolute inset-0 h-full w-full object-cover opacity-45 ${scene.video_url ? "" : "video-editor-image-zoom"}`}
                              />
                            )}
                            {scene.video_url && (
                              <div className="absolute right-1 top-1 z-20 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                <Video className="h-3 w-3" />
                                Video
                              </div>
                            )}
                            <div className="relative z-10 h-full px-2 py-1">
                              <p className="truncate font-semibold">Scene {scene.index + 1}</p>
                              <p className="text-[10px] text-sky-100/70">{formatSeconds(duration)}</p>
                            </div>
                            <div
                              className="absolute right-0 top-0 z-20 h-full w-2 cursor-ew-resize bg-white/20"
                              onPointerDown={(event) => beginSceneResize(event, scene)}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                              onPointerCancel={() => void finishTimelineDrag()}
                            />
                          </TimelineClip>
                        ))}
                      </div>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineWidth}px` }}>
                      <div className="sticky left-0 z-20 flex h-10 items-center gap-2 border-r border-white/10 bg-[#111014] pr-2 text-xs text-zinc-500">
                        <Type className="h-4 w-4" />
                        Text
                      </div>
                      <div className="relative h-10 rounded border border-white/10 bg-[#191820]" onPointerDown={scrubFromTrack}>
                        {captionTimeline.map(({ caption, start, end }) => (
                          <TimelineClip
                            key={caption.id}
                            left={start * pixelsPerSecond}
                            width={Math.max(MIN_CLIP_SECONDS, end - start) * pixelsPerSecond}
                            selected={selectedCaptionId === caption.id}
                            className="border-violet-300/50 bg-violet-500/70 text-white"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              selectCaption(caption.id, start);
                            }}
                          >
                            <div className="flex h-full items-center gap-1 px-2">
                              <Type className="h-3 w-3 shrink-0" />
                              <span className="truncate">{caption.text}</span>
                            </div>
                          </TimelineClip>
                        ))}
                      </div>
                    </div>

                    {(["video", "image"] as const).map((type) => (
                      <div key={type} className="grid" style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineWidth}px` }}>
                        <div className="sticky left-0 z-20 flex h-10 items-center gap-2 border-r border-white/10 bg-[#111014] pr-2 text-xs text-zinc-500">
                          {type === "video" ? <Video className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                          {type === "video" ? "Clips" : "Images"}
                        </div>
                        <div className="relative h-10 rounded border border-white/10 bg-[#191820]" onPointerDown={scrubFromTrack}>
                          {(project.timeline_layers ?? []).filter((layer) => layer.type === type).map((layer) => (
                            <TimelineClip
                              key={layer.id}
                              left={layer.start * pixelsPerSecond}
                              width={layer.duration * pixelsPerSecond}
                              selected={selectedLayerId === layer.id}
                              className="cursor-grab border-emerald-300/40 bg-emerald-500/70 text-white active:cursor-grabbing"
                              onPointerDown={(event) => beginLayerDrag(event, layer, "move")}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                              onDoubleClick={(event) => openReplaceMenu(event, { kind: "layer", id: layer.id, mediaType: layer.type })}
                              onDragOver={allowDrop}
                              onDrop={(event) => void handleEditorDrop(event, { kind: "layer", id: layer.id, mediaType: layer.type })}
                            >
                              <div className="flex h-full items-center gap-1 px-2">
                                <Layers className="h-3 w-3 shrink-0" />
                                <span className="truncate">{labelFromUrl(layer.url)}</span>
                              </div>
                              <div
                                className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                                onPointerDown={(event) => beginLayerDrag(event, layer, "resize-start")}
                                onPointerMove={handleTimelineDrag}
                                onPointerUp={() => void finishTimelineDrag()}
                              />
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                                onPointerDown={(event) => beginLayerDrag(event, layer, "resize-end")}
                                onPointerMove={handleTimelineDrag}
                                onPointerUp={() => void finishTimelineDrag()}
                              />
                            </TimelineClip>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="grid" style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineWidth}px` }}>
                      <div className="sticky left-0 z-20 flex h-10 items-center gap-2 border-r border-white/10 bg-[#111014] pr-2 text-xs text-zinc-500">
                        <Volume2 className="h-4 w-4" />
                        Audio
                      </div>
                      <div className="relative h-10 rounded border border-white/10 bg-[#191820]" onPointerDown={scrubFromTrack}>
                        {(project.timeline_layers ?? []).filter((layer) => layer.type === "audio").map((layer) => (
                          <TimelineClip
                            key={layer.id}
                            left={layer.start * pixelsPerSecond}
                            width={layer.duration * pixelsPerSecond}
                            selected={selectedLayerId === layer.id}
                            className="cursor-grab border-teal-200/40 bg-teal-500/80 text-white active:cursor-grabbing"
                            onPointerDown={(event) => beginLayerDrag(event, layer, "move")}
                            onPointerMove={handleTimelineDrag}
                            onPointerUp={() => void finishTimelineDrag()}
                            onDoubleClick={(event) => openReplaceMenu(event, { kind: "layer", id: layer.id, mediaType: layer.type })}
                            onDragOver={allowDrop}
                            onDrop={(event) => void handleEditorDrop(event, { kind: "layer", id: layer.id, mediaType: layer.type })}
                          >
                            <div className="absolute inset-x-2 top-1/2 h-5 -translate-y-1/2 opacity-80 [background:repeating-linear-gradient(90deg,rgba(255,255,255,.3)_0_2px,transparent_2px_7px)]" />
                            <div className="relative z-10 flex h-full items-center gap-1 px-2">
                              <Music2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{labelFromUrl(layer.url)}</span>
                            </div>
                            <div
                              className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                              onPointerDown={(event) => beginLayerDrag(event, layer, "resize-start")}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                            />
                            <div
                              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                              onPointerDown={(event) => beginLayerDrag(event, layer, "resize-end")}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                            />
                          </TimelineClip>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>

          <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-white/10 bg-[#17161c] sidebar-scroll">
            <div className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-white/10 bg-[#17161c] px-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <PanelRight className="h-4 w-4 text-zinc-400" />
                {panelItems.find((item) => item.id === activePanel)?.label}
              </div>
              {selectedLayer && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => void removeLayer(selectedLayer.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-5 p-4">
              {selectedLayer && (
                <div className="space-y-3 rounded border border-white/10 bg-[#201f26] p-3">
                  <div>
                    <p className="text-sm font-semibold capitalize">{selectedLayer.type} layer</p>
                    <p className="truncate text-xs text-zinc-500">{labelFromUrl(selectedLayer.url)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Source</Label>
                    <Input
                      className="h-9 border-white/10 bg-[#15141a]"
                      value={selectedLayer.url}
                      onChange={(event) => updateSelectedLayerLocal({ url: event.target.value })}
                      onBlur={(event) => void commitSelectedLayer({ url: event.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Start</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#15141a]"
                        type="number"
                        step={0.05}
                        value={selectedLayer.start}
                        onChange={(event) => updateSelectedLayerLocal({ start: Math.max(0, Number(event.target.value) || 0) })}
                        onBlur={(event) => void commitSelectedLayer({ start: Math.max(0, Number(event.target.value) || 0) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Duration</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#15141a]"
                        type="number"
                        step={0.05}
                        value={selectedLayer.duration}
                        onChange={(event) => updateSelectedLayerLocal({ duration: Math.max(MIN_CLIP_SECONDS, Number(event.target.value) || MIN_CLIP_SECONDS) })}
                        onBlur={(event) => void commitSelectedLayer({ duration: Math.max(MIN_CLIP_SECONDS, Number(event.target.value) || MIN_CLIP_SECONDS) })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Volume</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#15141a]"
                        type="number"
                        step={0.05}
                        disabled={selectedLayer.type !== "audio"}
                        value={selectedLayer.volume}
                        onChange={(event) => updateSelectedLayerLocal({ volume: clamp(Number(event.target.value) || 0, 0, 2) })}
                        onBlur={(event) => void commitSelectedLayer({ volume: clamp(Number(event.target.value) || 0, 0, 2) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Opacity</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#15141a]"
                        type="number"
                        step={0.05}
                        disabled={selectedLayer.type === "audio"}
                        value={selectedLayer.opacity}
                        onChange={(event) => updateSelectedLayerLocal({ opacity: clamp(Number(event.target.value) || 0, 0, 1) })}
                        onBlur={(event) => void commitSelectedLayer({ opacity: clamp(Number(event.target.value) || 0, 0, 1) })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activePanel === "text" && (
                <div className="space-y-4">
                  {selectedCaption && previewScene ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-400">Text</Label>
                        <Textarea
                          rows={4}
                          className="border-white/10 bg-[#201f26]"
                          value={selectedCaption.text}
                          onChange={(event) => updateCaptionLocal(previewScene.id, selectedCaption.id, { text: event.target.value })}
                          onBlur={() => void saveScenes("Captions saved")}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs text-zinc-400">Start</Label>
                          <Input
                            className="h-9 border-white/10 bg-[#201f26]"
                            type="number"
                            step="0.05"
                            value={selectedCaption.start}
                            onChange={(event) => updateCaptionLocal(previewScene.id, selectedCaption.id, { start: Number(event.target.value) || 0 })}
                            onBlur={() => void saveScenes("Caption timing saved")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-zinc-400">End</Label>
                          <Input
                            className="h-9 border-white/10 bg-[#201f26]"
                            type="number"
                            step="0.05"
                            value={selectedCaption.end}
                            onChange={(event) => updateCaptionLocal(previewScene.id, selectedCaption.id, { end: Number(event.target.value) || 0 })}
                            onBlur={() => void saveScenes("Caption timing saved")}
                          />
                        </div>
                      </div>
                      <Separator className="bg-white/10" />
                    </>
                  ) : (
                    <div className="rounded border border-dashed border-white/10 p-4 text-sm text-zinc-500">Select a caption on the timeline.</div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Preset</Label>
                      <Select value={captionStyle.preset} onValueChange={(value) => void updateCaptionStyle({ preset: value })}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{CAPTION_PRESETS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Font</Label>
                      <Select value={captionStyle.font} onValueChange={(value) => void updateCaptionStyle({ font: value })}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{CAPTION_FONTS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Position</Label>
                      <Select value={captionStyle.position} onValueChange={(value) => void updateCaptionStyle({ position: value })}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{CAPTION_POSITIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Animation</Label>
                      <Select value={captionStyle.animation} onValueChange={(value) => void updateCaptionStyle({ animation: value })}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{CAPTION_ANIMATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Color</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26] p-1"
                        type="color"
                        value={captionStyle.phrase_color}
                        onChange={(event) => updateProjectLocal({ caption_style: { ...captionStyle, phrase_color: event.target.value } })}
                        onBlur={() => void saveProjectPatch({ caption_style: captionStyle }, "Caption color saved")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Active</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26] p-1"
                        type="color"
                        value={captionStyle.active_color}
                        onChange={(event) => updateProjectLocal({ caption_style: { ...captionStyle, active_color: event.target.value } })}
                        onBlur={() => void saveProjectPatch({ caption_style: captionStyle }, "Caption color saved")}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Text Size</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26]"
                        type="number"
                        value={captionStyle.size_phrase}
                        onChange={(event) => updateProjectLocal({ caption_style: { ...captionStyle, size_phrase: Number(event.target.value) || 0 } })}
                        onBlur={() => void saveProjectPatch({ caption_style: captionStyle }, "Caption size saved")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Stroke</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26]"
                        type="number"
                        value={captionStyle.stroke_width}
                        onChange={(event) => updateProjectLocal({ caption_style: { ...captionStyle, stroke_width: Number(event.target.value) || 0 } })}
                        onBlur={() => void saveProjectPatch({ caption_style: captionStyle }, "Caption stroke saved")}
                      />
                    </div>
                  </div>
                  <Select value={captionStyle.background} onValueChange={(value) => void updateCaptionStyle({ background: value })}>
                    <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                    <SelectContent>{CAPTION_BACKGROUNDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
                    <label className="flex items-center gap-2"><Switch checked={captionStyle.uppercase} onCheckedChange={(checked) => void updateCaptionStyle({ uppercase: checked })} />Uppercase</label>
                    <label className="flex items-center gap-2"><Switch checked={captionStyle.show_phrase} onCheckedChange={(checked) => void updateCaptionStyle({ show_phrase: checked })} />Phrase</label>
                  </div>
                </div>
              )}

              {activePanel === "scene" && selectedScene && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Scene script</Label>
                    <Textarea rows={5} className="border-white/10 bg-[#201f26]" value={selectedScene.script} onChange={(event) => updateSceneLocal(selectedScene.id, { script: event.target.value })} onBlur={() => void saveScenes("Scene saved")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Duration</Label>
                      <Input className="h-9 border-white/10 bg-[#201f26]" type="number" min={MIN_CLIP_SECONDS} step={0.05} value={selectedScene.duration} onChange={(event) => updateSceneLocal(selectedScene.id, { duration: Math.max(MIN_CLIP_SECONDS, Number(event.target.value) || MIN_CLIP_SECONDS) })} onBlur={() => void saveScenes("Scene timing saved")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Speaker</Label>
                      <Select value={selectedScene.speaker ?? "primary"} onValueChange={(value) => updateSceneLocal(selectedScene.id, { speaker: value })}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{["primary", "speaker2", "speaker3", "speaker4"].map((speaker) => <SelectItem key={speaker} value={speaker}>{speaker}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Animation</Label>
                      <Select value={selectedScene.animation ?? "ken_burns_in"} onValueChange={(value) => updateSceneLocal(selectedScene.id, { animation: value })}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{ANIMATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Transition</Label>
                      <Select value={selectedScene.transition_in ?? "fade"} onValueChange={(value) => updateSceneLocal(selectedScene.id, { transition_in: value })}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{TRANSITIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs text-zinc-400">Crop X</Label>
                    <Slider value={[selectedScene.crop_x ?? 0]} min={-100} max={100} step={1} onValueChange={([value]) => updateSceneLocal(selectedScene.id, { crop_x: value })} onValueCommit={() => void saveScenes("Crop saved")} />
                    <Label className="text-xs text-zinc-400">Crop Y</Label>
                    <Slider value={[selectedScene.crop_y ?? 0]} min={-100} max={100} step={1} onValueChange={([value]) => updateSceneLocal(selectedScene.id, { crop_y: value })} onValueCommit={() => void saveScenes("Crop saved")} />
                    <Label className="text-xs text-zinc-400">Zoom</Label>
                    <Slider value={[selectedScene.crop_zoom ?? 1]} min={1} max={2.5} step={0.05} onValueChange={([value]) => updateSceneLocal(selectedScene.id, { crop_zoom: value })} onValueCommit={() => void saveScenes("Crop saved")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {EFFECTS.map((effect) => {
                      const checked = (selectedScene.effects ?? []).includes(effect);
                      return (
                        <label key={effect} className="flex items-center gap-2 rounded border border-white/10 bg-[#201f26] px-2 py-2 text-xs">
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
                  <Button className="w-full" onClick={() => void saveScenes()} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Scene
                  </Button>
                </div>
              )}

              {activePanel === "media" && selectedScene && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Image URL</Label>
                    <Input className="h-9 border-white/10 bg-[#201f26]" value={selectedScene.image_url ?? ""} onChange={(event) => updateSceneLocal(selectedScene.id, { image_url: event.target.value })} onBlur={() => void saveScenes("Scene media saved")} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Video URL</Label>
                    <Input className="h-9 border-white/10 bg-[#201f26]" value={selectedScene.video_url ?? ""} onChange={(event) => updateSceneLocal(selectedScene.id, { video_url: event.target.value })} onBlur={() => void saveScenes("Scene media saved")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["image", "video"] as const).map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant={libraryMediaType === type ? "default" : "outline"}
                        className={`h-8 capitalize ${libraryMediaType === type ? "" : "border-white/10 bg-[#201f26]"}`}
                        onClick={() => setLibraryMediaType(type)}
                      >
                        {type === "image" ? <ImagePlus className="mr-2 h-4 w-4" /> : <Video className="mr-2 h-4 w-4" />}
                        {type}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input className="h-9 border-white/10 bg-[#201f26]" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder={`Search Pixabay ${libraryMediaType}s`} onKeyDown={(event) => { if (event.key === "Enter") void searchLibrary(libraryMediaType); }} />
                    <Button size="icon" className="h-9 w-9" onClick={() => void searchLibrary(libraryMediaType)} disabled={isSearchingLibrary}>
                      {isSearchingLibrary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {pendingReplaceTarget && (
                    <div className="rounded border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                      Replacing {replacementTargetLabel(pendingReplaceTarget)}
                    </div>
                  )}
                  {replacementError && !replaceMenu && (
                    <div className="rounded border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                      {replacementError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {libraryItems.map((item, index) => {
                      const url = mediaUrlFromLibraryItem(item);
                      const thumb = thumbnailUrlFromLibraryItem(item);
                      const isVideoResult = isLibraryVideoItem(item);
                      return (
                        <button
                          key={`${item.id ?? index}`}
                          type="button"
                          draggable
                          onDragStart={(event) => handleCloudDragStart(event, item)}
                          onClick={() => void handleLibraryItemClick(item)}
                          className="overflow-hidden rounded border border-white/10 bg-[#201f26] text-left"
                        >
                          {isVideoResult && url ? (
                            <video src={url} poster={thumb || undefined} className="aspect-video w-full object-cover" muted playsInline />
                          ) : thumb ? (
                            <img src={thumb} alt="" className="aspect-video w-full object-cover" />
                          ) : url ? (
                            <img src={url} alt="" className="aspect-video w-full object-cover" />
                          ) : (
                            <div className="aspect-video bg-zinc-800" />
                          )}
                          <div className="flex items-center justify-between gap-2 px-2 py-1">
                            <p className="truncate text-[11px] text-zinc-400">{item.title || item.tags || "Media item"}</p>
                            <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-zinc-300">{item.type || libraryMediaType}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <Separator className="bg-white/10" />
                  <Button variant="outline" className="w-full border-white/10 bg-[#201f26]" onClick={() => setShowAddLayer(true)}>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Add Overlay Layer
                  </Button>
                </div>
              )}

              {activePanel === "audio" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Music URL</Label>
                    <Input className="h-9 border-white/10 bg-[#201f26]" value={project.music_url ?? ""} onChange={(event) => updateProjectLocal({ music_url: event.target.value })} onBlur={(event) => void saveProjectPatch({ music_url: event.target.value }, "Music saved")} />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-white/10 bg-[#201f26]"
                    onClick={() => {
                      setNewLayer((previous) => ({ ...previous, type: "audio", start: playheadTime }));
                      setShowAddLayer(true);
                    }}
                  >
                    <Mic2 className="mr-2 h-4 w-4" />
                    Add Audio Layer
                  </Button>
                  <div className="space-y-2">
                    {(project.timeline_layers ?? []).filter((layer) => layer.type === "audio").map((layer) => (
                      <button key={layer.id} type="button" onClick={() => selectLayer(layer)} className={`w-full rounded border px-3 py-2 text-left text-sm ${selectedLayerId === layer.id ? "border-teal-300 bg-teal-500/20" : "border-white/10 bg-[#201f26]"}`}>
                        <p className="truncate">{labelFromUrl(layer.url)}</p>
                        <p className="text-xs text-zinc-500">{formatSeconds(layer.start)} - {formatSeconds(layer.duration)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activePanel === "settings" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {TEXT_TO_VIDEO_ASPECTS.map((aspect: TextToVideoAspect) => (
                      <button
                        key={aspect}
                        type="button"
                        onClick={() => updateProjectLocal({ aspect })}
                        className={`rounded border px-2 py-3 text-center text-xs ${project.aspect === aspect ? "border-white bg-white text-zinc-950" : "border-white/10 bg-[#201f26] text-zinc-300"}`}
                      >
                        {aspect}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">FPS</Label>
                      <Select value={String(renderSettings.fps)} onValueChange={(value) => setRenderSettings((previous) => ({ ...previous, fps: Number(value) }))}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{[20, 24, 30, 48, 60, 90].map((fps) => <SelectItem key={fps} value={String(fps)}>{fps} fps</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Format</Label>
                      <Select value={renderSettings.outFormat} onValueChange={(value) => setRenderSettings((previous) => ({ ...previous, outFormat: value }))}>
                        <SelectTrigger className="h-9 border-white/10 bg-[#201f26]"><SelectValue /></SelectTrigger>
                        <SelectContent>{["mp4", "webm", "mov", "gif"].map((format) => <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded border border-white/10 bg-[#201f26] p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Duration</span>
                      <span className="font-mono">{formatClock(timelineDuration)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-zinc-400">Status</span>
                      <Badge className="border-white/10" variant="outline">{project.status}</Badge>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => void saveProjectPatch({ title: project.title, aspect: project.aspect, scenes: project.scenes, caption_style: project.caption_style, timeline_layers: project.timeline_layers, total_duration: project.total_duration }, "Project saved")} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Project
                  </Button>
                  <Button className="w-full bg-white text-zinc-950 hover:bg-zinc-200" onClick={() => void renderProject()} disabled={isRendering || isSaving}>
                    {isRendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Render Video
                  </Button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};
