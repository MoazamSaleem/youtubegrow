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
  type WheelEvent as ReactWheelEvent,
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
  Redo2,
  Undo2,
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
  type TextToVideoMusicTimeline,
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
  updateCaptionStyleLocal: (patch: Partial<TextToVideoCaptionStyle>) => void;
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
  canUndo: boolean;
  canRedo: boolean;
  undoProject: () => Promise<void>;
  redoProject: () => Promise<void>;
  recordProjectSnapshot: () => void;
}

const EFFECTS = ["shake", "rgb_split", "glitch", "blur_reveal", "vignette", "film_burn", "flash", "speed_ramp"];
const ANIMATIONS = ["ken_burns_in", "ken_burns_out", "punch_in", "slow_pan", "none"];
const TRANSITIONS = ["fade", "flash", "zoom", "swipe"];
const CAPTION_PRESETS = ["viral_pop", "hormozi", "mrbeast", "minimal", "subtitle"];
const CAPTION_FONTS = ["bold_sans", "display", "narrow", "mono", "serif"];
const CAPTION_POSITIONS = ["top", "middle", "bottom", "custom"];
const CAPTION_BACKGROUNDS = ["none", "accent_box", "dark_box"];
const CAPTION_ANIMATIONS = ["pop", "fade", "slide", "none"];
const CAPTION_STYLE_PRESETS: Record<string, Partial<TextToVideoCaptionStyle>> = {
  viral_pop: {
    preset: "viral_pop",
    font: "display",
    active_color: "#FFD60A",
    phrase_color: "#FFFFFF",
    phrase_opacity: 0.55,
    position: "bottom",
    position_x: 50,
    position_y: 72,
    box_width: 76,
    box_height: 16,
    border_enabled: false,
    border_color: "#FFFFFF",
    border_width: 2,
    size_active: 96,
    size_phrase: 42,
    stroke_width: 6,
    background: "none",
    uppercase: true,
    animation: "pop",
    show_phrase: true,
  },
  hormozi: {
    preset: "hormozi",
    font: "display",
    active_color: "#FFFFFF",
    phrase_color: "#FFD60A",
    phrase_opacity: 0.55,
    position: "middle",
    position_x: 50,
    position_y: 52,
    box_width: 82,
    box_height: 20,
    border_enabled: false,
    border_color: "#FFFFFF",
    border_width: 2,
    size_active: 110,
    size_phrase: 56,
    stroke_width: 10,
    background: "dark_box",
    uppercase: true,
    animation: "pop",
    show_phrase: false,
  },
  mrbeast: {
    preset: "mrbeast",
    font: "display",
    active_color: "#FF3B30",
    phrase_color: "#FFFFFF",
    phrase_opacity: 0.55,
    position: "middle",
    position_x: 50,
    position_y: 52,
    box_width: 84,
    box_height: 22,
    border_enabled: false,
    border_color: "#FFFFFF",
    border_width: 2,
    size_active: 120,
    size_phrase: 48,
    stroke_width: 12,
    background: "accent_box",
    uppercase: true,
    animation: "pop",
    show_phrase: false,
  },
  minimal: {
    preset: "minimal",
    font: "bold_sans",
    active_color: "#FFFFFF",
    phrase_color: "#FFFFFF",
    phrase_opacity: 0.55,
    position: "bottom",
    position_x: 50,
    position_y: 76,
    box_width: 70,
    box_height: 14,
    border_enabled: false,
    border_color: "#FFFFFF",
    border_width: 2,
    size_active: 72,
    size_phrase: 36,
    stroke_width: 4,
    background: "none",
    uppercase: false,
    animation: "fade",
    show_phrase: false,
  },
  subtitle: {
    preset: "subtitle",
    font: "bold_sans",
    active_color: "#FFFFFF",
    phrase_color: "#FFFFFF",
    phrase_opacity: 0.55,
    position: "bottom",
    position_x: 50,
    position_y: 84,
    box_width: 92,
    box_height: 10,
    border_enabled: false,
    border_color: "#FFFFFF",
    border_width: 2,
    size_active: 54,
    size_phrase: 0,
    stroke_width: 3,
    background: "dark_box",
    uppercase: false,
    animation: "none",
    show_phrase: false,
  },
};
const CAPTION_FONT_STYLES: Record<string, CSSProperties> = {
  bold_sans: { fontFamily: "Inter, Arial, sans-serif" },
  display: { fontFamily: "'Arial Black', Impact, sans-serif" },
  narrow: { fontFamily: "'Arial Narrow', 'Roboto Condensed', Arial, sans-serif" },
  mono: { fontFamily: "'Courier New', monospace" },
  serif: { fontFamily: "Georgia, 'Times New Roman', serif" },
};
const LABEL_COLUMN_WIDTH = 124;
const MIN_CLIP_SECONDS = 0.25;
const MIN_TIMELINE_ZOOM = -200;
const MAX_TIMELINE_ZOOM = 500;
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

const effectiveTimelineZoom = (value: number) => {
  if (value <= 0) return 24 * Math.pow(2, value / 200);
  return value;
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
    isLocal: looksLocal,
  };
};

const captionPresetCoordinates = (position: string) => {
  if (position === "top") return { x: 50, y: 22 };
  if (position === "middle") return { x: 50, y: 52 };
  return { x: 50, y: 72 };
};

const captionCoordinates = (style: TextToVideoCaptionStyle) => {
  if (style.position === "custom") {
    return {
      x: clamp(Number(style.position_x) || 50, 5, 95),
      y: clamp(Number(style.position_y) || 72, 5, 95),
    };
  }
  return captionPresetCoordinates(style.position);
};

const captionBoxSize = (style: TextToVideoCaptionStyle) => ({
  width: clamp(Number(style.box_width) || 76, 12, 95),
  height: clamp(Number(style.box_height) || 16, 6, 60),
});

type CaptionInteraction =
  | {
      mode: "move";
      pointerId: number;
      offsetX: number;
      offsetY: number;
      patch: Partial<TextToVideoCaptionStyle>;
    }
  | {
      mode: "resize";
      pointerId: number;
      startX: number;
      startY: number;
      startBoxWidth: number;
      startBoxHeight: number;
      patch: Partial<TextToVideoCaptionStyle>;
    };

type DragState =
  | {
      kind: "layer";
      action: "move" | "resize-start" | "resize-end";
      id: string;
      selectedIds: string[];
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
    }
  | {
      kind: "caption";
      action: "move" | "resize-start" | "resize-end";
      sceneId: string;
      captionId: string;
      selectedIds: string[];
      selectedCaptions: Array<{
        sceneId: string;
        captionId: string;
        initialStart: number;
        initialEnd: number;
        sceneStart: number;
        sceneDuration: number;
        isLocal: boolean;
      }>;
      startX: number;
      initialStart: number;
      initialEnd: number;
      sceneStart: number;
      sceneDuration: number;
      isLocal: boolean;
      initialScenes: TextToVideoScene[];
      draftScenes: TextToVideoScene[];
    }
  | {
      kind: "music";
      action: "move" | "resize-start" | "resize-end";
      startX: number;
      initialTimeline: TextToVideoMusicTimeline;
      draftTimeline: TextToVideoMusicTimeline;
    };

type MarqueeState = {
  kind: "caption" | "layer";
  layerType?: TextToVideoTimelineLayer["type"];
  pointerId: number;
  startX: number;
  currentX: number;
  additive: boolean;
  initialCaptionIds: string[];
  initialLayerIds: string[];
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
  updateCaptionStyleLocal,
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
  canUndo,
  canRedo,
  undoProject,
  redoProject,
  recordProjectSnapshot,
}: VideoEditorWorkspaceProps) => {
  const [activePanel, setActivePanel] = useState<EditorPanel>("text");
  const [playheadTime, setPlayheadTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [selectedCaptionIds, setSelectedCaptionIds] = useState<string[]>([]);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
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
  const captionInteractionRef = useRef<CaptionInteraction | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const playheadTimeRef = useRef(0);
  const timelineZoomRef = useRef(timelineZoom);

  const timelineDuration = useMemo(() => {
    const layerEnd = Math.max(
      0,
      ...((project.timeline_layers ?? []).map((layer) => (Number(layer.start) || 0) + (Number(layer.duration) || 0))),
    );
    const baseDuration = Number(project.total_duration) || 0;
    const musicTimeline = project.music_timeline ?? { start: 0, duration: 0 };
    const musicStart = Number(musicTimeline.start) || 0;
    const musicEnd = project.music_url
      ? musicStart + (Number(musicTimeline.duration) || Math.max(0, baseDuration - musicStart))
      : 0;
    return Math.max(1, baseDuration, layerEnd, musicEnd);
  }, [project.music_timeline, project.music_url, project.timeline_layers, project.total_duration]);

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

  const timelineScale = effectiveTimelineZoom(timelineZoom);
  const timelineWidth = Math.max(920, Math.ceil(timelineDuration * timelineScale));
  const pixelsPerSecond = timelineWidth / Math.max(timelineDuration, 0.1);
  const playheadLeft = playheadTime * pixelsPerSecond;

  const captionTimeline = useMemo(
    () =>
      sceneTimeline.flatMap(({ scene, start, duration }) =>
        (scene.captions ?? []).map((caption) => {
          const bounds = captionBounds(caption, start, duration);
          return { scene, caption, sceneStart: start, sceneDuration: duration, ...bounds };
        }),
      ),
    [sceneTimeline],
  );

  const activeSceneItem = sceneAtTime(sceneTimeline, playheadTime);
  const previewScene = activeSceneItem?.scene ?? selectedScene ?? project.scenes[0] ?? null;
  const selectedCaptionItem =
    captionTimeline.find((item) => item.caption.id === selectedCaptionId && playheadTime >= item.start && playheadTime <= item.end) ??
    captionTimeline.find((item) => playheadTime >= item.start && playheadTime <= item.end) ??
    null;
  const selectedCaption = selectedCaptionItem?.caption ?? null;
  const activeLayers = (project.timeline_layers ?? []).filter(
    (layer) => playheadTime >= layer.start && playheadTime <= layer.start + layer.duration,
  );
  const activeVisualLayer =
    activeLayers.find((layer) => layer.type === "video") ?? activeLayers.find((layer) => layer.type === "image") ?? null;
  const previewVideoUrl = activeVisualLayer?.type === "video" ? activeVisualLayer.url : previewScene?.video_url ?? null;
  const previewVideoStart = activeVisualLayer?.type === "video" ? activeVisualLayer.start : activeSceneItem?.start ?? 0;
  const previewVideoTrimStart = activeVisualLayer?.type === "video" ? activeVisualLayer.trim_start : 0;
  const previewImageUrl = activeVisualLayer?.type === "image" ? activeVisualLayer.url : previewScene?.image_url ?? null;
  const captionStyle = project.caption_style;
  const musicTimeline = project.music_timeline ?? { start: 0, duration: 0, trim_start: 0, trim_end: 0 };
  const musicStart = clamp(Number(musicTimeline.start) || 0, 0, timelineDuration);
  const musicDuration = Math.max(
    MIN_CLIP_SECONDS,
    Number(musicTimeline.duration) || Math.max(MIN_CLIP_SECONDS, timelineDuration - musicStart),
  );
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
    if (
      project.music_url &&
      isPlayableBrowserUrl(project.music_url) &&
      playheadTime >= musicStart &&
      playheadTime <= musicStart + musicDuration
    ) {
      sources.push({
        id: "project-music",
        url: project.music_url,
        start: musicStart,
        trimStart: Number(musicTimeline.trim_start) || 0,
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
  }, [activeLayers, activeSceneItem, musicDuration, musicStart, musicTimeline.trim_start, playheadTime, previewScene, project.music_url]);

  useEffect(() => {
    setPlayheadTime((value) => clamp(value, 0, timelineDuration));
  }, [timelineDuration]);

  useEffect(() => {
    playheadTimeRef.current = playheadTime;
  }, [playheadTime]);

  useEffect(() => {
    timelineZoomRef.current = timelineZoom;
  }, [timelineZoom]);

  useEffect(() => {
    if (!isPlaying) return;
    const startedAt = performance.now();
    const startedTime = playheadTimeRef.current;
    let lastCommit = 0;
    let frameId = 0;

    const tick = (now: number) => {
      const next = startedTime + (now - startedAt) / 1000;
      if (next >= timelineDuration) {
        playheadTimeRef.current = timelineDuration;
        setPlayheadTime(timelineDuration);
        setIsPlaying(false);
        return;
      }

      playheadTimeRef.current = next;
      if (now - lastCommit > 80) {
        setPlayheadTime(snapTime(next));
        lastCommit = now;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
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
    const drift = Math.abs(video.currentTime - targetTime);
    const seekThreshold = isPlaying ? 1.25 : 0.08;
    if (Number.isFinite(video.duration) && drift > seekThreshold) {
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
      if (Math.abs(audio.currentTime - targetTime) > (isPlaying ? 1.25 : 0.12)) {
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
    setSelectedLayerIds([]);
    setSelectedCaptionIds([]);
    setActivePanel("scene");
    if (item) setPlayheadTime(item.start);
  };

  const selectionMode = (event: Pick<ReactPointerEvent, "ctrlKey" | "metaKey" | "shiftKey">) =>
    event.ctrlKey || event.metaKey || event.shiftKey ? "toggle" : "single";

  const selectCaption = (captionId: string, start: number, mode: "single" | "toggle" = "single") => {
    setSelectedCaptionId(captionId);
    setSelectedLayerId(null);
    setSelectedLayerIds([]);
    setSelectedCaptionIds((previous) => {
      if (mode === "toggle") {
        const exists = previous.includes(captionId);
        const next = exists ? previous.filter((id) => id !== captionId) : [...previous, captionId];
        return next.length ? next : [captionId];
      }
      return [captionId];
    });
    setActivePanel("text");
    setPlayheadTime(clamp(start, 0, timelineDuration));
  };

  const selectLayer = (layer: TextToVideoTimelineLayer, mode: "single" | "toggle" = "single") => {
    setSelectedLayerId(layer.id);
    setSelectedCaptionId(null);
    setSelectedCaptionIds([]);
    setSelectedLayerIds((previous) => {
      if (mode === "toggle") {
        const exists = previous.includes(layer.id);
        const next = exists ? previous.filter((id) => id !== layer.id) : [...previous, layer.id];
        return next.length ? next : [layer.id];
      }
      return [layer.id];
    });
    setPlayheadTime(clamp(layer.start, 0, timelineDuration));
    setActivePanel(layer.type === "audio" ? "audio" : "media");
  };

  const setTimelineZoomAround = (nextZoom: number, anchorClientX?: number) => {
    const scroll = timelineScrollRef.current;
    const clampedZoom = clamp(nextZoom, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM);
    if (clampedZoom === timelineZoom) return;

    const rect = scroll?.getBoundingClientRect();
    const hasCursorAnchor = Boolean(rect && typeof anchorClientX === "number");
    const anchorOffset = hasCursorAnchor && rect && typeof anchorClientX === "number"
      ? anchorClientX - rect.left
      : scroll
        ? scroll.clientWidth / 2
        : LABEL_COLUMN_WIDTH;
    const anchorContentX = hasCursorAnchor && scroll
      ? Math.max(0, scroll.scrollLeft + anchorOffset - LABEL_COLUMN_WIDTH)
      : playheadTime * pixelsPerSecond;
    const anchorTime = hasCursorAnchor
      ? clamp(anchorContentX / Math.max(pixelsPerSecond, 0.1), 0, timelineDuration)
      : playheadTime;

    setTimelineZoom(clampedZoom);
    window.requestAnimationFrame(() => {
      const nextTimelineWidth = Math.max(920, Math.ceil(timelineDuration * effectiveTimelineZoom(clampedZoom)));
      const nextPixelsPerSecond = nextTimelineWidth / Math.max(timelineDuration, 0.1);
      const nextContentX = LABEL_COLUMN_WIDTH + anchorTime * nextPixelsPerSecond;
      if (scroll) scroll.scrollLeft = Math.max(0, nextContentX - anchorOffset);
    });
  };

  const zoomTimelineBy = (delta: number, anchorClientX?: number) => {
    setTimelineZoomAround(timelineZoom + delta, anchorClientX);
  };

  const seekPreviewVideo = (video: HTMLVideoElement, force = false) => {
    const targetTime = Math.max(0, playheadTimeRef.current - previewVideoStart + (Number(previewVideoTrimStart) || 0));
    const applySeek = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : timelineDuration;
      const nextTime = clamp(targetTime, 0, duration);
      if (force || Math.abs(video.currentTime - nextTime) > (isPlaying ? 1.25 : 0.08)) {
        try {
          video.currentTime = nextTime;
        } catch {
          // Remote metadata can arrive after the source swap; the loadedmetadata retry handles it.
        }
      }
    };

    if (video.readyState >= 1) {
      applySeek();
    } else {
      video.addEventListener("loadedmetadata", applySeek, { once: true });
      video.load();
    }
  };

  const togglePreviewPlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      videoRef.current?.pause();
      return;
    }

    const video = videoRef.current;
    if (video) {
      seekPreviewVideo(video, true);
      void video.play().catch(() => undefined);
    }
    setIsPlaying(true);
  };

  const handleTimelineWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    zoomTimelineBy(event.deltaY < 0 ? 12 : -12, event.clientX);
  };

  useEffect(() => {
    const scroll = timelineScrollRef.current;
    if (!scroll) return;

    const handleNativeWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      setTimelineZoomAround(timelineZoomRef.current + (event.deltaY < 0 ? 12 : -12), event.clientX);
    };

    scroll.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => scroll.removeEventListener("wheel", handleNativeWheel);
  }, [setTimelineZoomAround]);

  const scrubFromTrack = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.buttons !== 1) return;
    clearTimelineSelection();
    const rect = event.currentTarget.getBoundingClientRect();
    const next = snapTime(((event.clientX - rect.left) / rect.width) * timelineDuration);
    setPlayheadTime(clamp(next, 0, timelineDuration));
  };

  const clearTimelineSelection = () => {
    setSelectedCaptionId(null);
    setSelectedLayerId(null);
    setSelectedCaptionIds([]);
    setSelectedLayerIds([]);
  };

  const beginMarqueeSelection = (
    event: ReactPointerEvent<HTMLDivElement>,
    kind: MarqueeState["kind"],
    layerType?: TextToVideoTimelineLayer["type"],
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const startX = clamp(event.clientX - rect.left, 0, rect.width);
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const next: MarqueeState = {
      kind,
      layerType,
      pointerId: event.pointerId,
      startX,
      currentX: startX,
      additive,
      initialCaptionIds: selectedCaptionIds,
      initialLayerIds: selectedLayerIds,
    };
    marqueeRef.current = next;
    setMarquee(next);
    if (!additive) clearTimelineSelection();
  };

  const selectedIdsFromMarquee = (state: MarqueeState) => {
    const left = Math.min(state.startX, state.currentX);
    const right = Math.max(state.startX, state.currentX);
    const start = left / Math.max(pixelsPerSecond, 0.1);
    const end = right / Math.max(pixelsPerSecond, 0.1);
    if (state.kind === "caption") {
      const ids = captionTimeline
        .filter((item) => item.start <= end && item.end >= start)
        .map((item) => item.caption.id);
      return { captionIds: state.additive ? Array.from(new Set([...state.initialCaptionIds, ...ids])) : ids, layerIds: [] };
    }
    const ids = (project.timeline_layers ?? [])
      .filter((layer) => (!state.layerType || layer.type === state.layerType) && layer.start <= end && layer.start + layer.duration >= start)
      .map((layer) => layer.id);
    return { captionIds: [], layerIds: state.additive ? Array.from(new Set([...state.initialLayerIds, ...ids])) : ids };
  };

  const updateMarqueeSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = { ...state, currentX: clamp(event.clientX - rect.left, 0, rect.width) };
    marqueeRef.current = next;
    setMarquee(next);
    const selected = selectedIdsFromMarquee(next);
    setSelectedCaptionIds(selected.captionIds);
    setSelectedLayerIds(selected.layerIds);
    setSelectedCaptionId(selected.captionIds.at(-1) ?? null);
    setSelectedLayerId(selected.layerIds.at(-1) ?? null);
  };

  const finishMarqueeSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    updateMarqueeSelection(event);
    marqueeRef.current = null;
    setMarquee(null);
  };

  const beginLayerDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    layer: TextToVideoTimelineLayer,
    action: Extract<DragState, { kind: "layer" }>["action"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    recordProjectSnapshot();
    const mode = action === "move" ? selectionMode(event) : "single";
    const selectedIds =
      action === "move" && mode !== "toggle" && selectedLayerIds.includes(layer.id)
        ? selectedLayerIds
        : mode === "toggle"
          ? selectedLayerIds.includes(layer.id)
            ? selectedLayerIds.filter((id) => id !== layer.id)
            : [...selectedLayerIds, layer.id]
          : [layer.id];
    const dragIds = selectedIds.length ? selectedIds : [layer.id];
    setSelectedLayerId(layer.id);
    setSelectedLayerIds(dragIds);
    setSelectedCaptionIds([]);
    setSelectedCaptionId(null);
    setActivePanel(layer.type === "audio" ? "audio" : "media");
    setPlayheadTime(clamp(Number(layer.start) || 0, 0, timelineDuration));
    dragStateRef.current = {
      kind: "layer",
      action: action as "move" | "resize-start" | "resize-end",
      id: layer.id,
      selectedIds: action === "move" ? dragIds : [layer.id],
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
    recordProjectSnapshot();
    setSelectedSceneId(scene.id);
    setSelectedLayerId(null);
    setSelectedLayerIds([]);
    setSelectedCaptionIds([]);
    dragStateRef.current = {
      kind: "scene",
      action: "resize-end",
      id: scene.id,
      startX: event.clientX,
      initialScenes: project.scenes,
      draftScenes: project.scenes,
    };
  };

  const beginCaptionTimelineDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    item: (typeof captionTimeline)[number],
    action: Extract<DragState, { kind: "caption" }>["action"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    recordProjectSnapshot();
    const mode = action === "move" ? selectionMode(event) : "single";
    const selectedIds =
      action === "move" && mode !== "toggle" && selectedCaptionIds.includes(item.caption.id)
        ? selectedCaptionIds
        : mode === "toggle"
          ? selectedCaptionIds.includes(item.caption.id)
            ? selectedCaptionIds.filter((id) => id !== item.caption.id)
            : [...selectedCaptionIds, item.caption.id]
          : [item.caption.id];
    const dragIds = selectedIds.length ? selectedIds : [item.caption.id];
    setSelectedCaptionId(item.caption.id);
    setSelectedCaptionIds(dragIds);
    setSelectedLayerIds([]);
    setSelectedLayerId(null);
    setSelectedSceneId(item.scene.id);
    setActivePanel("text");
    setPlayheadTime(clamp(item.start, 0, timelineDuration));
    dragStateRef.current = {
      kind: "caption",
      action,
      sceneId: item.scene.id,
      captionId: item.caption.id,
      selectedIds: action === "move" ? dragIds : [item.caption.id],
      selectedCaptions:
        action === "move"
          ? captionTimeline
              .filter((captionItem) => dragIds.includes(captionItem.caption.id))
              .map((captionItem) => ({
                sceneId: captionItem.scene.id,
                captionId: captionItem.caption.id,
                initialStart: captionItem.start,
                initialEnd: captionItem.end,
                sceneStart: captionItem.sceneStart,
                sceneDuration: captionItem.sceneDuration,
                isLocal: captionItem.isLocal,
              }))
          : [{
              sceneId: item.scene.id,
              captionId: item.caption.id,
              initialStart: item.start,
              initialEnd: item.end,
              sceneStart: item.sceneStart,
              sceneDuration: item.sceneDuration,
              isLocal: item.isLocal,
            }],
      startX: event.clientX,
      initialStart: item.start,
      initialEnd: item.end,
      sceneStart: item.sceneStart,
      sceneDuration: item.sceneDuration,
      isLocal: item.isLocal,
      initialScenes: project.scenes,
      draftScenes: project.scenes,
    };
  };

  const beginMusicDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    action: Extract<DragState, { kind: "music" }>["action"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    recordProjectSnapshot();
    setSelectedLayerId(null);
    setSelectedCaptionId(null);
    setSelectedLayerIds([]);
    setSelectedCaptionIds([]);
    setActivePanel("audio");
    const initialTimeline = {
      ...musicTimeline,
      start: musicStart,
      duration: musicDuration,
      trim_start: Number(musicTimeline.trim_start) || 0,
      trim_end: Number(musicTimeline.trim_end) || 0,
    };
    dragStateRef.current = {
      kind: "music",
      action,
      startX: event.clientX,
      initialTimeline,
      draftTimeline: initialTimeline,
    };
  };

  const handleTimelineDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    const deltaSeconds = snapTime((event.clientX - drag.startX) / pixelsPerSecond);
    if (drag.kind === "layer") {
      const movingLayerIds = new Set(drag.action === "move" ? drag.selectedIds : [drag.id]);
      const draftLayers = drag.initialLayers.map((layer) => {
        if (!movingLayerIds.has(layer.id)) return layer;
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

    if (drag.kind === "caption") {
      const captionUpdates = new Map<string, { sceneId: string; start: number; end: number; nextStart: number }>();
      if (drag.action === "move") {
        for (const caption of drag.selectedCaptions) {
          const duration = Math.max(MIN_CLIP_SECONDS, caption.initialEnd - caption.initialStart);
          const sceneMin = caption.sceneStart;
          const sceneMax = caption.sceneStart + Math.max(MIN_CLIP_SECONDS, caption.sceneDuration);
          const nextStart = clamp(snapTime(caption.initialStart + deltaSeconds), sceneMin, Math.max(sceneMin, sceneMax - duration));
          const nextEnd = snapTime(nextStart + duration);
          captionUpdates.set(caption.captionId, {
            sceneId: caption.sceneId,
            start: snapTime(caption.isLocal ? nextStart - caption.sceneStart : nextStart),
            end: snapTime(caption.isLocal ? nextEnd - caption.sceneStart : nextEnd),
            nextStart,
          });
        }
      } else {
        const duration = Math.max(MIN_CLIP_SECONDS, drag.initialEnd - drag.initialStart);
        const sceneMin = drag.sceneStart;
        const sceneMax = drag.sceneStart + Math.max(MIN_CLIP_SECONDS, drag.sceneDuration);
        let nextStart = drag.initialStart;
        let nextEnd = drag.initialEnd;

        if (drag.action === "resize-start") {
          nextStart = clamp(snapTime(drag.initialStart + deltaSeconds), sceneMin, Math.max(sceneMin, drag.initialEnd - MIN_CLIP_SECONDS));
        } else {
          nextEnd = clamp(snapTime(drag.initialEnd + deltaSeconds), drag.initialStart + MIN_CLIP_SECONDS, sceneMax);
        }

        captionUpdates.set(drag.captionId, {
          sceneId: drag.sceneId,
          start: snapTime(drag.isLocal ? nextStart - drag.sceneStart : nextStart),
          end: snapTime(drag.isLocal ? nextEnd - drag.sceneStart : nextEnd),
          nextStart,
        });
      }

      const draftScenes = drag.initialScenes.map((scene) =>
        (scene.captions ?? []).some((caption) => captionUpdates.has(caption.id))
          ? {
              ...scene,
              captions: (scene.captions ?? []).map((caption) =>
                captionUpdates.has(caption.id)
                  ? (() => {
                      const update = captionUpdates.get(caption.id)!;
                      return { ...caption, start: update.start, end: Math.max(update.start + MIN_CLIP_SECONDS, update.end) };
                    })()
                  : caption,
              ),
            }
          : scene,
      );
      dragStateRef.current = { ...drag, draftScenes };
      updateProjectLocal({ scenes: draftScenes });
      setPlayheadTime(clamp(captionUpdates.get(drag.captionId)?.nextStart ?? drag.initialStart, 0, timelineDuration));
      return;
    }

    if (drag.kind === "music") {
      const initialStart = Number(drag.initialTimeline.start) || 0;
      const initialDuration = Math.max(MIN_CLIP_SECONDS, Number(drag.initialTimeline.duration) || musicDuration);
      const initialEnd = initialStart + initialDuration;
      let start = initialStart;
      let duration = initialDuration;

      if (drag.action === "move") {
        start = clamp(snapTime(initialStart + deltaSeconds), 0, Math.max(0, timelineDuration - initialDuration));
      } else if (drag.action === "resize-start") {
        start = clamp(snapTime(initialStart + deltaSeconds), 0, Math.max(0, initialEnd - MIN_CLIP_SECONDS));
        duration = snapTime(initialEnd - start);
      } else {
        duration = clamp(snapTime(initialDuration + deltaSeconds), MIN_CLIP_SECONDS, Math.max(MIN_CLIP_SECONDS, timelineDuration - initialStart));
      }

      const draftTimeline = {
        ...drag.initialTimeline,
        start,
        duration,
      };
      dragStateRef.current = { ...drag, draftTimeline };
      updateProjectLocal({ music_timeline: draftTimeline });
      setPlayheadTime(clamp(start, 0, timelineDuration));
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

    if (drag.kind === "caption") {
      const totalDuration = drag.draftScenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0);
      await saveProjectPatch({ scenes: drag.draftScenes, total_duration: totalDuration }, "Caption timing saved");
      return;
    }

    if (drag.kind === "music") {
      await saveProjectPatch({ music_timeline: drag.draftTimeline }, "Music timing saved");
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

    const name = file.name.toLowerCase();
    if (/\.(mp4|mov|webm|m4v)$/.test(name)) return "video";
    if (/\.(mp3|wav|m4a|ogg)$/.test(name)) return "audio";
    return "video";
  };

  const mediaKindFromUrl = (
    url: string,
    fallback: TextToVideoTimelineLayer["type"] = libraryMediaType,
  ): TextToVideoTimelineLayer["type"] => {
    const clean = url.split("?")[0].toLowerCase();
    if (/\.(mp4|mov|webm|m4v)$/.test(clean)) return "video";
    if (/\.(mp3|wav|m4a|ogg)$/.test(clean)) return "audio";
    return fallback;
  };

  const mediaKindFromLibraryItem = (item: LibraryItem): TextToVideoTimelineLayer["type"] => {
    if (isTimelineMediaType(item.type)) return item.type;
    if (item.video_url) return "video";
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
    recordProjectSnapshot();
    const scenes = project.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene));
    const total_duration = scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0);
    const thumbnail_url =
      typeof patch.video_url === "string" && patch.video_url
        ? patch.video_url
        : scenes.find((scene) => scene.video_url)?.video_url ?? project.thumbnail_url;

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
    recordProjectSnapshot();
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

      if (mediaType !== "video") {
        setReplacementError("Text-to-video scene visuals must be videos.");
        return;
      }

      await saveSceneMedia(scene.id, { video_url: url, image_url: null }, "Scene video replaced");
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

      recordProjectSnapshot();
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

    recordProjectSnapshot();
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
    recordProjectSnapshot();
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

  const applyCaptionPreset = async (preset: string) => {
    recordProjectSnapshot();
    await updateCaptionStyle({ preset, ...(CAPTION_STYLE_PRESETS[preset] ?? {}) });
  };

  const updateCaptionPositionPreset = async (position: string) => {
    recordProjectSnapshot();
    const coordinates = position === "custom" ? captionCoordinates(captionStyle) : captionPresetCoordinates(position);
    await updateCaptionStyle({
      position,
      position_x: coordinates.x,
      position_y: coordinates.y,
    });
  };

  const pointToCaptionPercent = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = previewFrameRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return captionCoordinates(captionStyle);
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 5, 95),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 5, 95),
    };
  };

  const beginCaptionMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
    caption: TextToVideoCaption,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    recordProjectSnapshot();
    const item = captionTimeline.find(({ caption: timelineCaption }) => timelineCaption.id === caption.id);
    if (item) selectCaption(caption.id, item.start);
    const point = pointToCaptionPercent(event);
    const coordinates = captionCoordinates(captionStyle);
    const patch = { position: "custom", position_x: coordinates.x, position_y: coordinates.y };
    captionInteractionRef.current = {
      mode: "move",
      pointerId: event.pointerId,
      offsetX: coordinates.x - point.x,
      offsetY: coordinates.y - point.y,
      patch,
    };
    updateCaptionStyleLocal(patch);
  };

  const beginCaptionResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    recordProjectSnapshot();
    const boxSize = captionBoxSize(captionStyle);
    const patch = {
      box_width: boxSize.width,
      box_height: boxSize.height,
    };
    captionInteractionRef.current = {
      mode: "resize",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startBoxWidth: patch.box_width,
      startBoxHeight: patch.box_height,
      patch,
    };
  };

  const handleCaptionInteractionMove = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = captionInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    if (interaction.mode === "move") {
      const point = pointToCaptionPercent(event);
      const patch = {
        position: "custom",
        position_x: clamp(point.x + interaction.offsetX, 5, 95),
        position_y: clamp(point.y + interaction.offsetY, 5, 95),
      };
      captionInteractionRef.current = { ...interaction, patch };
      updateCaptionStyleLocal(patch);
      return;
    }

    const rect = previewFrameRef.current?.getBoundingClientRect();
    const deltaX = rect?.width ? ((event.clientX - interaction.startX) / rect.width) * 200 : 0;
    const deltaY = rect?.height ? ((event.clientY - interaction.startY) / rect.height) * 200 : 0;
    const patch = {
      box_width: Math.round(clamp(interaction.startBoxWidth + deltaX, 12, 95)),
      box_height: Math.round(clamp(interaction.startBoxHeight + deltaY, 6, 60)),
    };
    captionInteractionRef.current = { ...interaction, patch };
    updateCaptionStyleLocal(patch);
  };

  const finishCaptionInteraction = async (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = captionInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    captionInteractionRef.current = null;
    await updateCaptionStyle(interaction.patch);
  };

  const renderCaption = () => {
    if (!selectedCaption) return null;
    const displayText = captionStyle.uppercase ? selectedCaption.text.toUpperCase() : selectedCaption.text;
    const captionWords = selectedCaption.words?.length
      ? selectedCaption.words
      : displayText.split(/\s+/).filter(Boolean).map((word, index, words) => {
          const start = Number(selectedCaption.start) || 0;
          const end = Math.max(start + 0.2, Number(selectedCaption.end) || start + 1);
          const step = (end - start) / Math.max(1, words.length);
          return { word, start: start + index * step, end: start + (index + 1) * step };
        });
    const localPlayhead = selectedCaptionItem ? playheadTime - selectedCaptionItem.sceneStart : Number(selectedCaption.start) || 0;
    const activeWordIndex = captionWords.findIndex((word) => localPlayhead >= word.start && localPlayhead <= word.end);
    const backgroundClass =
      captionStyle.background === "accent_box"
        ? "bg-yellow-400 text-black"
        : captionStyle.background === "dark_box"
          ? "bg-black/75 text-white"
          : "text-white";
    const coordinates = captionCoordinates(captionStyle);
    const boxSize = captionBoxSize(captionStyle);
    const fontStyle = CAPTION_FONT_STYLES[captionStyle.font] ?? CAPTION_FONT_STYLES.bold_sans;
    const borderWidth = captionStyle.border_enabled ? clamp(Number(captionStyle.border_width) || 0, 0, 12) : 0;

    return (
      <button
        type="button"
        onPointerDown={(event) => beginCaptionMove(event, selectedCaption)}
        onPointerMove={handleCaptionInteractionMove}
        onPointerUp={(event) => void finishCaptionInteraction(event)}
        onPointerCancel={(event) => void finishCaptionInteraction(event)}
        className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center overflow-hidden rounded px-3 py-1.5 text-center font-semibold leading-tight shadow-lg outline outline-2 outline-transparent transition ${
          selectedCaptionId === selectedCaption.id ? "outline-white" : ""
        } ${backgroundClass}`}
        style={{
          left: `${coordinates.x}%`,
          top: `${coordinates.y}%`,
          width: `${boxSize.width}%`,
          height: `${boxSize.height}%`,
          boxSizing: "border-box",
          border: borderWidth > 0 ? `${borderWidth}px solid ${captionStyle.border_color || "#FFFFFF"}` : undefined,
          color: captionStyle.background === "accent_box" ? "#111111" : captionStyle.phrase_color,
          fontSize: clamp((captionStyle.size_phrase || captionStyle.size_active || 96) / 2.8, 16, 58),
          ...fontStyle,
          textShadow:
            captionStyle.background === "none"
              ? `0 2px ${Math.max(0, captionStyle.stroke_width || 0)}px rgba(0,0,0,0.8)`
              : undefined,
        }}
      >
        <span className="line-clamp-4 break-words">
          {captionWords.length
            ? captionWords.map((word, index) => {
                const isActive = index === activeWordIndex || (activeWordIndex < 0 && index === 0);
                const text = captionStyle.uppercase ? word.word.toUpperCase() : word.word;
                return (
                  <span
                    key={`${word.word}-${index}`}
                    style={{
                      color: isActive
                        ? captionStyle.active_color
                        : captionStyle.background === "accent_box"
                          ? "#111111"
                          : captionStyle.phrase_color,
                      fontSize: isActive
                        ? `${clamp((captionStyle.size_active || captionStyle.size_phrase || 96) / 2.8, 16, 58)}px`
                        : undefined,
                      opacity: isActive ? 1 : clamp(Number(captionStyle.phrase_opacity) || 0.55, 0.1, 1),
                    }}
                  >
                    {text}
                    {index < captionWords.length - 1 ? " " : ""}
                  </span>
                );
              })
            : displayText}
        </span>
        <span
          role="presentation"
          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border border-white/80 bg-zinc-950 shadow"
          onPointerDown={beginCaptionResize}
          onPointerMove={handleCaptionInteractionMove}
          onPointerUp={(event) => void finishCaptionInteraction(event)}
          onPointerCancel={(event) => void finishCaptionInteraction(event)}
        />
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white"
              onClick={() => void undoProject()}
              disabled={!canUndo || isSaving}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white"
              onClick={() => void redoProject()}
              disabled={!canRedo || isSaving}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
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
                  ref={previewFrameRef}
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
                      style={{
                        objectPosition: `${50 + (previewScene?.crop_x ?? 0) / 2}% ${50 + (previewScene?.crop_y ?? 0) / 2}%`,
                        transform: `scale(${previewScene?.crop_zoom ?? 1})`,
                      }}
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
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white" onClick={togglePreviewPlayback}>
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

            <section className="h-[348px] shrink-0 border-t border-white/10 bg-[#111014]">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-300 hover:text-white"
                        onClick={() => {
                          recordProjectSnapshot();
                          void removeLayer(selectedLayer.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-400">
                    {formatClock(playheadTime)} / {formatClock(timelineDuration)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-400 hover:text-white"
                    onClick={() => zoomTimelineBy(-12)}
                    disabled={timelineZoom <= MIN_TIMELINE_ZOOM}
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Slider
                    value={[timelineZoom]}
                    min={MIN_TIMELINE_ZOOM}
                    max={MAX_TIMELINE_ZOOM}
                    step={4}
                    className="w-28"
                    onValueChange={([value]) => setTimelineZoomAround(value)}
                  />
                  <span className="w-12 text-center text-[11px] text-zinc-500">{Math.round(timelineZoom)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-400 hover:text-white"
                    onClick={() => zoomTimelineBy(12)}
                    disabled={timelineZoom >= MAX_TIMELINE_ZOOM}
                    title="Zoom in"
                  >
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
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      recordProjectSnapshot();
                      void addLayer();
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              )}

              <div
                ref={timelineScrollRef}
                className="h-[calc(100%-40px)] overflow-auto sidebar-scroll"
                onWheel={handleTimelineWheel}
              >
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
                            {scene.video_url ? (
                              <video
                                src={scene.video_url}
                                className="absolute inset-0 h-full w-full object-cover opacity-45"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : null}
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
                      <div
                        className="relative h-10 rounded border border-white/10 bg-[#191820]"
                        onPointerDown={(event) => beginMarqueeSelection(event, "caption")}
                        onPointerMove={updateMarqueeSelection}
                        onPointerUp={finishMarqueeSelection}
                        onPointerCancel={finishMarqueeSelection}
                      >
                        {marquee?.kind === "caption" && (
                          <div
                            className="pointer-events-none absolute top-1 z-40 h-8 rounded border border-cyan-300 bg-cyan-300/15"
                            style={{
                              left: Math.min(marquee.startX, marquee.currentX),
                              width: Math.abs(marquee.currentX - marquee.startX),
                            }}
                          />
                        )}
                        {captionTimeline.map((item) => (
                          <TimelineClip
                            key={item.caption.id}
                            left={item.start * pixelsPerSecond}
                            width={Math.max(MIN_CLIP_SECONDS, item.end - item.start) * pixelsPerSecond}
                            selected={selectedCaptionIds.includes(item.caption.id)}
                            className="cursor-grab border-violet-300/50 bg-violet-500/70 text-white active:cursor-grabbing"
                            onPointerDown={(event) => beginCaptionTimelineDrag(event, item, "move")}
                            onPointerMove={handleTimelineDrag}
                            onPointerUp={() => void finishTimelineDrag()}
                          >
                            <div className="flex h-full items-center gap-1 px-2">
                              <Type className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.caption.text}</span>
                            </div>
                            <div
                              className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                              onPointerDown={(event) => beginCaptionTimelineDrag(event, item, "resize-start")}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                            />
                            <div
                              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                              onPointerDown={(event) => beginCaptionTimelineDrag(event, item, "resize-end")}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                            />
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
                        <div
                          className="relative h-10 rounded border border-white/10 bg-[#191820]"
                          onPointerDown={(event) => beginMarqueeSelection(event, "layer", type)}
                          onPointerMove={updateMarqueeSelection}
                          onPointerUp={finishMarqueeSelection}
                          onPointerCancel={finishMarqueeSelection}
                        >
                          {marquee?.kind === "layer" && marquee.layerType === type && (
                            <div
                              className="pointer-events-none absolute top-1 z-40 h-8 rounded border border-cyan-300 bg-cyan-300/15"
                              style={{
                                left: Math.min(marquee.startX, marquee.currentX),
                                width: Math.abs(marquee.currentX - marquee.startX),
                              }}
                            />
                          )}
                          {(project.timeline_layers ?? []).filter((layer) => layer.type === type).map((layer) => (
                            <TimelineClip
                              key={layer.id}
                              left={layer.start * pixelsPerSecond}
                              width={layer.duration * pixelsPerSecond}
                              selected={selectedLayerIds.includes(layer.id)}
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
                        <Mic2 className="h-4 w-4" />
                        Voice
                      </div>
                      <div className="relative h-10 rounded border border-white/10 bg-[#191820]" onPointerDown={scrubFromTrack}>
                        {sceneTimeline.filter(({ scene }) => Boolean(scene.voiceover_url)).map(({ scene, start, duration }) => (
                          <TimelineClip
                            key={`voice-${scene.id}`}
                            left={start * pixelsPerSecond}
                            width={duration * pixelsPerSecond}
                            selected={selectedSceneId === scene.id && activePanel === "audio" && !selectedLayer}
                            className="border-amber-200/40 bg-amber-500/60 text-white"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setSelectedSceneId(scene.id);
                              setSelectedLayerId(null);
                              setSelectedCaptionId(null);
                              setActivePanel("audio");
                              setPlayheadTime(start);
                            }}
                          >
                            <div className="absolute inset-x-2 top-1/2 h-5 -translate-y-1/2 opacity-70 [background:repeating-linear-gradient(90deg,rgba(255,255,255,.35)_0_2px,transparent_2px_7px)]" />
                            <div className="relative z-10 flex h-full items-center gap-1 px-2">
                              <Mic2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">Scene {scene.index + 1} voice</span>
                            </div>
                          </TimelineClip>
                        ))}
                      </div>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineWidth}px` }}>
                      <div className="sticky left-0 z-20 flex h-10 items-center gap-2 border-r border-white/10 bg-[#111014] pr-2 text-xs text-zinc-500">
                        <Music2 className="h-4 w-4" />
                        Music
                      </div>
                      <div className="relative h-10 rounded border border-white/10 bg-[#191820]" onPointerDown={scrubFromTrack}>
                        {project.music_url && (
                          <TimelineClip
                            left={musicStart * pixelsPerSecond}
                            width={Math.min(musicDuration, timelineDuration - musicStart) * pixelsPerSecond}
                            selected={activePanel === "audio" && !selectedLayer}
                            className="cursor-grab border-fuchsia-200/40 bg-fuchsia-500/60 text-white active:cursor-grabbing"
                            onPointerDown={(event) => beginMusicDrag(event, "move")}
                            onPointerMove={handleTimelineDrag}
                            onPointerUp={() => void finishTimelineDrag()}
                          >
                            <div className="absolute inset-x-2 top-1/2 h-5 -translate-y-1/2 opacity-70 [background:repeating-linear-gradient(90deg,rgba(255,255,255,.35)_0_2px,transparent_2px_7px)]" />
                            <div className="relative z-10 flex h-full items-center gap-1 px-2">
                              <Music2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{labelFromUrl(project.music_url)}</span>
                            </div>
                            <div
                              className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                              onPointerDown={(event) => beginMusicDrag(event, "resize-start")}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                              onPointerCancel={() => void finishTimelineDrag()}
                            />
                            <div
                              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                              onPointerDown={(event) => beginMusicDrag(event, "resize-end")}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                              onPointerCancel={() => void finishTimelineDrag()}
                            />
                          </TimelineClip>
                        )}
                      </div>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineWidth}px` }}>
                      <div className="sticky left-0 z-20 flex h-10 items-center gap-2 border-r border-white/10 bg-[#111014] pr-2 text-xs text-zinc-500">
                        <Volume2 className="h-4 w-4" />
                        Audio Layers
                      </div>
                      <div
                        className="relative h-10 rounded border border-white/10 bg-[#191820]"
                        onPointerDown={(event) => beginMarqueeSelection(event, "layer", "audio")}
                        onPointerMove={updateMarqueeSelection}
                        onPointerUp={finishMarqueeSelection}
                        onPointerCancel={finishMarqueeSelection}
                      >
                        {marquee?.kind === "layer" && marquee.layerType === "audio" && (
                          <div
                            className="pointer-events-none absolute top-1 z-40 h-8 rounded border border-cyan-300 bg-cyan-300/15"
                            style={{
                              left: Math.min(marquee.startX, marquee.currentX),
                              width: Math.abs(marquee.currentX - marquee.startX),
                            }}
                          />
                        )}
                        {(project.timeline_layers ?? []).filter((layer) => layer.type === "audio").map((layer) => (
                          <TimelineClip
                            key={layer.id}
                            left={layer.start * pixelsPerSecond}
                            width={layer.duration * pixelsPerSecond}
                            selected={selectedLayerIds.includes(layer.id)}
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
                              onPointerCancel={() => void finishTimelineDrag()}
                            />
                            <div
                              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                              onPointerDown={(event) => beginLayerDrag(event, layer, "resize-end")}
                              onPointerMove={handleTimelineDrag}
                              onPointerUp={() => void finishTimelineDrag()}
                              onPointerCancel={() => void finishTimelineDrag()}
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-white"
                  onClick={() => {
                    recordProjectSnapshot();
                    void removeLayer(selectedLayer.id);
                  }}
                >
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
                      <Select value={captionStyle.preset} onValueChange={(value) => void applyCaptionPreset(value)}>
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
                      <Select value={captionStyle.position} onValueChange={(value) => void updateCaptionPositionPreset(value)}>
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
                  <div className="space-y-3 rounded border border-white/10 bg-[#201f26] p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-zinc-400">Text X</Label>
                      <span className="font-mono text-xs text-zinc-500">{Math.round(captionCoordinates(captionStyle).x)}%</span>
                    </div>
                    <Slider
                      value={[captionCoordinates(captionStyle).x]}
                      min={5}
                      max={95}
                      step={1}
                      onValueChange={([value]) => updateCaptionStyleLocal({ position: "custom", position_x: value })}
                      onValueCommit={([value]) => void updateCaptionStyle({ position: "custom", position_x: value })}
                    />
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-zinc-400">Text Y</Label>
                      <span className="font-mono text-xs text-zinc-500">{Math.round(captionCoordinates(captionStyle).y)}%</span>
                    </div>
                    <Slider
                      value={[captionCoordinates(captionStyle).y]}
                      min={5}
                      max={95}
                      step={1}
                      onValueChange={([value]) => updateCaptionStyleLocal({ position: "custom", position_y: value })}
                      onValueCommit={([value]) => void updateCaptionStyle({ position: "custom", position_y: value })}
                    />
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-zinc-400">Box W</Label>
                      <span className="font-mono text-xs text-zinc-500">{Math.round(captionBoxSize(captionStyle).width)}%</span>
                    </div>
                    <Slider
                      value={[captionBoxSize(captionStyle).width]}
                      min={12}
                      max={95}
                      step={1}
                      onValueChange={([value]) => updateCaptionStyleLocal({ box_width: value })}
                      onValueCommit={([value]) => void updateCaptionStyle({ box_width: value })}
                    />
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-zinc-400">Box H</Label>
                      <span className="font-mono text-xs text-zinc-500">{Math.round(captionBoxSize(captionStyle).height)}%</span>
                    </div>
                    <Slider
                      value={[captionBoxSize(captionStyle).height]}
                      min={6}
                      max={60}
                      step={1}
                      onValueChange={([value]) => updateCaptionStyleLocal({ box_height: value })}
                      onValueCommit={([value]) => void updateCaptionStyle({ box_height: value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Color</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26] p-1"
                        type="color"
                        value={captionStyle.phrase_color}
                        onChange={(event) => updateCaptionStyleLocal({ phrase_color: event.target.value })}
                        onBlur={(event) => void updateCaptionStyle({ phrase_color: event.currentTarget.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Active</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26] p-1"
                        type="color"
                        value={captionStyle.active_color}
                        onChange={(event) => updateCaptionStyleLocal({ active_color: event.target.value })}
                        onBlur={(event) => void updateCaptionStyle({ active_color: event.currentTarget.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Phrase Size</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26]"
                        type="number"
                        value={captionStyle.size_phrase}
                        onChange={(event) => updateCaptionStyleLocal({ size_phrase: Number(event.target.value) || 0 })}
                        onBlur={(event) => void updateCaptionStyle({ size_phrase: Number(event.currentTarget.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Active Size</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26]"
                        type="number"
                        value={captionStyle.size_active}
                        onChange={(event) => updateCaptionStyleLocal({ size_active: Number(event.target.value) || 0 })}
                        onBlur={(event) => void updateCaptionStyle({ size_active: Number(event.currentTarget.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Stroke</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26]"
                        type="number"
                        value={captionStyle.stroke_width}
                        onChange={(event) => updateCaptionStyleLocal({ stroke_width: Number(event.target.value) || 0 })}
                        onBlur={(event) => void updateCaptionStyle({ stroke_width: Number(event.currentTarget.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Border Width</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26]"
                        type="number"
                        min={0}
                        max={12}
                        value={captionStyle.border_width}
                        onChange={(event) => updateCaptionStyleLocal({ border_width: clamp(Number(event.target.value) || 0, 0, 12) })}
                        onBlur={(event) => void updateCaptionStyle({ border_width: clamp(Number(event.currentTarget.value) || 0, 0, 12) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Border Color</Label>
                      <Input
                        className="h-9 border-white/10 bg-[#201f26] p-1"
                        type="color"
                        value={captionStyle.border_color}
                        onChange={(event) => updateCaptionStyleLocal({ border_color: event.target.value })}
                        onBlur={(event) => void updateCaptionStyle({ border_color: event.currentTarget.value })}
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
                    <label className="flex items-center gap-2"><Switch checked={captionStyle.border_enabled} onCheckedChange={(checked) => void updateCaptionStyle({ border_enabled: checked })} />Border</label>
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
                    <Label className="text-xs text-zinc-400">Video URL</Label>
                    <Input
                      className="h-9 border-white/10 bg-[#201f26]"
                      value={selectedScene.video_url ?? ""}
                      onChange={(event) => updateSceneLocal(selectedScene.id, { video_url: event.target.value, image_url: null })}
                      onBlur={() => void saveScenes("Scene media saved")}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input className="h-9 border-white/10 bg-[#201f26]" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search Pixabay videos" onKeyDown={(event) => { if (event.key === "Enter") void searchLibrary("video"); }} />
                    <Button size="icon" className="h-9 w-9" onClick={() => void searchLibrary("video")} disabled={isSearchingLibrary}>
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
