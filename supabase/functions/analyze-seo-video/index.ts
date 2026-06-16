import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAndDeductCredits, refundCredits } from "../_shared/credits.ts";
import { requireMinimumPlan } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const extractVideoId = (raw: string): string | null => {
  try {
    const url = new URL(raw.trim());
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0] || null;
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => ["shorts", "embed", "live"].includes(p));
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch {
    if (/^[\w-]{11}$/.test(raw.trim())) return raw.trim();
  }
  return null;
};

const coerceArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
};

const deriveScore = (analysis: any): number => {
  const errors = Array.isArray(analysis?.errors) ? analysis.errors.length : 0;
  const titleIssues = Array.isArray(analysis?.title?.issues) ? analysis.title.issues.length : 0;
  const descIssues = Array.isArray(analysis?.description?.issues) ? analysis.description.issues.length : 0;
  const thumbWeaknesses = Array.isArray(analysis?.thumbnail?.weaknesses) ? analysis.thumbnail.weaknesses.length : 0;
  const retentionRisks = Array.isArray(analysis?.retentionRisks) ? analysis.retentionRisks.length : 0;
  const positiveSignals =
    (Array.isArray(analysis?.optimization) ? Math.min(analysis.optimization.length, 8) : 0) +
    (Array.isArray(analysis?.thumbnail?.strengths) ? Math.min(analysis.thumbnail.strengths.length, 4) : 0);
  const issueWeight = errors * 6 + titleIssues * 4 + descIssues * 3 + thumbWeaknesses * 3 + retentionRisks * 2;
  const positiveWeight = positiveSignals * 2;
  const computed = 85 - issueWeight + positiveWeight;
  return Math.max(15, Math.min(95, Math.round(computed)));
};

const normalizeHashtag = (value: string) => {
  const cleaned = value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9_#]/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
};

const buildHeuristicFallback = (title: string, author: string, videoUrl: string) => {
  const t = title.trim();
  const titleLength = t.length;
  const words = t.split(/\s+/).filter(Boolean);
  const hasNumber = /\d/.test(t);
  const hasEmotion = /best|worst|secret|shocking|amazing|ultimate|mistake|truth|friends|benefits/i.test(t);

  const titleIssues: string[] = [];
  const titleSuggestions: string[] = [];
  if (titleLength < 35) titleIssues.push("Title is short and may miss searchable context.");
  if (titleLength > 70) titleIssues.push("Title is long and may truncate on mobile.");
  if (!hasNumber) titleIssues.push("Title lacks concrete numbers/year markers that can improve CTR.");
  if (!hasEmotion) titleIssues.push("Title lacks a strong curiosity or emotional trigger.");
  if (words.length < 5) titleIssues.push("Title has limited keyword surface area.");

  titleSuggestions.push("Include one primary keyword phrase in the first 40 characters.");
  titleSuggestions.push("Use one concrete hook element (number, contrast, or explicit outcome).");
  titleSuggestions.push("Keep title between 45 and 65 characters when possible.");

  const baseKeyword = words.slice(0, 4).join(" ").toLowerCase();
  const suggestedKeywords = [
    baseKeyword,
    `${baseKeyword} episode 1`,
    `${baseKeyword} full story`,
    `${baseKeyword} explained`,
    `${baseKeyword} recap`,
    `${baseKeyword} review`,
    `${baseKeyword} highlights`,
    `${baseKeyword} scene analysis`,
    `${baseKeyword} best moments`,
    `${baseKeyword} fan reactions`,
  ].map((s) => s.trim()).filter(Boolean);

  const hashtags = [words[0], words[1], "Episode1", "Trending", "ViralClip"]
    .filter(Boolean)
    .map((h) => normalizeHashtag(h));

  const errors = [
    { severity: "high", issue: "No confirmed primary keyword targeting in title.", fix: "Add one clear searchable keyword phrase near the beginning of the title." },
    { severity: "medium", issue: "Metadata depth cannot be verified from URL alone.", fix: "Expand description with keyword-rich summary, chapter timestamps, and CTA." },
    { severity: "medium", issue: "Thumbnail text/readability not validated yet.", fix: "Use high contrast focal point with 2-4 word readable text." },
    { severity: "low", issue: "No validation of intent match for target audience.", fix: "Align title promise with first 15 seconds and repeat promise in description intro." },
  ];

  return {
    score: 0,
    verdict: `Fallback audit generated for "${t}" by ${author}. AI structured output was unavailable, so this review is heuristic but actionable.`,
    optimization: [
      "Add a primary keyword phrase in first 40 chars of the title.",
      "Expand description opening with keyword + clear value promise.",
      "Add 3-5 related keyword variants naturally in description.",
      "Use a thumbnail with one focal face/object and strong contrast.",
      "Add a retention hook in first 10 seconds matching title promise.",
    ],
    suggestedKeywords,
    hashtags,
    errors,
    title: {
      issues: titleIssues,
      suggestions: titleSuggestions,
      rewrites: [],
    },
    description: {
      issues: ["Description quality and keyword placement could not be verified from oEmbed metadata only."],
      suggestions: [
        "Start description with the primary keyword and episode context.",
        "Add timestamps and 1 CTA line in first 200 characters.",
      ],
    },
    thumbnail: {
      strengths: ["Thumbnail asset exists and is publicly accessible."],
      weaknesses: ["Visual composition/readability not guaranteed without reliable model output."],
      suggestions: ["Use large subject framing and 2-4 words max overlay text."],
    },
    retentionRisks: [
      { timeframe: "0-15s", risk: "Weak opening hook may cause early drop-off.", fix: "State payoff immediately and preview the best moment." },
      { timeframe: "30-90s", risk: "Narrative pacing may slow.", fix: "Insert pattern interrupt and micro-cliffhanger." },
    ],
    trendingAngles: [
      `${t} ending explained`,
      `${t} character breakdown`,
      `${t} hidden details`,
    ],
    debug: { mode: "heuristic_fallback", sourceUrl: videoUrl },
  };
};

const fetchVideoSignals = async (videoId: string) => {
  const signals: { viewCount?: number; publishedTimeText?: string } = {};
  const youtubeApiKey = Deno.env.get("YOUTUBE_DATA_API_KEY");

  if (youtubeApiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(youtubeApiKey)}`;
      const apiRes = await fetch(apiUrl);
      if (apiRes.ok) {
        const apiJson = await apiRes.json();
        const item = Array.isArray(apiJson?.items) ? apiJson.items[0] : null;
        const rawViews = item?.statistics?.viewCount;
        const publishedAt = item?.snippet?.publishedAt;
        if (rawViews !== undefined && rawViews !== null) {
          const n = Number(rawViews);
          if (Number.isFinite(n)) signals.viewCount = n;
        }
        if (typeof publishedAt === "string" && publishedAt) {
          signals.publishedTimeText = new Date(publishedAt).toISOString().split("T")[0];
        }
        if (signals.viewCount !== undefined || signals.publishedTimeText) {
          return signals;
        }
      }
    } catch {
      // Continue to fallback scraping below
    }
  }

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return signals;
    const html = await res.text();
    const interactionMatch = html.match(/"interactionCount":"(\d+)"/);
    if (interactionMatch?.[1]) {
      const n = Number(interactionMatch[1]);
      if (Number.isFinite(n)) signals.viewCount = n;
    }
    const publishMatch = html.match(/"dateText":\{"simpleText":"([^"]+)"\}/);
    if (publishMatch?.[1]) signals.publishedTimeText = publishMatch[1];
  } catch {
    // best effort only
  }
  return signals;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = claimsData.claims.sub as string;
    const accessResponse = await requireMinimumPlan({
      supabaseClient,
      userId,
      minimumPlan: "basic",
      corsHeaders,
      message: "SEO Analyzer requires an active Basic, Pro, or Advanced subscription.",
    });
    if (accessResponse) return accessResponse;

    const { videoUrl } = await req.json();
    if (!videoUrl || typeof videoUrl !== "string" || videoUrl.length > 500) {
      return new Response(JSON.stringify({ error: "Valid YouTube video URL is required (max 500 chars)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) return new Response(JSON.stringify({ error: "Could not parse YouTube video ID from URL." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const creditCheck = await checkAndDeductCredits(userId, "analyze-seo-video", "standard");
    if (!creditCheck.success) return new Response(JSON.stringify({ error: creditCheck.error }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const openAiKey = Deno.env.get("ANALYSIS_AI_API");
    if (!openAiKey) {
      await refundCredits(userId, creditCheck.cost || 20, "SEO Analyzer unavailable - missing OpenAI key");
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [oembed, videoSignals] = await Promise.all([
      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`).then(async (r) => (r.ok ? r.json() : {})),
      fetchVideoSignals(videoId),
    ]);
    const title = typeof oembed.title === "string" ? oembed.title : "Untitled video";
    const author = typeof oembed.author_name === "string" ? oembed.author_name : "Unknown channel";

    const prompt = `You are an expert YouTube SEO analyst.
Return strict JSON only with this shape:
{
  "score": number,
  "verdict": string,
  "optimization": string[],
  "suggestedKeywords": string[],
  "hashtags": string[],
  "errors": [{"severity":"low|medium|high","issue":string,"fix":string}],
  "title": {"issues": string[], "suggestions": string[], "rewrites": string[]},
  "description": {"issues": string[], "suggestions": string[]},
  "thumbnail": {"strengths": string[], "weaknesses": string[], "suggestions": string[]},
  "retentionRisks": [{"timeframe": string, "risk": string, "fix": string}],
  "trendingAngles": string[]
}
Rules:
- Provide at least 5 optimization actions.
- Provide at least 4 SEO errors with clear fixes.
- Rewrites must contain exactly 3 improved title variants.
- Provide 10-18 suggestedKeywords and 3-8 hashtags.

Analyze this video metadata and thumbnail URL context:
Title: ${title}
Channel: ${author}
Video URL: ${videoUrl}
Thumbnail URL: https://img.youtube.com/vi/${videoId}/hqdefault.jpg
Additional context:
- Current view count (best effort): ${typeof videoSignals.viewCount === "number" ? videoSignals.viewCount : "unknown"}
- Published text (best effort): ${videoSignals.publishedTimeText || "unknown"}`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "seo_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                score: { type: "number" },
                verdict: { type: "string" },
                optimization: { type: "array", items: { type: "string" } },
                suggestedKeywords: { type: "array", items: { type: "string" } },
                hashtags: { type: "array", items: { type: "string" } },
                errors: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      issue: { type: "string" },
                      fix: { type: "string" },
                    },
                    required: ["severity", "issue", "fix"],
                  },
                },
                title: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    issues: { type: "array", items: { type: "string" } },
                    suggestions: { type: "array", items: { type: "string" } },
                    rewrites: { type: "array", items: { type: "string" } },
                  },
                  required: ["issues", "suggestions", "rewrites"],
                },
                description: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    issues: { type: "array", items: { type: "string" } },
                    suggestions: { type: "array", items: { type: "string" } },
                  },
                  required: ["issues", "suggestions"],
                },
                thumbnail: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    strengths: { type: "array", items: { type: "string" } },
                    weaknesses: { type: "array", items: { type: "string" } },
                    suggestions: { type: "array", items: { type: "string" } },
                  },
                  required: ["strengths", "weaknesses", "suggestions"],
                },
                retentionRisks: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      timeframe: { type: "string" },
                      risk: { type: "string" },
                      fix: { type: "string" },
                    },
                    required: ["timeframe", "risk", "fix"],
                  },
                },
                trendingAngles: { type: "array", items: { type: "string" } },
              },
              required: ["score", "verdict", "optimization", "suggestedKeywords", "hashtags", "errors", "title", "description", "thumbnail", "retentionRisks", "trendingAngles"],
            },
          },
        },
        messages: [
          { role: "system", content: "You are a strict, honest YouTube SEO analyst. Return only valid JSON schema output." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` } },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      await refundCredits(userId, creditCheck.cost || 20, "SEO Analyzer failed - OpenAI API error");
      const err = await aiResponse.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${err}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = await aiResponse.json();
    const content = payload?.choices?.[0]?.message?.content;
    const textContent = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.find((c: any) => c?.type === "text")?.text ?? ""
        : "";
    let parsed: any;
    try { parsed = JSON.parse(textContent); } catch { parsed = buildHeuristicFallback(title, author, videoUrl); }

    parsed = {
      score: Number.isFinite(Number(parsed?.score)) ? Number(parsed.score) : deriveScore(parsed),
      verdict: typeof parsed?.verdict === "string" ? parsed.verdict : "SEO analysis generated from available metadata and thumbnail context.",
      optimization: coerceArray(parsed?.optimization),
      suggestedKeywords: coerceArray(parsed?.suggestedKeywords),
      hashtags: coerceArray(parsed?.hashtags),
      errors: Array.isArray(parsed?.errors) ? parsed.errors : [],
      title: {
        issues: coerceArray(parsed?.title?.issues),
        suggestions: coerceArray(parsed?.title?.suggestions),
        rewrites: coerceArray(parsed?.title?.rewrites),
      },
      description: {
        issues: coerceArray(parsed?.description?.issues),
        suggestions: coerceArray(parsed?.description?.suggestions),
      },
      thumbnail: {
        strengths: coerceArray(parsed?.thumbnail?.strengths),
        weaknesses: coerceArray(parsed?.thumbnail?.weaknesses),
        suggestions: coerceArray(parsed?.thumbnail?.suggestions),
      },
      retentionRisks: Array.isArray(parsed?.retentionRisks) ? parsed.retentionRisks : [],
      trendingAngles: coerceArray(parsed?.trendingAngles),
      debug: {
        mode: parsed?.debug?.mode || "model_structured",
        viewCount: typeof videoSignals.viewCount === "number" ? videoSignals.viewCount : null,
        publishedTimeText: videoSignals.publishedTimeText || null,
      },
    };

    return new Response(JSON.stringify({ analysis: { meta: { title, author, thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, videoId, viewCount: videoSignals.viewCount ?? null, publishedTimeText: videoSignals.publishedTimeText ?? null }, ...parsed }, creditsUsed: creditCheck.cost || 20 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
