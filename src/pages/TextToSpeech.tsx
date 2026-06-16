import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { canAccessFeature } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
import {
  calculateTextToSpeechCredits,
  clampTextToSpeechSpeed,
  getTextToSpeechVoiceLabel,
  isCustomTextToSpeechVoice,
  TEXT_TO_SPEECH_VOICES,
  TTS_MAX_CHARACTERS,
  TTS_MOODS,
  TTS_OUTPUT_FORMATS,
  TTS_VOICE_SAMPLE_LIMIT,
  TTS_STYLES,
  type TextToSpeechVoice,
  type TtsMood,
  type TtsOutputFormat,
  type TtsStyle,
} from "@/lib/textToSpeech";
import {
  AudioLines,
  Download,
  FileAudio,
  Loader2,
  Menu,
  Mic,
  Pause,
  PencilLine,
  Play,
  RefreshCw,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  Wand2,
} from "lucide-react";

interface UserCredits {
  ai_credits_balance: number;
  ai_credits_used: number;
}

interface TextToSpeechGeneration {
  id: string;
  audio_path: string | null;
  text_input: string;
  voice_id: string;
  voice_label: string;
  mood: TtsMood;
  style: TtsStyle;
  speed: number;
  output_format: TtsOutputFormat;
  char_count: number;
  credits_used: number;
  status: "processing" | "completed" | "failed";
  audio_url: string | null;
  error_message: string | null;
  created_at: string;
}

interface ListTtsVoicesResponse {
  voices: TextToSpeechVoice[];
  configured?: boolean;
  warning?: string | null;
}

interface CreateTtsVoiceResponse {
  voiceId?: string | null;
  requiresVerification?: boolean;
}

interface UpdateTtsVoiceResponse {
  voiceId?: string | null;
  status?: string;
}

interface VoiceLabFormState {
  name: string;
  description: string;
  language: string;
  accent: string;
  gender: string;
  age: string;
  removeBackgroundNoise: boolean;
}

interface VoiceLabSample {
  id: string;
  file: File;
  source: "upload" | "recording";
}

type VoiceInputMode = "preset" | "clone";
type VoiceLabMode = "create" | "update";

const EMPTY_VOICE_LAB_FORM: VoiceLabFormState = {
  name: "",
  description: "",
  language: "",
  accent: "",
  gender: "",
  age: "",
  removeBackgroundNoise: false,
};

const TextToSpeech = () => {
  const { user, subscription, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const userId = user?.id ?? null;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userCredits, setUserCredits] = useState<UserCredits>({
    ai_credits_balance: 0,
    ai_credits_used: 0,
  });
  const [history, setHistory] = useState<TextToSpeechGeneration[]>([]);
  const [historyStatusMessage, setHistoryStatusMessage] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<TextToSpeechVoice[]>(TEXT_TO_SPEECH_VOICES);
  const [ttsConfigured, setTtsConfigured] = useState(false);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [deletingGenerationId, setDeletingGenerationId] = useState<string | null>(null);
  const [downloadingGenerationId, setDownloadingGenerationId] = useState<string | null>(null);
  const [generationPendingDelete, setGenerationPendingDelete] =
    useState<TextToSpeechGeneration | null>(null);
  const [playingGenerationId, setPlayingGenerationId] = useState<string | null>(null);
  const [voiceLabMode, setVoiceLabMode] = useState<VoiceLabMode>("create");
  const [selectedOwnedVoiceId, setSelectedOwnedVoiceId] = useState("");
  const [createVoiceForm, setCreateVoiceForm] = useState<VoiceLabFormState>(EMPTY_VOICE_LAB_FORM);
  const [updateVoiceForm, setUpdateVoiceForm] = useState<VoiceLabFormState>(EMPTY_VOICE_LAB_FORM);
  const [createVoiceSamples, setCreateVoiceSamples] = useState<VoiceLabSample[]>([]);
  const [updateVoiceSamples, setUpdateVoiceSamples] = useState<VoiceLabSample[]>([]);
  const [voiceActionInFlight, setVoiceActionInFlight] = useState<VoiceLabMode | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<VoiceLabMode | null>(null);
  const autoLoadedKeyRef = useRef<string | null>(null);
  const historyUnavailableRef = useRef(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [formData, setFormData] = useState({
    text: "",
    voiceMode: "preset" as VoiceInputMode,
    voiceId: TEXT_TO_SPEECH_VOICES[0]?.id ?? "",
    cloneVoiceId: "",
    cloneVoiceLabel: "",
    mood: "neutral" as TtsMood,
    style: "conversational" as TtsStyle,
    speed: 1,
    outputFormat: "mp3" as TtsOutputFormat,
  });

  const currentPlan = getActiveSubscriptionPlan(subscription);
  const hasAccess = canAccessFeature(currentPlan, "hasTextToSpeech");
  const hasVoiceCloneAccess = canAccessFeature(currentPlan, "hasVoiceClone");
  const activeVoiceMode = hasVoiceCloneAccess ? formData.voiceMode : "preset";
  const presetVoiceOptions = useMemo(
    () => availableVoices.filter((voice) => !isCustomTextToSpeechVoice(voice)),
    [availableVoices]
  );
  const cloneVoiceOptions = useMemo(
    () => availableVoices.filter((voice) => isCustomTextToSpeechVoice(voice)),
    [availableVoices]
  );
  const ownedVoiceOptions = useMemo(
    () => cloneVoiceOptions.filter((voice) => voice.isOwner),
    [cloneVoiceOptions]
  );
  const selectablePresetVoices =
    presetVoiceOptions.length > 0 ? presetVoiceOptions : availableVoices;
  const hasListedCloneVoices = cloneVoiceOptions.length > 0;
  const selectedPresetVoice =
    selectablePresetVoices.find((voice) => voice.id === formData.voiceId) ??
    selectablePresetVoices[0] ??
    TEXT_TO_SPEECH_VOICES.find((voice) => voice.id === formData.voiceId) ??
    TEXT_TO_SPEECH_VOICES[0] ??
    null;
  const selectedCloneVoice =
    cloneVoiceOptions.find((voice) => voice.id === formData.cloneVoiceId) ??
    cloneVoiceOptions[0] ??
    null;
  const selectedOwnedVoice =
    ownedVoiceOptions.find((voice) => voice.id === selectedOwnedVoiceId) ??
    ownedVoiceOptions[0] ??
    null;
  const selectedVoice = activeVoiceMode === "clone" ? selectedCloneVoice : selectedPresetVoice;
  const resolvedVoiceId =
    activeVoiceMode === "clone"
      ? (selectedCloneVoice?.id ?? formData.cloneVoiceId.trim())
      : (selectedPresetVoice?.id ?? formData.voiceId);
  const resolvedVoiceLabel =
    activeVoiceMode === "clone"
      ? ((selectedCloneVoice?.label ?? formData.cloneVoiceLabel.trim()) || "Custom Voice Clone")
      : (selectedPresetVoice?.label ?? "");
  const charCount = formData.text.length;
  const estimatedCredits = calculateTextToSpeechCredits(charCount);
  const exceedsLimit = charCount > TTS_MAX_CHARACTERS;
  const canSubmit =
    Boolean(formData.text.trim()) &&
    !exceedsLimit &&
    resolvedVoiceId.length > 0 &&
    ttsConfigured &&
    !isGenerating;

  const getVoiceLabFormFromVoice = useCallback((voice: TextToSpeechVoice): VoiceLabFormState => ({
    name: voice.label,
    description: voice.description || "",
    language: voice.language || "",
    accent: voice.accent || "",
    gender: voice.gender || "",
    age: voice.age || "",
    removeBackgroundNoise: false,
  }), []);

  const createVoiceSampleId = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const formatSampleSize = useCallback((size: number) => {
    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const getAudioExtension = useCallback((mimeType: string) => {
    const normalized = mimeType.toLowerCase();
    if (normalized.includes("mpeg")) return "mp3";
    if (normalized.includes("wav")) return "wav";
    if (normalized.includes("ogg")) return "ogg";
    if (normalized.includes("mp4") || normalized.includes("aac")) return "m4a";
    return "webm";
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!userId || !hasAccess) {
      autoLoadedKeyRef.current = null;
      historyUnavailableRef.current = false;
      setTtsConfigured(true);
    }
  }, [userId, hasAccess]);

  const validateSession = useCallback(async (candidate: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
    if (!candidate?.access_token) return null;

    const { data, error } = await supabase.auth.getUser(candidate.access_token);
    if (error || !data.user) {
      console.warn("Rejected invalid auth session:", error?.message ?? "Unknown auth error");
      return null;
    }

    return candidate;
  }, []);

  const getSessionWithRefresh = async (forceRefresh = false) => {
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
      if (!forceRefresh && !shouldRefresh) {
        const validatedSession = await validateSession(session);
        if (validatedSession) return validatedSession;
      }
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("Auth session refresh failed:", refreshError.message);
      await supabase.auth.signOut({ scope: "local" });
      return null;
    }
    if (refreshed.session?.access_token) {
      const validatedSession = await validateSession(refreshed.session);
      if (validatedSession) return validatedSession;
    }

    await supabase.auth.signOut({ scope: "local" });
    return null;
  };

  const isMissingTtsRelationError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const typedError = error as {
      code?: string;
      message?: string;
      details?: string;
    };
    const message = `${typedError.message ?? ""} ${typedError.details ?? ""}`.toLowerCase();

    return (
      typedError.code === "PGRST205" ||
      message.includes("tts_generations") ||
      message.includes("schema cache") ||
      message.includes("relation") && message.includes("does not exist")
    );
  };

  const normalizeFunctionError = useCallback(async (error: unknown) => {
    if (!error || typeof error !== "object") return null;
    const typedError = error as {
      message?: string;
      context?: unknown;
      status?: number;
    };
    const message = typedError.message?.toLowerCase() ?? "";

    if (message.includes("failed to fetch") || message.includes("failed to send a request")) {
      return "The text to speech service is unavailable. Deploy the required TTS edge functions and verify their CORS setup.";
    }

    const responseLike = typedError.context as
      | {
          body?: unknown;
          clone?: () => Response;
          json?: () => Promise<unknown>;
          text?: () => Promise<string>;
        }
      | undefined;

    if (responseLike && typeof responseLike === "object" && typeof responseLike.clone === "function") {
      const clonedResponse = responseLike.clone();

      try {
        const parsed = await clonedResponse.json();
        if (parsed && typeof parsed === "object") {
          const parsedBody = parsed as { error?: string; message?: string };
          return parsedBody.error || parsedBody.message || typedError.message || null;
        }
        if (typeof parsed === "string") {
          return parsed || typedError.message || null;
        }
      } catch {
        // Fall back to reading plain text below.
      }

      try {
        const text = await clonedResponse.text();
        if (text) {
          try {
            const parsed = JSON.parse(text) as { error?: string; message?: string };
            return parsed.error || parsed.message || text;
          } catch {
            return text;
          }
        }
      } catch {
        // Fall through to the remaining parsing paths.
      }
    }

    const rawBody = responseLike?.body;

    if (typeof rawBody === "string") {
      try {
        const parsed = JSON.parse(rawBody);
        return parsed?.error || parsed?.message || typedError.message;
      } catch {
        return rawBody || typedError.message;
      }
    }

    if (rawBody && typeof rawBody === "object") {
      const parsed = rawBody as { error?: string; message?: string };
      return parsed.error || parsed.message || typedError.message;
    }

    return typedError.message || null;
  }, []);

  useEffect(() => {
    setFormData((previous) => {
      let next = previous;

      if (
        selectablePresetVoices.length > 0 &&
        !selectablePresetVoices.some((voice) => voice.id === previous.voiceId)
      ) {
        next = {
          ...next,
          voiceId: selectablePresetVoices[0].id,
        };
      }

      if (
        cloneVoiceOptions.length > 0 &&
        !cloneVoiceOptions.some((voice) => voice.id === previous.cloneVoiceId)
      ) {
        next = {
          ...next,
          cloneVoiceId: cloneVoiceOptions[0].id,
          cloneVoiceLabel: "",
        };
      }

      return next === previous ? previous : next;
    });
  }, [selectablePresetVoices, cloneVoiceOptions]);

  useEffect(() => {
    if (ownedVoiceOptions.length === 0) {
      setSelectedOwnedVoiceId("");
      setUpdateVoiceForm(EMPTY_VOICE_LAB_FORM);
      setUpdateVoiceSamples([]);
      return;
    }

    setSelectedOwnedVoiceId((previous) => {
      if (previous && ownedVoiceOptions.some((voice) => voice.id === previous)) {
        return previous;
      }

      const fallbackVoice = ownedVoiceOptions[0];
      setUpdateVoiceForm(getVoiceLabFormFromVoice(fallbackVoice));
      setUpdateVoiceSamples([]);
      return fallbackVoice.id;
    });
  }, [getVoiceLabFormFromVoice, ownedVoiceOptions]);

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
  }, []);

  const appendVoiceSamples = useCallback((
    mode: VoiceLabMode,
    incomingFiles: File[],
    source: VoiceLabSample["source"]
  ) => {
    const audioFiles = incomingFiles.filter((file) => file.type.startsWith("audio/") || !file.type);
    const skippedCount = incomingFiles.length - audioFiles.length;

    if (skippedCount > 0) {
      toast({
        title: "Skipped unsupported files",
        description: "Only audio files can be used to train a voice.",
        variant: "destructive",
      });
    }

    const setSamples = mode === "create" ? setCreateVoiceSamples : setUpdateVoiceSamples;
    const currentSamples = mode === "create" ? createVoiceSamples : updateVoiceSamples;
    const remainingSlots = Math.max(0, TTS_VOICE_SAMPLE_LIMIT - currentSamples.length);
    const nextSamples = audioFiles.slice(0, remainingSlots).map((file) => ({
      id: createVoiceSampleId(),
      file,
      source,
    }));

    if (audioFiles.length > remainingSlots) {
      toast({
        title: "Sample limit reached",
        description: `Keep up to ${TTS_VOICE_SAMPLE_LIMIT} sample files per request.`,
        variant: "destructive",
      });
    }

    setSamples((previous) => [...previous, ...nextSamples]);
  }, [createVoiceSampleId, createVoiceSamples, toast, updateVoiceSamples]);

  const removeVoiceSample = useCallback((mode: VoiceLabMode, sampleId: string) => {
    const setSamples = mode === "create" ? setCreateVoiceSamples : setUpdateVoiceSamples;
    setSamples((previous) => previous.filter((sample) => sample.id !== sampleId));
  }, []);

  const handleVoiceFileSelection = useCallback((
    mode: VoiceLabMode,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    appendVoiceSamples(mode, files, "upload");
    event.target.value = "";
  }, [appendVoiceSamples]);

  const stopActiveRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }, []);

  const startVoiceRecording = useCallback(async (mode: VoiceLabMode) => {
    if (recordingTarget) {
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast({
        title: "Recording unavailable",
        description: "This browser does not support microphone recording for voice samples.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((mimeType) =>
        typeof MediaRecorder.isTypeSupported === "function" ? MediaRecorder.isTypeSupported(mimeType) : false
      );
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      setRecordingTarget(mode);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setRecordingTarget(null);

        toast({
          title: "Recording failed",
          description: "Unable to capture microphone audio right now.",
          variant: "destructive",
        });
      };

      recorder.onstop = () => {
        const chunks = [...recordingChunksRef.current];
        const mimeType = recorder.mimeType || chunks[0]?.type || "audio/webm";

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setRecordingTarget(null);

        if (chunks.length === 0) {
          return;
        }

        const extension = getAudioExtension(mimeType);
        const file = new File(
          chunks,
          `voice-sample-${Date.now()}.${extension}`,
          { type: mimeType }
        );

        appendVoiceSamples(mode, [file], "recording");
        toast({
          title: "Recording added",
          description: "The captured sample is ready to upload with this voice.",
        });
      };

      recorder.start();
    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      recordingChunksRef.current = [];
      setRecordingTarget(null);

      toast({
        title: "Microphone unavailable",
        description:
          error instanceof Error
            ? error.message
            : "Grant microphone access to record a sample.",
        variant: "destructive",
      });
    }
  }, [appendVoiceSamples, getAudioExtension, recordingTarget, toast]);

  const buildVoiceManagementPayload = useCallback((
    formState: VoiceLabFormState,
    samples: VoiceLabSample[],
    voiceId?: string
  ) => {
    const payload = new FormData();
    if (voiceId) {
      payload.append("voiceId", voiceId);
    }

    payload.append("name", formState.name.trim());
    payload.append("description", formState.description.trim());
    payload.append("remove_background_noise", formState.removeBackgroundNoise ? "true" : "false");

    const labels = Object.entries({
      language: formState.language.trim(),
      accent: formState.accent.trim(),
      gender: formState.gender.trim(),
      age: formState.age.trim(),
    }).reduce<Record<string, string>>((result, [key, value]) => {
      if (value) {
        result[key] = value;
      }
      return result;
    }, {});

    if (Object.keys(labels).length > 0) {
      payload.append("labels", JSON.stringify(labels));
    }

    samples.forEach((sample) => {
      payload.append("files", sample.file, sample.file.name);
    });

    return payload;
  }, []);

  const useVoiceInGenerator = useCallback((voice: TextToSpeechVoice) => {
    setFormData((previous) => ({
      ...previous,
      voiceMode: "clone",
      cloneVoiceId: voice.id,
      cloneVoiceLabel: voice.label,
    }));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const fetchCredits = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("user_tokens")
      .select("ai_credits_balance, ai_credits_used")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setUserCredits(data);
    }
  }, [userId]);

  const invokeWithAuthRetry = useCallback(
    async <T,>(
      functionName: string,
      body: unknown,
      options?: { forceSessionRefresh?: boolean }
    ) => {
      const invokeWithToken = (accessToken: string) =>
        supabase.functions.invoke<T>(functionName, {
          body,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });

      const session = await getSessionWithRefresh(options?.forceSessionRefresh ?? false);
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      let result = await invokeWithToken(session.access_token);

      if (!result.error) {
        return result;
      }

      const status = (result.error as { context?: { status?: number }; status?: number })?.context?.status ??
        (result.error as { status?: number })?.status;
      const message = result.error.message?.toLowerCase() ?? "";
      const isAuthError =
        status === 401 ||
        message.includes("401") ||
        message.includes("invalid jwt") ||
        message.includes("unauthorized");

      if (!isAuthError) {
        return result;
      }

      const refreshed = await getSessionWithRefresh(true);
      if (!refreshed?.access_token || refreshed.access_token === session.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      result = await invokeWithToken(refreshed.access_token);
      return result;
    },
    []
  );

  const invokeMultipartFunctionWithAuthRetry = useCallback(
    async <T,>(functionName: string, body: FormData) => {
      const callWithToken = async (accessToken: string) => {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body,
          }
        );

        const raw = await response.text();
        let parsed: unknown = null;

        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
        }

        if (!response.ok) {
          const message =
            typeof parsed === "object" && parsed !== null
              ? ((parsed as { error?: string; message?: string }).error ||
                (parsed as { error?: string; message?: string }).message)
              : null;

          return {
            data: null as T | null,
            error: message || raw || `Request failed with status ${response.status}`,
            status: response.status,
          };
        }

        return {
          data: (parsed as T) ?? null,
          error: null as string | null,
          status: response.status,
        };
      };

      const session = await getSessionWithRefresh(false);
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      let result = await callWithToken(session.access_token);
      if (result.status !== 401) {
        return result;
      }

      const refreshed = await getSessionWithRefresh(true);
      if (!refreshed?.access_token || refreshed.access_token === session.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      result = await callWithToken(refreshed.access_token);
      return result;
    },
    []
  );

  const fetchVoices = useCallback(async (forceSessionRefresh = false) => {
    if (!userId || !hasAccess) return;

    setVoicesLoading(true);
    setVoicesError(null);

    try {
      const { data, error } = await invokeWithAuthRetry<ListTtsVoicesResponse>("list-tts-voices", {}, {
        forceSessionRefresh,
      });

      if (error) {
        throw new Error(await normalizeFunctionError(error) || "Failed to load ElevenLabs voices");
      }

      setTtsConfigured(data?.configured ?? true);

      const voices = Array.isArray(data?.voices) ? data.voices : [];
      const warning = data?.warning?.trim() || null;
      if (voices.length === 0) {
        setAvailableVoices(TEXT_TO_SPEECH_VOICES);
        setVoicesError(
          warning || "ElevenLabs returned no voices. Showing fallback presets instead."
        );
        return;
      }

      setAvailableVoices(voices);
      setVoicesError(warning);
    } catch (error) {
      setAvailableVoices(TEXT_TO_SPEECH_VOICES);
      setTtsConfigured(
        !(error instanceof Error && error.message.toLowerCase().includes("not configured"))
      );
      setVoicesError(
        error instanceof Error
          ? error.message
          : "Unable to load ElevenLabs voices. Showing fallback presets instead."
      );
    } finally {
      setVoicesLoading(false);
    }
  }, [userId, hasAccess, invokeWithAuthRetry, normalizeFunctionError]);

  const handleCreateVoice = useCallback(async () => {
    if (!ttsConfigured) {
      toast({
        title: "Voice cloning is not configured",
        description: "Add the ELEVEN_LABS_API secret in Supabase before creating custom voices.",
        variant: "destructive",
      });
      return;
    }

    if (!createVoiceForm.name.trim()) {
      toast({
        title: "Voice name required",
        description: "Name the voice before uploading samples.",
        variant: "destructive",
      });
      return;
    }

    if (createVoiceSamples.length === 0) {
      toast({
        title: "Samples required",
        description: "Add at least one recorded or uploaded audio sample.",
        variant: "destructive",
      });
      return;
    }

    setVoiceActionInFlight("create");

    try {
      const { data, error } = await invokeMultipartFunctionWithAuthRetry<CreateTtsVoiceResponse>(
        "create-tts-voice",
        buildVoiceManagementPayload(createVoiceForm, createVoiceSamples)
      );

      if (error) {
        throw new Error(error);
      }

      if (data?.voiceId) {
        setSelectedOwnedVoiceId(data.voiceId);
        setFormData((previous) => ({
          ...previous,
          voiceMode: "clone",
          cloneVoiceId: data.voiceId ?? previous.cloneVoiceId,
          cloneVoiceLabel: createVoiceForm.name.trim(),
        }));
      }

      setCreateVoiceForm(EMPTY_VOICE_LAB_FORM);
      setCreateVoiceSamples([]);
      setVoiceLabMode("update");
      await fetchVoices(true);

      toast({
        title: "Voice clone created",
        description: data?.requiresVerification
          ? "ElevenLabs created the voice and marked it for verification."
          : "Your new voice is ready to use in generation.",
      });
    } catch (error) {
      toast({
        title: "Voice creation failed",
        description:
          error instanceof Error ? error.message : "Unable to create a custom voice right now.",
        variant: "destructive",
      });
    } finally {
      setVoiceActionInFlight(null);
    }
  }, [
    buildVoiceManagementPayload,
    createVoiceForm,
    createVoiceSamples,
    fetchVoices,
    invokeMultipartFunctionWithAuthRetry,
    toast,
    ttsConfigured,
  ]);

  const handleUpdateVoice = useCallback(async () => {
    if (!selectedOwnedVoice) {
      toast({
        title: "No owned voice selected",
        description: "Create a custom voice first, then use this tab to update it.",
        variant: "destructive",
      });
      return;
    }

    if (!ttsConfigured) {
      toast({
        title: "Voice cloning is not configured",
        description: "Add the ELEVEN_LABS_API secret in Supabase before updating voices.",
        variant: "destructive",
      });
      return;
    }

    if (!updateVoiceForm.name.trim()) {
      toast({
        title: "Voice name required",
        description: "Name the voice before saving changes.",
        variant: "destructive",
      });
      return;
    }

    setVoiceActionInFlight("update");

    try {
      const { error } = await invokeMultipartFunctionWithAuthRetry<UpdateTtsVoiceResponse>(
        "update-tts-voice",
        buildVoiceManagementPayload(updateVoiceForm, updateVoiceSamples, selectedOwnedVoice.id)
      );

      if (error) {
        throw new Error(error);
      }

      setUpdateVoiceSamples([]);
      setFormData((previous) =>
        previous.cloneVoiceId === selectedOwnedVoice.id
          ? { ...previous, cloneVoiceLabel: updateVoiceForm.name.trim() }
          : previous
      );
      await fetchVoices(true);

      toast({
        title: "Voice updated",
        description: "The selected custom voice was updated in ElevenLabs.",
      });
    } catch (error) {
      toast({
        title: "Voice update failed",
        description:
          error instanceof Error ? error.message : "Unable to update this custom voice right now.",
        variant: "destructive",
      });
    } finally {
      setVoiceActionInFlight(null);
    }
  }, [
    buildVoiceManagementPayload,
    fetchVoices,
    invokeMultipartFunctionWithAuthRetry,
    selectedOwnedVoice,
    toast,
    ttsConfigured,
    updateVoiceForm,
    updateVoiceSamples,
  ]);

  const fetchHistory = useCallback(async () => {
    if (!userId || historyUnavailableRef.current) return;

    const { data, error } = await supabase
      .from("tts_generations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      if (isMissingTtsRelationError(error)) {
        historyUnavailableRef.current = true;
        setHistory([]);
        setHistoryStatusMessage(
          "Text to speech history is unavailable until the TTS database migration is applied."
        );
        return;
      }

      console.error("Error fetching TTS history:", error);
      setHistoryStatusMessage("Unable to load recent generations right now.");
      return;
    }

    setHistoryStatusMessage(null);
    setHistory((data ?? []) as TextToSpeechGeneration[]);
  }, [userId]);

  useEffect(() => {
    if (!userId || !hasAccess) return;

    const autoLoadKey = `${userId}:${currentPlan ?? "none"}`;
    if (autoLoadedKeyRef.current === autoLoadKey) return;

    autoLoadedKeyRef.current = autoLoadKey;
    void Promise.all([fetchCredits(), fetchHistory(), fetchVoices(false)]);
  }, [userId, hasAccess, currentPlan, fetchCredits, fetchHistory, fetchVoices]);

  const getGenerationFilename = useCallback((item: TextToSpeechGeneration) => {
    const voiceLabel = (item.voice_label || getTextToSpeechVoiceLabel(item.voice_id))
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return `${voiceLabel || "speech"}-${item.id}.${item.output_format}`;
  }, []);

  const pauseOtherAudio = useCallback((activeId: string) => {
    Object.entries(audioRefs.current).forEach(([generationId, audio]) => {
      if (generationId !== activeId && audio && !audio.paused) {
        audio.pause();
      }
    });
  }, []);

  const handleTogglePlayback = useCallback(async (item: TextToSpeechGeneration) => {
    if (!item.audio_url) return;

    const audio = audioRefs.current[item.id];
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      setPlayingGenerationId(null);
      return;
    }

    pauseOtherAudio(item.id);

    try {
      await audio.play();
      setPlayingGenerationId(item.id);
    } catch (error) {
      toast({
        title: "Playback failed",
        description:
          error instanceof Error ? error.message : "Unable to play this generation right now.",
        variant: "destructive",
      });
    }
  }, [pauseOtherAudio, toast]);

  const handleDownloadGeneration = useCallback(async (item: TextToSpeechGeneration) => {
    if (!item.audio_url) return;

    setDownloadingGenerationId(item.id);

    try {
      const response = await fetch(item.audio_url);
      if (!response.ok) {
        throw new Error("Unable to download this generation right now.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = getGenerationFilename(item);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast({
        title: "Download failed",
        description:
          error instanceof Error ? error.message : "Unable to download this generation right now.",
        variant: "destructive",
      });
    } finally {
      setDownloadingGenerationId(null);
    }
  }, [getGenerationFilename, toast]);

  const handleUpdateGeneration = useCallback((item: TextToSpeechGeneration) => {
    const matchedVoice =
      availableVoices.find((voice) => voice.id === item.voice_id) ??
      TEXT_TO_SPEECH_VOICES.find((voice) => voice.id === item.voice_id) ??
      null;
    const shouldUseClone = matchedVoice ? isCustomTextToSpeechVoice(matchedVoice) : false;

    setFormData({
      text: item.text_input,
      voiceMode: shouldUseClone ? "clone" : "preset",
      voiceId: shouldUseClone ? (selectedPresetVoice?.id ?? TEXT_TO_SPEECH_VOICES[0]?.id ?? "") : item.voice_id,
      cloneVoiceId: shouldUseClone ? item.voice_id : "",
      cloneVoiceLabel: shouldUseClone ? item.voice_label : "",
      mood: item.mood,
      style: item.style,
      speed: clampTextToSpeechSpeed(item.speed),
      outputFormat: item.output_format,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => textAreaRef.current?.focus(), 250);

    toast({
      title: "Generation loaded",
      description: "Update the text or settings, then generate a new version.",
    });
  }, [availableVoices, selectedPresetVoice, toast]);

  const handleDeleteGeneration = useCallback(async () => {
    if (!generationPendingDelete || !userId) return;

    setDeletingGenerationId(generationPendingDelete.id);

    try {
      if (generationPendingDelete.audio_path) {
        const { error: storageError } = await supabase.storage
          .from("tts-audio")
          .remove([generationPendingDelete.audio_path]);

        if (storageError) {
          console.error("Error deleting TTS audio:", storageError);
        }
      }

      const { error } = await supabase
        .from("tts_generations")
        .delete()
        .eq("id", generationPendingDelete.id)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      if (playingGenerationId === generationPendingDelete.id) {
        setPlayingGenerationId(null);
      }

      setHistory((previous) =>
        previous.filter((generation) => generation.id !== generationPendingDelete.id)
      );
      setHistoryStatusMessage(null);
      toast({
        title: "Generation deleted",
        description: "The selected generation has been removed from your history.",
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description:
          error instanceof Error ? error.message : "Unable to delete this generation right now.",
        variant: "destructive",
      });
    } finally {
      setDeletingGenerationId(null);
      setGenerationPendingDelete(null);
    }
  }, [generationPendingDelete, playingGenerationId, toast, userId]);

  const handleGenerate = async () => {
    if (!userId || !hasAccess) return;

    if (!formData.text.trim()) {
      toast({
        title: "Text required",
        description: "Enter text to convert into speech.",
        variant: "destructive",
      });
      return;
    }

    if (exceedsLimit) {
      toast({
        title: "Text too long",
        description: `Text to speech supports up to ${TTS_MAX_CHARACTERS.toLocaleString()} characters per generation.`,
        variant: "destructive",
      });
      return;
    }

    if (!resolvedVoiceId) {
      toast({
        title: activeVoiceMode === "clone" ? "Voice clone ID required" : "Voice required",
        description:
          activeVoiceMode === "clone"
            ? "Enter a voice clone ID from the configured ElevenLabs workspace."
            : "Choose a voice before generating speech.",
        variant: "destructive",
      });
      return;
    }

    if (userCredits.ai_credits_balance < estimatedCredits) {
      toast({
        title: "Insufficient AI credits",
        description: `This generation needs ${estimatedCredits} credits. Please add more credits or shorten the text.`,
        variant: "destructive",
      });
      return;
    }

    if (!ttsConfigured) {
      toast({
        title: "Text to speech is not configured",
        description: "Add the ELEVEN_LABS_API secret in Supabase before generating audio.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await invokeWithAuthRetry<{
        generation: TextToSpeechGeneration;
        remainingCredits: number;
      }>("generate-speech", {
          text: formData.text,
          voiceId: resolvedVoiceId,
          voiceLabel: resolvedVoiceLabel || undefined,
          mood: formData.mood,
          style: formData.style,
          speed: formData.speed,
          outputFormat: formData.outputFormat,
      });

      if (error) {
        throw new Error(await normalizeFunctionError(error) || "Failed to generate speech");
      }

      if (!data?.generation) {
        throw new Error("No audio was returned");
      }

      setHistoryStatusMessage(null);
      setHistory((prev) => [data.generation, ...prev.filter((item) => item.id !== data.generation.id)]);
      setUserCredits((prev) => ({
        ...prev,
        ai_credits_balance: data.remainingCredits ?? prev.ai_credits_balance - estimatedCredits,
        ai_credits_used: prev.ai_credits_used + data.generation.credits_used,
      }));

      toast({
        title: "Speech generated",
        description: `${data.generation.credits_used} AI credits used for this request.`,
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to generate speech. Make sure the TTS migration and generate-speech function are deployed.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOwnedVoiceSelection = useCallback((voiceId: string) => {
    setSelectedOwnedVoiceId(voiceId);
    const voice = ownedVoiceOptions.find((item) => item.id === voiceId);
    if (!voice) return;

    setUpdateVoiceForm(getVoiceLabFormFromVoice(voice));
    setUpdateVoiceSamples([]);
  }, [getVoiceLabFormFromVoice, ownedVoiceOptions]);

  const handleDownloadVoiceSample = useCallback((sample: VoiceLabSample) => {
    const objectUrl = URL.createObjectURL(sample.file);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = sample.file.name || `voice-sample-${sample.id}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }, []);

  const renderVoiceSamples = useCallback((mode: VoiceLabMode, samples: VoiceLabSample[], emptyMessage: string) => {
    if (samples.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {samples.map((sample) => (
          <div
            key={sample.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileAudio className="h-4 w-4 text-primary" />
                <span className="truncate">{sample.file.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {sample.source === "recording" ? "Recorded in browser" : "Uploaded file"} | {formatSampleSize(sample.file.size)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDownloadVoiceSample(sample)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeVoiceSample(mode, sample.id)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }, [formatSampleSize, handleDownloadVoiceSample, removeVoiceSample]);

  const usagePercentage = useMemo(() => {
    if (!subscription || !currentPlan) return 0;
    const included = subscription ? userCredits.ai_credits_balance + userCredits.ai_credits_used : 0;
    if (included <= 0) return 0;
    return Math.min((userCredits.ai_credits_balance / included) * 100, 100);
  }, [currentPlan, subscription, userCredits]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex">
        <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <SubscriptionRequiredState
            title={currentPlan ? "Upgrade to unlock Text to Speech" : "Active subscription required"}
            description={
              currentPlan
                ? "Text to speech and voice cloning are available on Pro and Advanced plans."
                : "Text to speech and voice cloning become available after you activate a Pro or Advanced plan."
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 transition-all duration-300">
        <header className="hidden lg:block sticky top-0 z-40 glass-strong border-b border-border px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                  <AudioLines className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold">Text to Speech</h1>
                  <p className="text-sm text-muted-foreground">
                    Generate studio-style voiceovers with preset voices or your voice clones
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold">{userCredits.ai_credits_balance.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">AI credits</span>
              </div>
              <div className="mt-2 h-1.5 w-32 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <div className="space-y-6">
            <div className="grid xl:grid-cols-[1.15fr,0.85fr] gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  Generate Audio
                </CardTitle>
                <CardDescription>
                  Preset voices and voice clones both use AI credits by text length: 80 up to
                  3,000 chars, 120 up to 6,000, 160 up to 9,000, and 180 up to 12,000.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="tts-text">Text</Label>
                    <Badge variant={exceedsLimit ? "destructive" : "outline"}>
                      {charCount.toLocaleString()} / {TTS_MAX_CHARACTERS.toLocaleString()}
                    </Badge>
                  </div>
                  <Textarea
                    id="tts-text"
                    ref={textAreaRef}
                    placeholder="Paste the script, intro, hook, or narration you want to turn into speech."
                    value={formData.text}
                    rows={12}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        text: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Voice Source</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void fetchVoices(true)}
                        disabled={voicesLoading}
                        className="h-8 px-2"
                      >
                        {voicesLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Refresh
                      </Button>
                    </div>
                    <Select
                      value={activeVoiceMode}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          voiceMode: value as VoiceInputMode,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preset">Preset Voice</SelectItem>
                        {hasVoiceCloneAccess && <SelectItem value="clone">Voice Clone</SelectItem>}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {activeVoiceMode === "clone"
                        ? hasListedCloneVoices
                          ? `Choose from ${cloneVoiceOptions.length} ElevenLabs workspace or cloned voices.`
                          : "No cloned voices were returned by ElevenLabs. You can still paste a voice ID manually."
                        : `Choose from ${selectablePresetVoices.length} ElevenLabs voice${selectablePresetVoices.length === 1 ? "" : "s"}.`}
                    </p>
                    {voicesError && (
                      <p className="text-xs text-amber-600 dark:text-amber-300">{voicesError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{activeVoiceMode === "clone" ? "Voice Clone" : "Voice"}</Label>
                    {activeVoiceMode === "clone" ? (
                      <div className="space-y-3">
                        {hasListedCloneVoices ? (
                          <>
                            <Select
                              value={selectedCloneVoice?.id ?? formData.cloneVoiceId}
                              onValueChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  cloneVoiceId: value,
                                  cloneVoiceLabel: "",
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a cloned voice" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Workspace Voices</SelectLabel>
                                  {cloneVoiceOptions.map((voice) => (
                                    <SelectItem key={voice.id} value={voice.id}>
                                      {voice.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {selectedCloneVoice?.description || "Workspace and cloned voices synced from ElevenLabs."}
                            </p>
                          </>
                        ) : (
                          <>
                            <Input
                              placeholder="Voice clone ID"
                              value={formData.cloneVoiceId}
                              onChange={(event) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  cloneVoiceId: event.target.value,
                                }))
                              }
                            />
                            <Input
                              placeholder="Optional label, e.g. My Brand Voice"
                              value={formData.cloneVoiceLabel}
                              onChange={(event) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  cloneVoiceLabel: event.target.value,
                                }))
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              The label is stored in your history so custom voices are easier to reuse.
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <Select
                          value={selectedPresetVoice?.id ?? formData.voiceId}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              voiceId: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an ElevenLabs voice" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Voice Library</SelectLabel>
                              {selectablePresetVoices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {selectedPresetVoice?.description || "ElevenLabs voice selected from the synced library."}
                        </p>
                      </>
                    )}
                    {selectedVoice && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {selectedVoice.category && (
                            <Badge variant="outline" className="capitalize">
                              {selectedVoice.category}
                            </Badge>
                          )}
                          {selectedVoice.gender && (
                            <Badge variant="outline" className="capitalize">
                              {selectedVoice.gender}
                            </Badge>
                          )}
                          {selectedVoice.accent && (
                            <Badge variant="outline" className="capitalize">
                              {selectedVoice.accent}
                            </Badge>
                          )}
                          {selectedVoice.language && (
                            <Badge variant="outline" className="capitalize">
                              {selectedVoice.language}
                            </Badge>
                          )}
                          {selectedVoice.age && (
                            <Badge variant="outline" className="capitalize">
                              {selectedVoice.age}
                            </Badge>
                          )}
                          {selectedVoice.isOwner && (
                            <Badge variant="outline">
                              Owned
                            </Badge>
                          )}
                        </div>
                        {selectedVoice.previewUrl ? (
                          <audio controls className="w-full" src={selectedVoice.previewUrl} />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            ElevenLabs does not provide a preview clip for this voice.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Output Format</Label>
                    <Select
                      value={formData.outputFormat}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          outputFormat: value as TtsOutputFormat,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TTS_OUTPUT_FORMATS.map((format) => (
                          <SelectItem key={format} value={format}>
                            {format.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Mood</Label>
                    <Select
                      value={formData.mood}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          mood: value as TtsMood,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TTS_MOODS.map((mood) => (
                          <SelectItem key={mood} value={mood}>
                            {mood.charAt(0).toUpperCase() + mood.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Style</Label>
                    <Select
                      value={formData.style}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          style: value as TtsStyle,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TTS_STYLES.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style.charAt(0).toUpperCase() + style.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Speed</Label>
                    <Badge variant="outline">{formData.speed.toFixed(2)}x</Badge>
                  </div>
                  <Slider
                    value={[formData.speed]}
                    min={0.7}
                    max={1.2}
                    step={0.01}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        speed: clampTextToSpeechSpeed(value[0] ?? 1),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher speed works well for short hooks; slower reads are better for narration.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated cost</p>
                    <p className="text-2xl font-bold text-primary">{estimatedCredits} credits</p>
                    {!ttsConfigured && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                        Add the `ELEVEN_LABS_API` secret in Supabase to enable generation.
                      </p>
                    )}
                  </div>
                  <Button onClick={handleGenerate} disabled={!canSubmit} size="lg">
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Volume2 className="mr-2 h-4 w-4" />
                        Generate Speech
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Generations</CardTitle>
                <CardDescription>
                  Your latest text-to-speech outputs stay here for replay and download.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {historyStatusMessage && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                    {historyStatusMessage}
                  </div>
                )}
                {history.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center">
                    <AudioLines className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      Generated speech will appear here once you create your first clip.
                    </p>
                  </div>
                ) : (
                  history.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{item.voice_label}</Badge>
                            <Badge variant="outline">
                              {item.mood.charAt(0).toUpperCase() + item.mood.slice(1)}
                            </Badge>
                            <Badge variant="outline">
                              {item.output_format.toUpperCase()}
                            </Badge>
                            <Badge
                              variant={item.status === "failed" ? "destructive" : "default"}
                              className={item.status === "completed" ? "bg-green-500/10 text-green-600" : ""}
                            >
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {item.text_input}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-primary">{item.credits_used}</p>
                          <p className="text-xs text-muted-foreground">credits</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.char_count.toLocaleString()} chars</span>
                        <span>|</span>
                        <span>{item.style}</span>
                        <span>|</span>
                        <span>{item.speed.toFixed(2)}x</span>
                        <span>|</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateGeneration(item)}
                        >
                          <PencilLine className="mr-2 h-4 w-4" />
                          Update
                        </Button>

                        {item.audio_url && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleTogglePlayback(item)}
                            >
                              {playingGenerationId === item.id ? (
                                <Pause className="mr-2 h-4 w-4" />
                              ) : (
                                <Play className="mr-2 h-4 w-4" />
                              )}
                              {playingGenerationId === item.id ? "Pause" : "Play"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleDownloadGeneration(item)}
                              disabled={downloadingGenerationId === item.id}
                            >
                              {downloadingGenerationId === item.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="mr-2 h-4 w-4" />
                              )}
                              Download
                            </Button>
                          </>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setGenerationPendingDelete(item)}
                          disabled={deletingGenerationId === item.id}
                        >
                          {deletingGenerationId === item.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      </div>

                      {item.audio_url ? (
                        <div className="mt-4 space-y-3">
                          <audio
                            controls
                            className="w-full"
                            src={item.audio_url}
                            ref={(node) => {
                              audioRefs.current[item.id] = node;
                            }}
                            onPlay={() => {
                              pauseOtherAudio(item.id);
                              setPlayingGenerationId(item.id);
                            }}
                            onPause={() => {
                              if (playingGenerationId === item.id) {
                                setPlayingGenerationId(null);
                              }
                            }}
                            onEnded={() => {
                              if (playingGenerationId === item.id) {
                                setPlayingGenerationId(null);
                              }
                            }}
                          />
                        </div>
                      ) : item.error_message ? (
                        <p className="mt-4 text-sm text-destructive">{item.error_message}</p>
                      ) : null}
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-primary" />
                  Voice Lab
                </CardTitle>
                <CardDescription>
                  Clone your own voice, add new samples, and keep your custom models current.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!ttsConfigured && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                    Add the `ELEVEN_LABS_API` secret in Supabase before training or updating custom voices.
                  </div>
                )}

                <Tabs value={voiceLabMode} onValueChange={(value) => setVoiceLabMode(value as VoiceLabMode)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="create">Add Voice</TabsTrigger>
                    <TabsTrigger value="update">Update Voice</TabsTrigger>
                  </TabsList>

                  <TabsContent value="create" className="mt-4">
                    <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="create-voice-name">Voice Name</Label>
                          <Input
                            id="create-voice-name"
                            placeholder="My Brand Narrator"
                            value={createVoiceForm.name}
                            onChange={(event) =>
                              setCreateVoiceForm((previous) => ({
                                ...previous,
                                name: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="create-voice-description">Description</Label>
                          <Textarea
                            id="create-voice-description"
                            rows={4}
                            placeholder="Warm, steady read for tutorials and explainers."
                            value={createVoiceForm.description}
                            onChange={(event) =>
                              setCreateVoiceForm((previous) => ({
                                ...previous,
                                description: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="create-voice-language">Language</Label>
                            <Input
                              id="create-voice-language"
                              placeholder="English"
                              value={createVoiceForm.language}
                              onChange={(event) =>
                                setCreateVoiceForm((previous) => ({
                                  ...previous,
                                  language: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="create-voice-accent">Accent</Label>
                            <Input
                              id="create-voice-accent"
                              placeholder="American"
                              value={createVoiceForm.accent}
                              onChange={(event) =>
                                setCreateVoiceForm((previous) => ({
                                  ...previous,
                                  accent: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="create-voice-gender">Gender</Label>
                            <Input
                              id="create-voice-gender"
                              placeholder="Male, female, non-binary"
                              value={createVoiceForm.gender}
                              onChange={(event) =>
                                setCreateVoiceForm((previous) => ({
                                  ...previous,
                                  gender: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="create-voice-age">Age</Label>
                            <Input
                              id="create-voice-age"
                              placeholder="Adult"
                              value={createVoiceForm.age}
                              onChange={(event) =>
                                setCreateVoiceForm((previous) => ({
                                  ...previous,
                                  age: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                          <div>
                            <Label htmlFor="create-voice-noise" className="text-sm">
                              Remove Background Noise
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Use this when the samples include room noise or hiss.
                            </p>
                          </div>
                          <Switch
                            id="create-voice-noise"
                            checked={createVoiceForm.removeBackgroundNoise}
                            onCheckedChange={(checked) =>
                              setCreateVoiceForm((previous) => ({
                                ...previous,
                                removeBackgroundNoise: checked,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="create-voice-files">Samples</Label>
                          <Input
                            id="create-voice-files"
                            type="file"
                            accept="audio/*"
                            multiple
                            onChange={(event) => handleVoiceFileSelection("create", event)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Add up to {TTS_VOICE_SAMPLE_LIMIT} clips. Mix clean recordings and uploaded files if needed.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {recordingTarget === "create" ? (
                            <Button type="button" variant="outline" onClick={stopActiveRecording}>
                              <Square className="mr-2 h-4 w-4" />
                              Stop Recording
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void startVoiceRecording("create")}
                              disabled={recordingTarget !== null}
                            >
                              <Mic className="mr-2 h-4 w-4" />
                              Record Sample
                            </Button>
                          )}
                          <Badge variant="outline">
                            {createVoiceSamples.length} / {TTS_VOICE_SAMPLE_LIMIT} samples
                          </Badge>
                        </div>

                        {renderVoiceSamples(
                          "create",
                          createVoiceSamples,
                          "Record or upload a clean sample to start cloning this voice."
                        )}

                        <Button
                          type="button"
                          onClick={() => void handleCreateVoice()}
                          disabled={voiceActionInFlight !== null || recordingTarget === "create"}
                        >
                          {voiceActionInFlight === "create" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Create Voice Clone
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="update" className="mt-4">
                    {ownedVoiceOptions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-8 text-center">
                        <Mic className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-4 text-sm text-muted-foreground">
                          Create your first custom voice to add more samples or revise its metadata.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Owned Voice</Label>
                            <Select
                              value={selectedOwnedVoice?.id ?? selectedOwnedVoiceId}
                              onValueChange={handleOwnedVoiceSelection}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select an owned voice" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Your Voices</SelectLabel>
                                  {ownedVoiceOptions.map((voice) => (
                                    <SelectItem key={voice.id} value={voice.id}>
                                      {voice.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <div className="flex flex-wrap gap-2">
                              {selectedOwnedVoice?.category && (
                                <Badge variant="outline" className="capitalize">
                                  {selectedOwnedVoice.category}
                                </Badge>
                              )}
                              {typeof selectedOwnedVoice?.sampleCount === "number" && (
                                <Badge variant="outline">
                                  {selectedOwnedVoice.sampleCount} stored samples
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="update-voice-name">Voice Name</Label>
                            <Input
                              id="update-voice-name"
                              value={updateVoiceForm.name}
                              onChange={(event) =>
                                setUpdateVoiceForm((previous) => ({
                                  ...previous,
                                  name: event.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="update-voice-description">Description</Label>
                            <Textarea
                              id="update-voice-description"
                              rows={4}
                              value={updateVoiceForm.description}
                              onChange={(event) =>
                                setUpdateVoiceForm((previous) => ({
                                  ...previous,
                                  description: event.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="update-voice-language">Language</Label>
                              <Input
                                id="update-voice-language"
                                value={updateVoiceForm.language}
                                onChange={(event) =>
                                  setUpdateVoiceForm((previous) => ({
                                    ...previous,
                                    language: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="update-voice-accent">Accent</Label>
                              <Input
                                id="update-voice-accent"
                                value={updateVoiceForm.accent}
                                onChange={(event) =>
                                  setUpdateVoiceForm((previous) => ({
                                    ...previous,
                                    accent: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="update-voice-gender">Gender</Label>
                              <Input
                                id="update-voice-gender"
                                value={updateVoiceForm.gender}
                                onChange={(event) =>
                                  setUpdateVoiceForm((previous) => ({
                                    ...previous,
                                    gender: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="update-voice-age">Age</Label>
                              <Input
                                id="update-voice-age"
                                value={updateVoiceForm.age}
                                onChange={(event) =>
                                  setUpdateVoiceForm((previous) => ({
                                    ...previous,
                                    age: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                            <div>
                              <Label htmlFor="update-voice-noise" className="text-sm">
                                Remove Background Noise
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Apply this to the new samples included in this update.
                              </p>
                            </div>
                            <Switch
                              id="update-voice-noise"
                              checked={updateVoiceForm.removeBackgroundNoise}
                              onCheckedChange={(checked) =>
                                setUpdateVoiceForm((previous) => ({
                                  ...previous,
                                  removeBackgroundNoise: checked,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="update-voice-files">Add Samples</Label>
                            <Input
                              id="update-voice-files"
                              type="file"
                              accept="audio/*"
                              multiple
                              onChange={(event) => handleVoiceFileSelection("update", event)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Add fresh recordings only when the voice needs more range or cleaner training audio.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {recordingTarget === "update" ? (
                              <Button type="button" variant="outline" onClick={stopActiveRecording}>
                                <Square className="mr-2 h-4 w-4" />
                                Stop Recording
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void startVoiceRecording("update")}
                                disabled={recordingTarget !== null}
                              >
                                <Mic className="mr-2 h-4 w-4" />
                                Record Sample
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => selectedOwnedVoice && useVoiceInGenerator(selectedOwnedVoice)}
                              disabled={!selectedOwnedVoice}
                            >
                              <Volume2 className="mr-2 h-4 w-4" />
                              Use in Generator
                            </Button>
                          </div>

                          {renderVoiceSamples(
                            "update",
                            updateVoiceSamples,
                            "New samples are optional. Save metadata only, or add recordings to strengthen the voice."
                          )}

                          <Button
                            type="button"
                            onClick={() => void handleUpdateVoice()}
                            disabled={voiceActionInFlight !== null || recordingTarget === "update" || !selectedOwnedVoice}
                          >
                            {voiceActionInFlight === "update" ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            Save Voice Changes
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

        <AlertDialog
          open={generationPendingDelete !== null}
          onOpenChange={(open) => {
            if (!open && !deletingGenerationId) {
              setGenerationPendingDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete generation?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the selected generation from recent history. Any stored audio for this
                generation will also be removed when possible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingGenerationId)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDeleteGeneration()}>
                {deletingGenerationId ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default TextToSpeech;

