export const TEXT_TO_VIDEO_COST_PER_10_SECONDS = 30;
export const TEXT_TO_VIDEO_MIN_DURATION_SECONDS = 10;
export const TEXT_TO_VIDEO_MAX_DURATION_SECONDS = 120;

export const TEXT_TO_VIDEO_STYLES = [
  "cinematic",
  "documentary",
  "animated",
  "realistic",
  "product",
  "vertical-short",
] as const;

export type TextToVideoStyle = (typeof TEXT_TO_VIDEO_STYLES)[number];

export const TEXT_TO_VIDEO_AUDIO_STYLES = [
  "none",
  "cinematic",
  "upbeat",
  "lofi",
  "documentary",
] as const;

export type TextToVideoAudioStyle = (typeof TEXT_TO_VIDEO_AUDIO_STYLES)[number];

export const TEXT_TO_VIDEO_ASPECTS = ["9:16", "1:1", "16:9"] as const;
export type TextToVideoAspect = (typeof TEXT_TO_VIDEO_ASPECTS)[number];

export const TEXT_TO_VIDEO_VOICES = [
  { id: "alloy", label: "Alloy - Neutral" },
  { id: "echo", label: "Echo - Smooth" },
  { id: "fable", label: "Fable - Storyteller" },
  { id: "onyx", label: "Onyx - Deep" },
  { id: "nova", label: "Nova - Energetic" },
  { id: "shimmer", label: "Shimmer - Bright" },
] as const;

export const TEXT_TO_VIDEO_CAPTION_THEMES = [
  { id: "viral_pop", label: "Viral Pop" },
  { id: "minimal", label: "Minimal" },
  { id: "hormozi", label: "Hormozi" },
  { id: "mrbeast", label: "MrBeast" },
] as const;

export type TextToVideoVoice = (typeof TEXT_TO_VIDEO_VOICES)[number]["id"];
export type TextToVideoCaptionTheme = (typeof TEXT_TO_VIDEO_CAPTION_THEMES)[number]["id"];

export interface TextToVideoWord {
  word: string;
  start: number;
  end: number;
}

export interface TextToVideoCaption {
  id: string;
  text: string;
  start: number;
  end: number;
  speaker?: string;
  words?: TextToVideoWord[];
  style_preset?: string;
}

export interface TextToVideoScene {
  id: string;
  index: number;
  script: string;
  duration: number;
  voiceover_url?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  keywords?: string[];
  transition_in?: string;
  animation?: string;
  effects?: string[];
  speaker?: string;
  crop_x?: number;
  crop_y?: number;
  crop_zoom?: number;
  captions?: TextToVideoCaption[];
}

export interface TextToVideoTimelineLayer {
  id: string;
  type: "audio" | "image" | "video";
  url: string;
  start: number;
  duration: number;
  track: number;
  volume: number;
  opacity: number;
  trim_start: number;
  trim_end: number;
}

export interface TextToVideoUploadedMedia {
  id: string;
  url: string;
  filename?: string;
  size?: number;
  media_type: "audio" | "image" | "video";
  kind?: string;
  uploaded_at: string;
  expires_at: string;
}

export interface TextToVideoCaptionStyle {
  preset: string;
  font: string;
  active_color: string;
  phrase_color: string;
  phrase_opacity: number;
  position: string;
  position_x: number;
  position_y: number;
  box_width: number;
  box_height: number;
  border_enabled: boolean;
  border_color: string;
  border_width: number;
  size_active: number;
  size_phrase: number;
  stroke_width: number;
  background: string;
  uppercase: boolean;
  animation: string;
  show_phrase: boolean;
}

export interface TextToVideoMusicTimeline {
  start: number;
  duration: number;
  trim_start: number;
  trim_end: number;
}

export interface TextToVideoProject {
  id: string;
  title: string;
  aspect: TextToVideoAspect;
  script: string;
  voice: TextToVideoVoice | string;
  caption_theme: TextToVideoCaptionTheme | string;
  caption_style: TextToVideoCaptionStyle;
  scenes: TextToVideoScene[];
  music_url?: string | null;
  music_tracks?: string[];
  timeline_layers?: TextToVideoTimelineLayer[];
  uploaded_media?: TextToVideoUploadedMedia[];
  music_timeline?: TextToVideoMusicTimeline;
  total_duration: number;
  thumbnail_url?: string | null;
  status: "draft" | "generating" | "ready" | "rendering" | "rendered" | "failed";
  final_video_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TextToVideoGeneration {
  id: string;
  prompt: string;
  style: string;
  aspect_ratio: TextToVideoAspect;
  duration_seconds: number;
  credits_used: number;
  status: "processing" | "completed" | "failed";
  video_url: string | null;
  provider_project_id?: string | null;
  provider_job_id: string | null;
  provider_response?: {
    project?: TextToVideoProject;
    render?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  error_message: string | null;
  created_at: string;
}

export interface TextToVideoRenderJob {
  job_id?: string;
  id?: string;
  project_id?: string;
  status: "queued" | "running" | "completed" | "failed";
  progress?: number;
  message?: string;
  final_video_url?: string | null;
  error?: string | null;
}

export const DEFAULT_CAPTION_STYLE: TextToVideoCaptionStyle = {
  preset: "viral_pop",
  font: "bold_sans",
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
};

export const DEFAULT_MUSIC_TIMELINE: TextToVideoMusicTimeline = {
  start: 0,
  duration: 0,
  trim_start: 0,
  trim_end: 0,
};

export function clampTextToVideoDuration(duration: number) {
  if (!Number.isFinite(duration)) return TEXT_TO_VIDEO_MIN_DURATION_SECONDS;
  return Math.min(
    TEXT_TO_VIDEO_MAX_DURATION_SECONDS,
    Math.max(TEXT_TO_VIDEO_MIN_DURATION_SECONDS, Math.round(duration))
  );
}

export function calculateTextToVideoCredits(durationSeconds: number) {
  const duration = clampTextToVideoDuration(durationSeconds);
  return Math.ceil(duration / 10) * TEXT_TO_VIDEO_COST_PER_10_SECONDS;
}

export function normalizeTextToVideoStyle(value: unknown): TextToVideoStyle {
  return TEXT_TO_VIDEO_STYLES.includes(value as TextToVideoStyle)
    ? (value as TextToVideoStyle)
    : "vertical-short";
}

export function estimateTextToVideoDurationSeconds(script: string) {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  return clampTextToVideoDuration(Math.ceil(words / 2.5));
}

export function projectIdFromGeneration(generation: TextToVideoGeneration | null | undefined) {
  const providerResponse = generation?.provider_response as
    | { id?: string | null; project_id?: string | null; project?: { id?: string | null } | null }
    | null
    | undefined;
  return (
    generation?.provider_project_id ||
    providerResponse?.project?.id ||
    providerResponse?.project_id ||
    providerResponse?.id ||
    null
  );
}

export function normalizeTextToVideoProject(project: TextToVideoProject): TextToVideoProject {
  const scenes = project.scenes ?? [];
  const timelineLayers = project.timeline_layers ?? [];
  return {
    ...project,
    scenes,
    caption_style: { ...DEFAULT_CAPTION_STYLE, ...(project.caption_style ?? {}) },
    music_tracks: project.music_tracks ?? [],
    timeline_layers: timelineLayers,
    uploaded_media: project.uploaded_media ?? [],
    music_timeline: { ...DEFAULT_MUSIC_TIMELINE, ...(project.music_timeline ?? {}) },
    total_duration:
      Number(project.total_duration) ||
      scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0),
  };
}
