export const TTS_MAX_CHARACTERS = 12000;
export const TTS_VOICE_SAMPLE_LIMIT = 10;

export const TTS_MOODS = [
  "neutral",
  "calm",
  "cheerful",
  "serious",
  "dramatic",
  "energetic",
] as const;

export const TTS_STYLES = [
  "conversational",
  "narration",
  "commercial",
  "podcast",
  "storytelling",
  "cinematic",
] as const;

export const TTS_OUTPUT_FORMATS = ["mp3", "wav"] as const;

export type TtsMood = (typeof TTS_MOODS)[number];
export type TtsStyle = (typeof TTS_STYLES)[number];
export type TtsOutputFormat = (typeof TTS_OUTPUT_FORMATS)[number];

export interface TextToSpeechVoice {
  id: string;
  label: string;
  description: string;
  category?: string | null;
  previewUrl?: string | null;
  gender?: string | null;
  accent?: string | null;
  language?: string | null;
  age?: string | null;
  isOwner?: boolean;
  sampleCount?: number | null;
}

export const TEXT_TO_SPEECH_VOICES: TextToSpeechVoice[] = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    label: "Rachel",
    description: "Warm and natural for narration and explainers",
  },
  {
    id: "ErXwobaYiN019PkySvjV",
    label: "Antoni",
    description: "Clear, confident male voice for tutorials",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    label: "Bella",
    description: "Bright female voice for short-form and upbeat reads",
  },
  {
    id: "TxGEqnHWrfWFTfGW9XjX",
    label: "Josh",
    description: "Balanced male voice for podcasts and long-form audio",
  },
];

export function clampTextToSpeechSpeed(value: number): number {
  return Math.min(1.2, Math.max(0.7, Number.isFinite(value) ? value : 1));
}

export function calculateTextToSpeechCredits(charCount: number): number {
  if (charCount <= 0) return 80;
  if (charCount <= 3000) return 80;
  if (charCount <= 6000) return 120;
  if (charCount <= 9000) return 160;
  if (charCount <= TTS_MAX_CHARACTERS) return 180;
  return 0;
}

export function getTextToSpeechComplexity(charCount: number): "basic" | "standard" | "extensive" {
  if (charCount <= 3000) return "basic";
  if (charCount <= 6000) return "standard";
  return "extensive";
}

export function getTextToSpeechVoiceLabel(voiceId: string): string {
  return TEXT_TO_SPEECH_VOICES.find((voice) => voice.id === voiceId)?.label ?? "Custom Voice";
}

export function isCustomTextToSpeechVoice(
  voice: Pick<TextToSpeechVoice, "category"> | null | undefined
): boolean {
  const category = voice?.category?.toLowerCase();
  return Boolean(category && category !== "premade" && category !== "default");
}
