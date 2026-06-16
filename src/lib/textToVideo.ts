export const TEXT_TO_VIDEO_COST_PER_10_SECONDS = 80;
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
