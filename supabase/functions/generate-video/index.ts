import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deductCreditsWithAmount, refundCredits } from "../_shared/credits.ts";
import { requireMinimumPlan } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COST_PER_10_SECONDS = 30;
const MIN_DURATION_SECONDS = 10;
const MAX_DURATION_SECONDS = 120;
const STYLES = new Set(["cinematic", "documentary", "animated", "realistic", "product", "vertical-short"]);
const VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
const CAPTION_THEMES = new Set(["viral_pop", "minimal", "hormozi", "mrbeast"]);

type JsonRecord = Record<string, unknown>;

const jsonResponse = (payload: JsonRecord, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clampDuration = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_DURATION_SECONDS;
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, Math.round(numeric)));
};

const calculateCredits = (durationSeconds: number) =>
  Math.ceil(durationSeconds / 10) * COST_PER_10_SECONDS;

const normalizeStyle = (value: unknown) =>
  typeof value === "string" && STYLES.has(value) ? value : "vertical-short";

const joinUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

const parseProviderResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as JsonRecord : { raw: text };
  } catch {
    return { raw: text };
  }
};

const providerHeaders = (apiKey: string, extra: HeadersInit = {}) => {
  const headers = new Headers(extra);
  if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
  return headers;
};

const providerError = (payload: JsonRecord, fallback: string) =>
  typeof payload.detail === "string"
    ? payload.detail
    : typeof payload.error === "string"
      ? payload.error
      : typeof payload.raw === "string"
        ? payload.raw
        : fallback;

const providerRequestError = (status: number, path: string, payload: JsonRecord) => {
  if (status === 405) {
    return `Text-to-video backend rejected ${path}. Check TEXT_TO_VIDEO_ENDPOINT points to the video generation service and that the deployed service supports this route.`;
  }
  return providerError(payload, "Text-to-video backend request failed");
};

const isUnsupportedProviderRoute = (result: { status: number; error: string | null }) =>
  result.status === 404 ||
  result.status === 405 ||
  String(result.error ?? "").toLowerCase().includes("method not allowed");

const absoluteProviderUrl = (base: string, value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return joinUrl(base, value);
};

const providerAssetUrl = (base: string, value: unknown) => {
  if (typeof value !== "string" || !value) return value;
  const raw = value.trim();
  if (!raw || raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  let normalized = raw.replaceAll("\\", "/");
  const storageMarker = "/app/storage/";
  if (normalized.includes(storageMarker)) {
    normalized = normalized.slice(normalized.indexOf(storageMarker) + storageMarker.length);
  }
  if (normalized.startsWith("/")) normalized = normalized.slice(1);
  if (normalized.startsWith("app/storage/")) normalized = normalized.slice("app/storage/".length);
  if (normalized.startsWith("storage/")) normalized = normalized.slice("storage/".length);
  if (normalized.startsWith("api/storage/")) return joinUrl(base, normalized);
  if (
    normalized.startsWith("voiceover/") ||
    normalized.startsWith("renders/") ||
    normalized.startsWith("uploads/")
  ) {
    return joinUrl(base, `api/storage/${normalized}`);
  }
  return absoluteProviderUrl(base, raw) ?? raw;
};

const normalizeProviderProjectAssets = (base: string, value: JsonRecord) => {
  const project = structuredClone(value) as JsonRecord;
  for (const key of ["thumbnail_url", "final_video_url", "music_url"]) {
    if (key in project) project[key] = providerAssetUrl(base, project[key]);
  }
  if (Array.isArray(project.music_tracks)) {
    project.music_tracks = project.music_tracks.map((item) => providerAssetUrl(base, item));
  }
  if (Array.isArray(project.scenes)) {
    project.scenes = project.scenes.map((scene) => {
      if (!scene || typeof scene !== "object") return scene;
      const next = { ...(scene as JsonRecord) };
      for (const key of ["voiceover_url", "image_url", "video_url"]) {
        if (key in next) next[key] = providerAssetUrl(base, next[key]);
      }
      return next;
    });
  }
  if (Array.isArray(project.timeline_layers)) {
    project.timeline_layers = project.timeline_layers.map((layer) => {
      if (!layer || typeof layer !== "object") return layer;
      const next = { ...(layer as JsonRecord) };
      if ("url" in next) next.url = providerAssetUrl(base, next.url);
      return next;
    });
  }
  if (Array.isArray(project.uploaded_media)) {
    project.uploaded_media = project.uploaded_media.map((item) => {
      if (!item || typeof item !== "object") return item;
      const next = { ...(item as JsonRecord) };
      if ("url" in next) next.url = providerAssetUrl(base, next.url);
      return next;
    });
  }
  return project;
};

const projectIdFromProviderResponse = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const response = value as JsonRecord;
  if (typeof response.id === "string") return response.id;
  if (typeof response.project_id === "string") return response.project_id;
  const project = response.project;
  if (project && typeof project === "object" && typeof (project as JsonRecord).id === "string") {
    return (project as JsonRecord).id as string;
  }
  return null;
};

const isMissingVideoRelationError = (error: { code?: string; message?: string; details?: string } | null | undefined) => {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("text_to_video_generations") ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("schema cache")
  );
};

const allowedProjectPatch = (patch: JsonRecord) => {
  const allowed = new Set([
    "title",
    "aspect",
    "script",
    "voice",
    "caption_theme",
    "caption_style",
    "scenes",
    "music_url",
    "music_tracks",
    "timeline_layers",
    "uploaded_media",
    "music_timeline",
    "total_duration",
    "thumbnail_url",
    "status",
    "final_video_url",
  ]);

  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => allowed.has(key))
  ) as JsonRecord;
};

async function fetchProvider(
  providerEndpoint: string,
  providerApiKey: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(joinUrl(providerEndpoint, path), {
    ...init,
    headers: providerHeaders(providerApiKey, init.headers ?? {}),
  });
  const payload = await parseProviderResponse(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status >= 400 && response.status < 500 ? response.status : 500,
      payload,
      error: providerRequestError(response.status, path, payload),
    };
  }

  return { ok: true, status: response.status, payload, error: null };
}

async function findOwnedGeneration(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  projectId: string,
) {
  const direct = await supabaseAdmin
    .from("text_to_video_generations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider_project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!direct.error && direct.data) return direct.data as JsonRecord;

  const fallback = await supabaseAdmin
    .from("text_to_video_generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (fallback.error) return null;
  return ((fallback.data ?? []) as JsonRecord[]).find((row) =>
    projectIdFromProviderResponse(row.provider_response) === projectId
  ) ?? null;
}

async function requireOwnedProject(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  projectId: unknown,
) {
  if (typeof projectId !== "string" || !projectId.trim()) {
    return { generation: null, response: jsonResponse({ error: "Project id is required" }, 400) };
  }

  const generation = await findOwnedGeneration(supabaseAdmin, userId, projectId);
  if (!generation) {
    return { generation: null, response: jsonResponse({ error: "Video project not found" }, 404) };
  }

  return { generation, response: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const providerEndpoint =
      Deno.env.get("TEXT_TO_VIDEO_ENDPOINT") ??
      Deno.env.get("TEXT_TO_VIDEO_API_BASE") ??
      "";
    const providerApiKey = Deno.env.get("TEXT_TO_VIDEO_API_KEY") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "User not authenticated" }, 401);
    }

    const accessResponse = await requireMinimumPlan({
      supabaseClient: supabaseAdmin,
      userId: userData.user.id,
      minimumPlan: "basic",
      corsHeaders,
      message: "Text to video requires an active Basic, Pro, or Advanced subscription.",
    });
    if (accessResponse) return accessResponse;

    const contentType = req.headers.get("Content-Type") ?? "";
    if (contentType.toLowerCase().includes("multipart/form-data")) {
      const formData = await req.formData();
      const action = String(formData.get("action") ?? "");
      if (action !== "uploadMedia") {
        return jsonResponse({ error: "Unsupported multipart action" }, 400);
      }
      if (!providerEndpoint) {
        return jsonResponse({
          error: "Text to video is not configured. Set TEXT_TO_VIDEO_ENDPOINT to your Youtube-Shorts-Maker backend base URL.",
        }, 503);
      }

      const file = formData.get("file");
      if (!(file instanceof File)) {
        return jsonResponse({ error: "Media file is required" }, 400);
      }

      const kindValue = String(formData.get("kind") ?? "video");
      const upstreamForm = new FormData();
      upstreamForm.append("file", file, file.name || "upload");
      upstreamForm.append("kind", kindValue);

      const uploadResult = await fetchProvider(providerEndpoint, providerApiKey, "/api/uploads", {
        method: "POST",
        body: upstreamForm,
      });
      if (!uploadResult.ok) return jsonResponse({ error: uploadResult.error }, uploadResult.status);

      return jsonResponse({
        upload: {
          ...uploadResult.payload,
          url: providerAssetUrl(providerEndpoint, uploadResult.payload.url),
        },
      });
    }

    let body: JsonRecord = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON body is required" }, 400);
    }

    const action = typeof body.action === "string" ? body.action : "generate";
    const needsProvider = new Set([
      "generate",
      "status",
      "getProject",
      "updateProject",
      "renderProject",
      "renderStatus",
      "meta",
      "librarySearch",
    ]);

    if (needsProvider.has(action) && !providerEndpoint) {
      return jsonResponse({
        error: "Text to video is not configured. Set TEXT_TO_VIDEO_ENDPOINT to your Youtube-Shorts-Maker backend base URL.",
      }, 503);
    }

    if (action === "meta") {
      const result = await fetchProvider(providerEndpoint, providerApiKey, "/api/meta");
      return result.ok ? jsonResponse({ meta: result.payload }) : jsonResponse({ error: result.error }, result.status);
    }

    if (action === "librarySearch") {
      const q = typeof body.q === "string" ? body.q : "";
      const type = "video";
      const result = await fetchProvider(
        providerEndpoint,
        providerApiKey,
        `/api/library/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`,
      );
      return result.ok ? jsonResponse(result.payload) : jsonResponse({ error: result.error }, result.status);
    }

    if (action === "getProject") {
      const { response } = await requireOwnedProject(supabaseAdmin, userData.user.id, body.projectId);
      if (response) return response;

      const result = await fetchProvider(providerEndpoint, providerApiKey, `/api/projects/${body.projectId}`);
      return result.ok
        ? jsonResponse({ project: normalizeProviderProjectAssets(providerEndpoint, result.payload) })
        : jsonResponse({ error: result.error }, result.status);
    }

    if (action === "updateProject") {
      const { response } = await requireOwnedProject(supabaseAdmin, userData.user.id, body.projectId);
      if (response) return response;

      const patch = body.patch && typeof body.patch === "object"
        ? allowedProjectPatch(body.patch as JsonRecord)
        : {};

      if (Object.keys(patch).length === 0) {
        return jsonResponse({ error: "No project fields were provided" }, 400);
      }

      const result = await fetchProvider(providerEndpoint, providerApiKey, `/api/projects/${body.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      return result.ok
        ? jsonResponse({ project: normalizeProviderProjectAssets(providerEndpoint, result.payload) })
        : jsonResponse({ error: result.error }, result.status);
    }

    if (action === "deleteProject") {
      const projectId = typeof body.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : null;
      const generationId = typeof body.generationId === "string" && body.generationId.trim()
        ? body.generationId.trim()
        : null;

      let generation: JsonRecord | null = null;
      if (projectId) {
        const owned = await requireOwnedProject(supabaseAdmin, userData.user.id, projectId);
        if (owned.response) return owned.response;
        generation = owned.generation;
      } else if (generationId) {
        const { data, error } = await supabaseAdmin
          .from("text_to_video_generations")
          .select("*")
          .eq("id", generationId)
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (error || !data) {
          return jsonResponse({ error: "Video generation not found" }, 404);
        }
        generation = data as JsonRecord;
      } else {
        return jsonResponse({ error: "Project id or generation id is required" }, 400);
      }

      if (projectId) {
        if (!providerEndpoint) {
          return jsonResponse({
            error: "Text to video is not configured. Set TEXT_TO_VIDEO_ENDPOINT to your Youtube-Shorts-Maker backend base URL.",
          }, 503);
        }

        const result = await fetchProvider(providerEndpoint, providerApiKey, `/api/projects/${projectId}`, {
          method: "DELETE",
        });

        if (!result.ok && result.status !== 404) return jsonResponse({ error: result.error }, result.status);
      }

      if (typeof generation?.id === "string") {
        await supabaseAdmin
          .from("text_to_video_generations")
          .delete()
          .eq("id", generation.id)
          .eq("user_id", userData.user.id);
      }

      return jsonResponse({ deleted: true, projectId, generationId: generation?.id ?? generationId });
    }

    if (action === "renderProject") {
      const { generation, response } = await requireOwnedProject(supabaseAdmin, userData.user.id, body.projectId);
      if (response) return response;

      const fps = Math.min(90, Math.max(20, Number(body.fps) || 30));
      const outFormat = typeof body.outFormat === "string" ? body.outFormat : "mp4";
      const result = await fetchProvider(providerEndpoint, providerApiKey, "/api/renders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: body.projectId,
          fps,
          out_format: outFormat,
        }),
      });

      if (!result.ok) return jsonResponse({ error: result.error }, result.status);

      const providerJobId = typeof result.payload.job_id === "string" ? result.payload.job_id : null;
      let updatedGeneration = generation;
      if (providerJobId && typeof generation?.id === "string") {
        const update = await supabaseAdmin
          .from("text_to_video_generations")
          .update({
            status: "processing",
            provider_job_id: providerJobId,
            video_url: null,
            error_message: null,
            provider_project_id: body.projectId,
            provider_response: {
              ...(generation.provider_response && typeof generation.provider_response === "object"
                ? generation.provider_response as JsonRecord
                : {}),
              render: result.payload,
            },
          })
          .eq("id", generation.id)
          .select("*")
          .single();
        if (!update.error && update.data) updatedGeneration = update.data as JsonRecord;
      }

      return jsonResponse({ render: result.payload, generation: updatedGeneration });
    }

    if (action === "renderStatus") {
      const jobId = typeof body.jobId === "string" ? body.jobId : "";
      const projectId = typeof body.projectId === "string" ? body.projectId : "";
      if (!jobId || !projectId) {
        return jsonResponse({ error: "Project id and render job id are required" }, 400);
      }

      const { generation, response } = await requireOwnedProject(supabaseAdmin, userData.user.id, projectId);
      if (response) return response;

      const result = await fetchProvider(providerEndpoint, providerApiKey, `/api/renders/${jobId}`);
      if (!result.ok) return jsonResponse({ error: result.error }, result.status);

      const providerStatus = typeof result.payload.status === "string" ? result.payload.status : "running";
      const finalVideoUrl = absoluteProviderUrl(providerEndpoint, result.payload.final_video_url);
      const nextStatus = providerStatus === "completed"
        ? "completed"
        : providerStatus === "failed"
          ? "failed"
          : "processing";

      let updatedGeneration = generation;
      if (typeof generation?.id === "string" && (nextStatus === "completed" || nextStatus === "failed")) {
        const update = await supabaseAdmin
          .from("text_to_video_generations")
          .update({
            status: nextStatus,
            video_url: finalVideoUrl,
            provider_job_id: jobId,
            provider_project_id: projectId,
            provider_response: {
              ...(generation.provider_response && typeof generation.provider_response === "object"
                ? generation.provider_response as JsonRecord
                : {}),
              render: result.payload,
            },
            completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
            error_message: nextStatus === "failed"
              ? (typeof result.payload.error === "string" ? result.payload.error : "Render failed")
              : null,
          })
          .eq("id", generation.id)
          .select("*")
          .single();
        if (!update.error && update.data) updatedGeneration = update.data as JsonRecord;
      }

      return jsonResponse({ render: result.payload, generation: updatedGeneration });
    }

    if (action === "status") {
      const generationId = typeof body.generationId === "string" ? body.generationId : "";
      if (!generationId) {
        return jsonResponse({ error: "Generation id is required" }, 400);
      }

      const { data: generationRecord, error: generationError } = await supabaseAdmin
        .from("text_to_video_generations")
        .select("*")
        .eq("id", generationId)
        .eq("user_id", userData.user.id)
        .single();

      if (generationError || !generationRecord) {
        return jsonResponse({ error: "Video generation not found" }, 404);
      }

      if (
        generationRecord.status !== "processing" ||
          !generationRecord.provider_job_id
      ) {
        return jsonResponse({ generation: generationRecord });
      }

      const previousProviderResponse =
        generationRecord.provider_response && typeof generationRecord.provider_response === "object"
          ? generationRecord.provider_response as JsonRecord
          : {};
      const previousRender =
        previousProviderResponse.render && typeof previousProviderResponse.render === "object"
          ? previousProviderResponse.render as JsonRecord
          : {};
      const phase = previousRender.phase === "generation" ? "generation" : "render";

      const statusResult = await fetchProvider(
        providerEndpoint,
        providerApiKey,
        `/api/renders/${generationRecord.provider_job_id}`,
      );
      if (!statusResult.ok) return jsonResponse({ error: statusResult.error }, statusResult.status);

      const providerStatus = typeof statusResult.payload.status === "string" ? statusResult.payload.status : "processing";
      const statusPayload = { ...statusResult.payload, phase };

      if (phase === "generation") {
        if (providerStatus === "failed") {
          const { data: failedGeneration, error: failedUpdateError } = await supabaseAdmin
            .from("text_to_video_generations")
            .update({
              status: "failed",
              provider_response: {
                ...previousProviderResponse,
                render: statusPayload,
              },
              error_message: typeof statusResult.payload.error === "string"
                ? statusResult.payload.error
                : "Project generation failed",
            })
            .eq("id", generationId)
            .select("*")
            .single();

          if (failedUpdateError || !failedGeneration) {
            return jsonResponse({ error: failedUpdateError?.message || "Failed to update generation status" }, 500);
          }

          return jsonResponse({ generation: failedGeneration, render: statusPayload });
        }

        if (providerStatus !== "completed") {
          const { data: updatedGeneration, error: updateStatusError } = await supabaseAdmin
            .from("text_to_video_generations")
            .update({
              status: "processing",
              provider_response: {
                ...previousProviderResponse,
                render: statusPayload,
              },
              error_message: null,
            })
            .eq("id", generationId)
            .select("*")
            .single();

          if (updateStatusError || !updatedGeneration) {
            return jsonResponse({ error: updateStatusError?.message || "Failed to update generation status" }, 500);
          }

          return jsonResponse({ generation: updatedGeneration, render: statusPayload });
        }

        const providerProjectId =
          typeof generationRecord.provider_project_id === "string"
            ? generationRecord.provider_project_id
            : projectIdFromProviderResponse(previousProviderResponse);
        if (!providerProjectId) {
          return jsonResponse({ error: "Video provider project id is missing" }, 500);
        }

        const projectResult = await fetchProvider(providerEndpoint, providerApiKey, `/api/projects/${providerProjectId}`);
        if (!projectResult.ok) return jsonResponse({ error: projectResult.error }, projectResult.status);

        const renderResponse = await fetchProvider(providerEndpoint, providerApiKey, "/api/renders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: providerProjectId,
            fps: 30,
            out_format: "mp4",
          }),
        });

        if (!renderResponse.ok) {
          const { data: failedGeneration, error: failedUpdateError } = await supabaseAdmin
            .from("text_to_video_generations")
            .update({
              status: "failed",
              provider_project_id: providerProjectId,
              provider_response: {
                ...previousProviderResponse,
                project: projectResult.payload,
                render: { ...renderResponse.payload, phase: "render" },
              },
              error_message: renderResponse.error,
            })
            .eq("id", generationId)
            .select("*")
            .single();

          if (failedUpdateError || !failedGeneration) {
            return jsonResponse({ error: failedUpdateError?.message || "Failed to update render status" }, 500);
          }

          return jsonResponse({ generation: failedGeneration, project: normalizeProviderProjectAssets(providerEndpoint, projectResult.payload), render: { ...renderResponse.payload, phase: "render" } });
        }

        const providerJobId = typeof renderResponse.payload.job_id === "string" ? renderResponse.payload.job_id : null;
        const renderPayload = {
          ...renderResponse.payload,
          progress: typeof renderResponse.payload.progress === "number" ? renderResponse.payload.progress : 82,
          message: typeof renderResponse.payload.message === "string" ? renderResponse.payload.message : "Queued render",
          phase: "render",
        };
        const { data: renderGeneration, error: renderUpdateError } = await supabaseAdmin
          .from("text_to_video_generations")
          .update({
            status: "processing",
            video_url: null,
            provider_project_id: providerProjectId,
            provider_job_id: providerJobId,
            provider_response: {
              ...previousProviderResponse,
              project: projectResult.payload,
              render: renderPayload,
            },
            completed_at: null,
            error_message: null,
          })
          .eq("id", generationId)
          .select("*")
          .single();

        if (renderUpdateError || !renderGeneration) {
          return jsonResponse({ error: renderUpdateError?.message || "Failed to start render status tracking" }, 500);
        }

        return jsonResponse({
          generation: renderGeneration,
          project: normalizeProviderProjectAssets(providerEndpoint, projectResult.payload),
          render: renderPayload,
        });
      }

      const finalVideoUrl = absoluteProviderUrl(providerEndpoint, statusResult.payload.final_video_url);
      const nextStatus = providerStatus === "completed"
        ? "completed"
        : providerStatus === "failed"
          ? "failed"
          : "processing";
      const renderStatusPayload = { ...statusResult.payload, phase: "render" };

      const { data: updatedGeneration, error: updateStatusError } = await supabaseAdmin
        .from("text_to_video_generations")
        .update({
          status: nextStatus,
          video_url: finalVideoUrl,
          provider_response: {
            ...previousProviderResponse,
            render: renderStatusPayload,
          },
          completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
          error_message: nextStatus === "failed"
          ? (typeof statusResult.payload.error === "string" ? statusResult.payload.error : "Render failed")
          : null,
        })
        .eq("id", generationId)
        .select("*")
        .single();

      if (updateStatusError || !updatedGeneration) {
        return jsonResponse({
          error: updateStatusError?.message || "Failed to update render status",
        }, 500);
      }

      return jsonResponse({ generation: updatedGeneration, render: renderStatusPayload });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const durationSeconds = clampDuration(body.durationSeconds);
    const aspectRatio =
      body.aspectRatio === "16:9" || body.aspectRatio === "1:1" ? body.aspectRatio : "9:16";
    const style = normalizeStyle(body.style);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const voice = typeof body.voice === "string" && VOICES.has(body.voice) ? body.voice : "nova";
    const captionTheme =
      typeof body.captionTheme === "string" && CAPTION_THEMES.has(body.captionTheme)
        ? body.captionTheme
        : "viral_pop";

    if (!prompt) {
      return jsonResponse({ error: "Prompt is required" }, 400);
    }

    const creditsUsed = calculateCredits(durationSeconds);
    const creditCheck = await deductCreditsWithAmount(
      userData.user.id,
      creditsUsed,
      "generate-video",
      `Text to Video - ${durationSeconds}s`,
      durationSeconds <= 10 ? "basic" : durationSeconds <= 30 ? "standard" : "extensive",
    );

    if (!creditCheck.success) {
      return jsonResponse({ error: creditCheck.error }, 402);
    }

    const { data: insertedGeneration, error: insertError } = await supabaseAdmin
      .from("text_to_video_generations")
      .insert({
        user_id: userData.user.id,
        prompt,
        style,
        aspect_ratio: aspectRatio,
        duration_seconds: durationSeconds,
        credits_used: creditsUsed,
        status: "processing",
      })
      .select("*")
      .single();

    if (insertError || !insertedGeneration) {
      await refundCredits(userData.user.id, creditsUsed, "Text to video save failed - refund");
      return jsonResponse({
        error: isMissingVideoRelationError(insertError)
          ? "Text to video database is not configured. Apply the text-to-video migration before generating video."
          : insertError?.message || "Failed to create video job",
      }, 500);
    }

    const generationRequestBody = {
      title: title || prompt.slice(0, 60) || "Text to Video",
      script: prompt,
      aspect: aspectRatio,
      voice,
      caption_theme: captionTheme || (style === "documentary" ? "minimal" : "viral_pop"),
    };
    let generatedProjectResponse = await fetchProvider(providerEndpoint, providerApiKey, "/api/projects/generate-async", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(generationRequestBody),
    });
    let usedAsyncGeneration = true;

    if (!generatedProjectResponse.ok && isUnsupportedProviderRoute(generatedProjectResponse)) {
      usedAsyncGeneration = false;
      generatedProjectResponse = await fetchProvider(providerEndpoint, providerApiKey, "/api/projects/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generationRequestBody),
      });
    }

    if (!generatedProjectResponse.ok) {
      await supabaseAdmin
        .from("text_to_video_generations")
        .update({
          status: "failed",
          error_message: generatedProjectResponse.error,
        })
        .eq("id", insertedGeneration.id);
      await refundCredits(userData.user.id, creditsUsed, "Text to video provider error - refund");
      return jsonResponse({ error: generatedProjectResponse.error }, generatedProjectResponse.status);
    }

    const providerProjectId = projectIdFromProviderResponse(generatedProjectResponse.payload);
    if (!providerProjectId) {
      const providerRaw = typeof generatedProjectResponse.payload.raw === "string"
        ? generatedProjectResponse.payload.raw
        : JSON.stringify(generatedProjectResponse.payload);
      const providerResponseError =
        providerRaw === "null"
          ? "Video backend returned JSON null from the generation route. The backend must return the created project object with an id."
          : "Video provider did not return a project id";
      await supabaseAdmin
        .from("text_to_video_generations")
        .update({ status: "failed", error_message: providerResponseError })
        .eq("id", insertedGeneration.id);
      await refundCredits(userData.user.id, creditsUsed, "Text to video provider response error - refund");
      return jsonResponse({ error: providerResponseError, providerResponse: generatedProjectResponse.payload }, 502);
    }

    if (!usedAsyncGeneration) {
      const renderResponse = await fetchProvider(providerEndpoint, providerApiKey, "/api/renders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: providerProjectId,
          fps: 30,
          out_format: "mp4",
        }),
      });

      if (!renderResponse.ok) {
        await supabaseAdmin
          .from("text_to_video_generations")
          .update({
            status: "failed",
            provider_project_id: providerProjectId,
            provider_response: { project: generatedProjectResponse.payload, render: renderResponse.payload },
            error_message: renderResponse.error,
          })
          .eq("id", insertedGeneration.id);
        await refundCredits(userData.user.id, creditsUsed, "Text to video render start error - refund");
        return jsonResponse({ error: renderResponse.error }, renderResponse.status);
      }

      const providerJobId = typeof renderResponse.payload.job_id === "string" ? renderResponse.payload.job_id : null;
      const renderPayload = { ...renderResponse.payload, phase: "render" };
      const { data: generation, error: updateError } = await supabaseAdmin
        .from("text_to_video_generations")
        .update({
          status: "processing",
          video_url: null,
          provider_project_id: providerProjectId,
          provider_job_id: providerJobId,
          provider_response: { project: generatedProjectResponse.payload, render: renderPayload },
          completed_at: null,
          error_message: null,
        })
        .eq("id", insertedGeneration.id)
        .select("*")
        .single();

      if (updateError || !generation) {
        await refundCredits(userData.user.id, creditsUsed, "Text to video update failed - refund");
        return jsonResponse({ error: updateError?.message || "Failed to update video job" }, 500);
      }

      return jsonResponse({
        generation,
        project: normalizeProviderProjectAssets(providerEndpoint, generatedProjectResponse.payload),
        render: renderPayload,
        remainingCredits: creditCheck.currentBalance,
      });
    }

    const providerGenerationJobId =
      typeof generatedProjectResponse.payload.generation_job_id === "string"
        ? generatedProjectResponse.payload.generation_job_id
        : typeof generatedProjectResponse.payload.job_id === "string"
          ? generatedProjectResponse.payload.job_id
          : null;
    const generatedProject =
      generatedProjectResponse.payload.project && typeof generatedProjectResponse.payload.project === "object"
        ? generatedProjectResponse.payload.project as JsonRecord
        : generatedProjectResponse.payload;
    const generationProgressPayload = {
      job_id: providerGenerationJobId,
      status: typeof generatedProjectResponse.payload.status === "string"
        ? generatedProjectResponse.payload.status
        : "queued",
      progress: typeof generatedProjectResponse.payload.progress === "number"
        ? generatedProjectResponse.payload.progress
        : 1,
      message: typeof generatedProjectResponse.payload.message === "string"
        ? generatedProjectResponse.payload.message
        : "Queued generation",
      phase: "generation",
    };

    const { data: generation, error: updateError } = await supabaseAdmin
      .from("text_to_video_generations")
      .update({
        status: "processing",
        video_url: null,
        provider_project_id: providerProjectId,
        provider_job_id: providerGenerationJobId,
        provider_response: { project: generatedProject, render: generationProgressPayload },
        completed_at: null,
        error_message: null,
      })
      .eq("id", insertedGeneration.id)
      .select("*")
      .single();

    if (updateError || !generation) {
      await refundCredits(userData.user.id, creditsUsed, "Text to video completion save failed - refund");
      return jsonResponse({
        error: updateError?.message || "Failed to finalize generated video",
      }, 500);
    }

    return jsonResponse({
      generation,
      project: normalizeProviderProjectAssets(providerEndpoint, generatedProject),
      render: generationProgressPayload,
      remainingCredits: creditCheck.currentBalance,
    });
  } catch (error) {
    console.error("Text to video error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
