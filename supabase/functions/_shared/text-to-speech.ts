export const MAX_TTS_CHARACTERS = 12000;

const MOODS = [
  "neutral",
  "calm",
  "cheerful",
  "serious",
  "dramatic",
  "energetic",
] as const;

const STYLES = [
  "conversational",
  "narration",
  "commercial",
  "podcast",
  "storytelling",
  "cinematic",
] as const;

const OUTPUT_FORMATS = ["mp3", "wav"] as const;

export type SpeechMood = (typeof MOODS)[number];
export type SpeechStyle = (typeof STYLES)[number];
export type SpeechOutputFormat = (typeof OUTPUT_FORMATS)[number];

interface VoicePreset {
  id: string;
  label: string;
}

const VOICE_PRESETS: VoicePreset[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh" },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const clampSpeechSpeed = (value: number) => {
  return Math.min(1.2, Math.max(0.7, Number.isFinite(value) ? value : 1));
};

export const normalizeMood = (value: string | null | undefined): SpeechMood => {
  return MOODS.includes(value as SpeechMood) ? (value as SpeechMood) : "neutral";
};

export const normalizeStyle = (value: string | null | undefined): SpeechStyle => {
  return STYLES.includes(value as SpeechStyle) ? (value as SpeechStyle) : "conversational";
};

export const normalizeOutputFormat = (
  value: string | null | undefined
): SpeechOutputFormat => {
  return OUTPUT_FORMATS.includes(value as SpeechOutputFormat)
    ? (value as SpeechOutputFormat)
    : "mp3";
};

export const calculateSpeechCreditCost = (charCount: number) => {
  if (charCount <= 0) return 80;
  if (charCount <= 3000) return 80;
  if (charCount <= 6000) return 120;
  if (charCount <= 9000) return 160;
  if (charCount <= MAX_TTS_CHARACTERS) return 180;
  return 0;
};

export const getSpeechCreditComplexity = (
  charCount: number
): "basic" | "standard" | "extensive" => {
  if (charCount <= 3000) return "basic";
  if (charCount <= 6000) return "standard";
  return "extensive";
};

export const getVoiceLabel = (voiceId: string, customLabel?: string | null) => {
  const normalizedCustomLabel = typeof customLabel === "string" ? customLabel.trim() : "";
  if (normalizedCustomLabel) return normalizedCustomLabel;
  return VOICE_PRESETS.find((voice) => voice.id === voiceId)?.label ?? "Custom Voice";
};

export const getOutputFormatConfig = (format: SpeechOutputFormat) => {
  return format === "wav"
    ? { query: "wav_44100", contentType: "audio/wav" }
    : { query: "mp3_44100_128", contentType: "audio/mpeg" };
};

export const buildElevenLabsVoiceSettings = ({
  mood,
  style,
  speed,
}: {
  mood: SpeechMood;
  style: SpeechStyle;
  speed: number;
}) => {
  const moodSettings: Record<
    SpeechMood,
    { stability: number; style: number; similarity: number }
  > = {
    neutral: { stability: 0.55, style: 0.3, similarity: 0.8 },
    calm: { stability: 0.75, style: 0.18, similarity: 0.82 },
    cheerful: { stability: 0.4, style: 0.5, similarity: 0.78 },
    serious: { stability: 0.72, style: 0.16, similarity: 0.85 },
    dramatic: { stability: 0.42, style: 0.86, similarity: 0.76 },
    energetic: { stability: 0.35, style: 0.72, similarity: 0.78 },
  };

  const styleAdjustments: Record<
    SpeechStyle,
    { stability: number; style: number; similarity: number }
  > = {
    conversational: { stability: -0.04, style: 0.05, similarity: 0 },
    narration: { stability: 0.06, style: -0.04, similarity: 0.02 },
    commercial: { stability: -0.02, style: 0.14, similarity: 0 },
    podcast: { stability: 0.02, style: 0.08, similarity: 0.01 },
    storytelling: { stability: -0.05, style: 0.18, similarity: -0.01 },
    cinematic: { stability: -0.08, style: 0.24, similarity: -0.02 },
  };

  const moodBase = moodSettings[mood];
  const styleBase = styleAdjustments[style];

  return {
    stability: clamp01(moodBase.stability + styleBase.stability),
    similarity_boost: clamp01(moodBase.similarity + styleBase.similarity),
    style: clamp01(moodBase.style + styleBase.style),
    speed: clampSpeechSpeed(speed),
    use_speaker_boost: true,
  };
};
