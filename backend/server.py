"""FastAPI app — Voltcut AI video studio backend."""
from __future__ import annotations
import os
import asyncio
import logging
import re
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from db import projects, renders
from models import (
    Project, Scene, Caption, TimelineLayer, CaptionStyle, GenerateRequest, RenderRequest, RenderJob, _now, _uid,
)
from ai_service import (
    split_into_scenes, synthesize_voice, transcribe_words, build_caption_groups,
)
from pixabay_service import search_pixabay, fetch_first_video_for_keywords
from render_service import render_project, render_dependencies, STORAGE_DIR

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voltcut")

app = FastAPI(title="Voltcut Video Studio API")
api = APIRouter(prefix="/api")

cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Health -----
@api.get("/")
async def root():
    return {"service": "voltcut", "status": "ok", "time": _now()}


MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB
ALLOWED_UPLOAD_EXT = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif",
    ".mp4", ".mov", ".webm", ".m4v",
    ".mp3", ".wav", ".m4a", ".ogg",
}

IMAGE_MEDIA_RE = re.compile(r"\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$", re.IGNORECASE)
VIDEO_MEDIA_RE = re.compile(r"\.(?:mp4|mov|webm|m4v)(?:[?#].*)?$", re.IGNORECASE)

VIDEO_STYLE_PRESETS = {
    "cinematic": {"animation": "slow_pan", "transition": "fade", "effects": ["vignette"]},
    "documentary": {"animation": "ken_burns_out", "transition": "fade", "effects": []},
    "animated": {"animation": "punch_in", "transition": "zoom", "effects": ["rgb_split"]},
    "realistic": {"animation": "slow_pan", "transition": "fade", "effects": []},
    "product": {"animation": "ken_burns_in", "transition": "fade", "effects": ["vignette"]},
    "vertical-short": {"animation": "punch_in", "transition": "flash", "effects": ["flash"]},
}

AUDIO_STYLE_QUERY = {
    "none": "",
    "cinematic": "cinematic dark",
    "upbeat": "pop upbeat",
    "lofi": "lofi chill",
    "documentary": "cinematic calm",
}

CAPTION_STYLE_PRESETS = {
    "viral_pop": {"preset": "viral_pop"},
    "minimal": {"preset": "minimal"},
    "hormozi": {"preset": "hormozi"},
    "mrbeast": {"preset": "mrbeast"},
}


def _looks_like_image_media_url(value) -> bool:
    if not isinstance(value, str):
        return False
    raw = value.strip().lower()
    return bool(IMAGE_MEDIA_RE.search(raw) or "images.unsplash.com/" in raw)


def _looks_like_video_media_url(value) -> bool:
    return isinstance(value, str) and bool(VIDEO_MEDIA_RE.search(value.strip()))


def _normalize_video_style(value: str | None) -> str:
    return value if value in VIDEO_STYLE_PRESETS else "vertical-short"


def _normalize_audio_style(value: str | None) -> str:
    return value if value in AUDIO_STYLE_QUERY else "none"


def _caption_style_for_theme(theme: str | None) -> CaptionStyle:
    preset = CAPTION_STYLE_PRESETS.get(theme or "", CAPTION_STYLE_PRESETS["viral_pop"])
    return CaptionStyle(**preset)


async def _music_url_for_audio_style(audio_style: str) -> str | None:
    query = AUDIO_STYLE_QUERY.get(audio_style, "")
    if not query:
        return None
    items = await search_pixabay(query, "music", per_page=6)
    for item in items:
        url = item.get("url") or item.get("preview_url") or item.get("preview")
        if url:
            return str(url)
    return None


def _scene_ranges(scenes: list[dict]) -> list[tuple[dict, float, float]]:
    ranges = []
    cursor = 0.0
    for scene in scenes:
        duration = max(0.0, float(scene.get("duration") or 0.0))
        ranges.append((scene, cursor, duration))
        cursor += duration
    return ranges


def _is_generated_scene_video_layer(layer: dict, ranges: list[tuple[dict, float, float]]) -> bool:
    if layer.get("type") != "video":
        return False
    layer_start = float(layer.get("start") or 0.0)
    layer_duration = float(layer.get("duration") or 0.0)
    layer_url = str(layer.get("url") or "").strip()
    layer_track = int(layer.get("track") or 0)
    for scene, start, duration in ranges:
        same_time = abs(layer_start - start) < 0.15 and abs(layer_duration - duration) < 0.25
        same_track = layer_track == int(scene.get("index") or 0)
        original_image_url = layer_url and layer_url == str(scene.get("image_url") or "").strip()
        poster_video_layer = same_track and _looks_like_image_media_url(layer_url)
        if same_time and (original_image_url or poster_video_layer):
            return True
    return False


async def _repair_project_video_sources(doc: dict | None) -> dict | None:
    """Repair older projects that saved thumbnails/posters in video_url fields."""
    if not doc or not doc.get("scenes"):
        return doc

    aspect = doc.get("aspect", "9:16")
    scenes = [dict(scene) for scene in (doc.get("scenes") or [])]
    timeline_layers = [dict(layer) for layer in (doc.get("timeline_layers") or [])]
    changed = False

    for scene in scenes:
        old_url = scene.get("video_url")
        if not old_url or _looks_like_video_media_url(old_url):
            continue
        keywords = scene.get("keywords") or str(scene.get("script") or "").split()[:2]
        new_url = await fetch_first_video_for_keywords(keywords, aspect)
        if not new_url or new_url == old_url:
            continue
        if not scene.get("image_url"):
            scene["image_url"] = old_url
        scene["video_url"] = new_url
        changed = True

    ranges = _scene_ranges(scenes)
    repaired_layers = []
    for layer in timeline_layers:
        if _is_generated_scene_video_layer(layer, ranges):
            changed = True
            continue
        if layer.get("type") == "video" and not _looks_like_video_media_url(layer.get("url")):
            layer["type"] = "image"
            layer["opacity"] = float(layer.get("opacity") or 0.85)
            changed = True
        repaired_layers.append(layer)

    has_real_video_layer = any(
        layer.get("type") == "video"
        and layer.get("url")
        and _looks_like_video_media_url(layer.get("url"))
        for layer in repaired_layers
    )
    if not has_real_video_layer:
        for scene, start, duration in ranges:
            video_url = scene.get("video_url")
            if not video_url or not _looks_like_video_media_url(video_url):
                continue
            repaired_layers.append(
                TimelineLayer(
                    type="video",
                    url=video_url,
                    start=start,
                    duration=max(0.25, duration),
                    track=int(scene.get("index") or 0),
                    volume=0,
                    opacity=1,
                    trim_start=0,
                    trim_end=0,
                ).model_dump()
            )
            changed = True
    timeline_layers = repaired_layers

    if not changed:
        return doc

    thumbnail_url = next((scene.get("video_url") for scene in scenes if scene.get("video_url")), doc.get("thumbnail_url"))
    patch = {
        "scenes": scenes,
        "timeline_layers": timeline_layers,
        "thumbnail_url": thumbnail_url,
        "updated_at": _now(),
    }
    await projects.update_one({"id": doc["id"]}, {"$set": patch})
    return {**doc, **patch}


# ----- Storage / file serving -----
@api.get("/storage/{kind}/{name}")
async def storage_file(kind: str, name: str):
    if kind not in {"voiceover", "renders", "uploads"}:
        raise HTTPException(404)
    # Path traversal guard
    if "/" in name or ".." in name or "\\" in name:
        raise HTTPException(400, "Invalid filename")
    path = STORAGE_DIR / kind / name
    try:
        path.resolve().relative_to((STORAGE_DIR / kind).resolve())
    except (ValueError, RuntimeError):
        raise HTTPException(400, "Invalid path")
    if not path.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(str(path))


# ----- Projects CRUD -----
def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _storage_url_from_path(path_value: str) -> str:
    raw = str(path_value or "").strip()
    if not raw or raw.startswith(("http://", "https://", "/api/storage/", "api/storage/")):
        return raw
    try:
        rel = Path(raw).resolve().relative_to(STORAGE_DIR.resolve())
        return f"/api/storage/{rel.as_posix()}"
    except (ValueError, RuntimeError):
        return raw


async def _populate_generated_project(project: Project, req: GenerateRequest, progress_cb=None) -> dict:
    async def report(progress: int, message: str):
        if progress_cb:
            await progress_cb(progress, message)

    video_style = _normalize_video_style(req.style)
    audio_style = _normalize_audio_style(req.audio_style)
    style_preset = VIDEO_STYLE_PRESETS[video_style]
    caption_style = _caption_style_for_theme(req.caption_theme)

    await report(5, "Splitting scenes")
    scene_dicts = await split_into_scenes(req.script)
    await report(18, "Generating voiceover and captions")

    async def build_scene(idx_sc):
        idx, sc = idx_sc
        text = sc.get("script", "").strip()
        if not text:
            return None
        voice_path = await synthesize_voice(text, voice=req.voice)
        align = await transcribe_words(voice_path)
        caps_groups = build_caption_groups(align["words"], group_size=3)
        captions = [Caption(**c).model_dump() for c in caps_groups]
        video_url = await fetch_first_video_for_keywords(sc.get("keywords", []), req.aspect, video_style)
        scene = Scene(
            index=idx,
            script=text,
            duration=align["duration"] or max(2.0, len(text.split()) * 0.4),
            voiceover_url=_storage_url_from_path(voice_path),
            image_url=None,
            video_url=video_url,
            keywords=sc.get("keywords", []),
            transition_in=style_preset["transition"],
            animation=style_preset["animation"],
            effects=list(style_preset["effects"]),
            captions=captions,
        )
        return scene.model_dump()

    results = await asyncio.gather(*[build_scene((i, s)) for i, s in enumerate(scene_dicts)])
    scenes = [r for r in results if r]

    total_duration = sum(s["duration"] for s in scenes)
    thumb = next((s["video_url"] for s in scenes if s.get("video_url")), None)
    timeline_layers = []
    cursor = 0.0
    for track, scene in enumerate(scenes):
        duration = float(scene.get("duration") or 0)
        video_url = scene.get("video_url")
        if video_url and not _looks_like_image_media_url(video_url):
            timeline_layers.append(
                TimelineLayer(
                    type="video",
                    url=video_url,
                    start=cursor,
                    duration=max(0.25, duration),
                    track=track,
                    volume=0,
                    opacity=1,
                    trim_start=0,
                    trim_end=0,
                ).model_dump()
            )
        cursor += duration

    music_url = await _music_url_for_audio_style(audio_style)
    music_timeline = {
        "start": 0,
        "duration": total_duration if music_url else 0,
        "trim_start": 0,
        "trim_end": 0,
    }

    await report(88, "Saving project")
    await projects.update_one(
        {"id": project.id},
        {
            "$set": {
                "scenes": scenes,
                "timeline_layers": timeline_layers,
                "caption_style": caption_style.model_dump(),
                "music_url": music_url,
                "music_tracks": [],
                "music_timeline": music_timeline,
                "total_duration": total_duration,
                "thumbnail_url": thumb,
                "status": "ready",
                "updated_at": _now(),
            }
        },
    )
    doc = await projects.find_one({"id": project.id}, {"_id": 0})
    return doc


@api.get("/projects")
async def list_projects():
    cursor = projects.find({}, {"_id": 0}).sort("updated_at", -1)
    return [doc async for doc in cursor]


@api.get("/projects/{pid}")
async def get_project(pid: str):
    doc = await projects.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Project not found")
    doc = await _repair_project_video_sources(doc)
    return doc


@api.delete("/projects/{pid}")
async def delete_project(pid: str):
    res = await projects.delete_one({"id": pid})
    return {"deleted": res.deleted_count}


@api.patch("/projects/{pid}")
async def update_project(pid: str, payload: dict):
    payload.pop("_id", None)
    payload["updated_at"] = _now()
    res = await projects.update_one({"id": pid}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Project not found")
    doc = await projects.find_one({"id": pid}, {"_id": 0})
    doc = await _repair_project_video_sources(doc)
    return doc


# ----- AI generation pipeline -----
@api.post("/projects/generate")
async def generate_project(req: GenerateRequest):
    """Full pipeline: script -> scenes -> TTS -> Whisper -> stock videos -> Project."""
    if not req.script.strip():
        raise HTTPException(400, "Empty script")

    project = Project(
        title=req.title or req.script.strip().split(".")[0][:60] or "Untitled",
        aspect=req.aspect,
        script=req.script,
        voice=req.voice,
        caption_theme=req.caption_theme,
        caption_style=_caption_style_for_theme(req.caption_theme),
        status="generating",
    )
    await projects.insert_one(project.model_dump())

    try:
        doc = await _populate_generated_project(project, req)
    except Exception as e:
        logger.exception("generation failed")
        await projects.update_one(
            {"id": project.id},
            {"$set": {"status": "failed", "updated_at": _now()}},
        )
        raise HTTPException(500, f"Generation failed: {e}")

    return doc


@api.post("/projects/generate-async")
async def generate_project_async(req: GenerateRequest, bg: BackgroundTasks):
    """Queue project generation so Supabase Edge Functions do not time out."""
    if not req.script.strip():
        raise HTTPException(400, "Empty script")

    project = Project(
        title=req.title or req.script.strip().split(".")[0][:60] or "Untitled",
        aspect=req.aspect,
        script=req.script,
        voice=req.voice,
        caption_theme=req.caption_theme,
        caption_style=_caption_style_for_theme(req.caption_theme),
        status="generating",
    )
    await projects.insert_one(project.model_dump())

    job = RenderJob(project_id=project.id, status="queued", progress=0, message="Queued generation")
    await renders.insert_one(job.model_dump())
    bg.add_task(_run_generation, job.id, project.model_dump(), req.model_dump())

    return {
        "id": project.id,
        "project_id": project.id,
        "project": project.model_dump(),
        "generation_job_id": job.id,
        "job_id": job.id,
        "status": "queued",
        "progress": 0,
        "message": "Queued generation",
    }


async def _run_generation(job_id: str, project_data: dict, req_data: dict):
    project = Project(**project_data)
    req = GenerateRequest(**req_data)

    async def cb(pct: int, msg: str):
        await renders.update_one(
            {"id": job_id},
            {"$set": {"progress": pct, "message": msg, "status": "running", "updated_at": _now()}},
        )

    try:
        await renders.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 1, "message": "Starting generation", "updated_at": _now()}},
        )
        await _populate_generated_project(project, req, cb)
        await renders.update_one(
            {"id": job_id},
            {"$set": {"status": "completed", "progress": 100, "message": "Project ready", "updated_at": _now()}},
        )
    except Exception as e:
        logger.exception("async generation failed")
        await projects.update_one(
            {"id": project.id},
            {"$set": {"status": "failed", "updated_at": _now()}},
        )
        await renders.update_one(
            {"id": job_id},
            {"$set": {
                "status": "failed",
                "message": "Generation failed",
                "error": str(e)[:4000],
                "updated_at": _now(),
            }},
        )


@api.post("/projects/blank")
async def create_blank(payload: dict):
    title = (payload or {}).get("title") or "Untitled Video"
    aspect = (payload or {}).get("aspect", "9:16")
    project = Project(title=title, aspect=aspect, status="draft")
    await projects.insert_one(project.model_dump())
    return await projects.find_one({"id": project.id}, {"_id": 0})


# ----- Pixabay search -----
@api.get("/library/search")
async def library_search(q: str = "", type: str = "video"):
    items = await search_pixabay(q, type)
    return {"items": items}


# ----- Render -----
@api.post("/renders")
async def start_render(req: RenderRequest, bg: BackgroundTasks):
    deps = render_dependencies()
    if not deps["available"]:
        missing = [name for name, path in deps["binaries"].items() if not path]
        raise HTTPException(503, f"Render tools unavailable: missing {', '.join(missing)} on PATH")
    project = await projects.find_one({"id": req.project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    project = await _repair_project_video_sources(project)
    if not project.get("scenes"):
        raise HTTPException(400, "Project has no scenes to render")

    job = RenderJob(project_id=req.project_id, status="queued", progress=0, message="Queued")
    await renders.insert_one(job.model_dump())

    bg.add_task(_run_render, job.id, project, req.fps, req.out_format)
    return {"job_id": job.id, "status": "queued", "fps": req.fps, "out_format": req.out_format}


async def _run_render(job_id: str, project: dict, fps: int = 30, out_format: str = "mp4"):
    async def cb(pct: int, msg: str):
        await renders.update_one(
            {"id": job_id},
            {"$set": {"progress": pct, "message": msg, "status": "running", "updated_at": _now()}},
        )

    try:
        await renders.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 1, "message": "Starting", "updated_at": _now()}},
        )
        rel_path = await render_project(project, fps=fps, out_format=out_format, progress_cb=cb)
        final_url = f"/api/storage/{rel_path}"
        await renders.update_one(
            {"id": job_id},
            {"$set": {
                "status": "completed", "progress": 100,
                "message": "Done", "final_video_url": final_url,
                "updated_at": _now(),
            }},
        )
        await projects.update_one(
            {"id": project["id"]},
            {"$set": {
                "status": "rendered", "final_video_url": final_url, "updated_at": _now(),
            }},
        )
    except Exception as e:
        logger.exception("render failed")
        await renders.update_one(
            {"id": job_id},
            {"$set": {
                "status": "failed", "message": "Render failed",
                "error": str(e)[:4000], "updated_at": _now(),
            }},
        )


@api.get("/renders/{job_id}")
async def get_render(job_id: str):
    doc = await renders.find_one({"id": job_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404)
    return doc


@api.get("/renders")
async def list_renders():
    cursor = renders.find({}, {"_id": 0}).sort("created_at", -1).limit(20)
    return [doc async for doc in cursor]


# ----- Voices & Themes meta -----
@api.get("/meta")
async def meta():
    render_tools = render_dependencies()
    return {
        "voices": [
            {"id": "alloy", "label": "Alloy — Neutral"},
            {"id": "echo", "label": "Echo — Smooth"},
            {"id": "fable", "label": "Fable — Storyteller"},
            {"id": "onyx", "label": "Onyx — Deep"},
            {"id": "nova", "label": "Nova — Energetic"},
            {"id": "shimmer", "label": "Shimmer — Bright"},
        ],
        "caption_themes": [
            {"id": "viral_pop", "label": "Viral Pop"},
            {"id": "minimal", "label": "Minimal"},
            {"id": "hormozi", "label": "Hormozi"},
            {"id": "mrbeast", "label": "MrBeast"},
        ],
        "aspects": ["9:16", "1:1", "16:9"],
        "viral_modes": [
            {"id": "tiktok_retention", "label": "TikTok Retention"},
            {"id": "mrbeast_cuts", "label": "MrBeast Cuts"},
            {"id": "hormozi_subs", "label": "Hormozi Subs"},
            {"id": "documentary", "label": "Documentary Pacing"},
        ],
        "effects": [
            {"id": "shake", "label": "Shake"},
            {"id": "rgb_split", "label": "RGB Split"},
            {"id": "glitch", "label": "Glitch"},
            {"id": "blur_reveal", "label": "Blur Reveal"},
            {"id": "vignette", "label": "Vignette"},
            {"id": "film_burn", "label": "Film Burn"},
            {"id": "flash", "label": "Flash"},
            {"id": "speed_ramp", "label": "Speed Ramp"},
        ],
        "animations": [
            {"id": "ken_burns_in", "label": "Ken Burns In"},
            {"id": "ken_burns_out", "label": "Ken Burns Out"},
            {"id": "punch_in", "label": "Punch In"},
            {"id": "slow_pan", "label": "Slow Pan"},
            {"id": "none", "label": "None"},
        ],
        "transitions": [
            {"id": "fade", "label": "Fade"},
            {"id": "flash", "label": "Flash"},
            {"id": "zoom", "label": "Zoom"},
            {"id": "swipe", "label": "Swipe"},
        ],
        "speakers": [
            {"id": "primary", "label": "Primary", "color": "#FFD60A"},
            {"id": "speaker2", "label": "Speaker 2", "color": "#00E0B4"},
            {"id": "speaker3", "label": "Speaker 3", "color": "#FF7043"},
            {"id": "speaker4", "label": "Speaker 4", "color": "#9BFF00"},
        ],
        "formats": [
            {"id": "mp4", "label": "MP4 (H.264 + AAC)"},
            {"id": "webm", "label": "WebM (VP9 + Opus)"},
            {"id": "mov", "label": "MOV (H.264 + AAC)"},
            {"id": "gif", "label": "GIF (no audio)"},
        ],
        "fps_options": [20, 24, 30, 48, 60, 90],
        "render_tools": render_tools,
        "caption_presets": [
            {"id": "viral_pop", "label": "Viral Pop", "desc": "Yellow active word + white phrase"},
            {"id": "hormozi",   "label": "Hormozi",   "desc": "Big middle, no phrase, dark backdrop"},
            {"id": "mrbeast",   "label": "MrBeast",   "desc": "Massive red+white with accent box"},
            {"id": "minimal",   "label": "Minimal",   "desc": "Clean white, single line"},
            {"id": "subtitle",  "label": "Subtitle",  "desc": "Small bottom subtitle bar"},
        ],
        "caption_fonts": [
            {"id": "bold_sans", "label": "Bold Sans"},
            {"id": "display",   "label": "Display"},
            {"id": "narrow",    "label": "Narrow"},
            {"id": "mono",      "label": "Mono"},
            {"id": "serif",     "label": "Serif"},
        ],
        "caption_positions": [
            {"id": "top",    "label": "Top"},
            {"id": "middle", "label": "Middle"},
            {"id": "bottom", "label": "Bottom"},
            {"id": "custom", "label": "Custom"},
        ],
        "caption_backgrounds": [
            {"id": "none",       "label": "None"},
            {"id": "accent_box", "label": "Accent Box"},
            {"id": "dark_box",   "label": "Dark Box"},
        ],
        "caption_animations": [
            {"id": "pop",   "label": "Pop"},
            {"id": "fade",  "label": "Fade"},
            {"id": "slide", "label": "Slide"},
            {"id": "none",  "label": "None"},
        ],
    }


# ----- Upload -----
@api.post("/uploads")
async def upload_file(file: UploadFile = File(...), kind: str = Form("video")):
    """Save user uploads (image/video/audio) and return /api/storage URL."""
    ext = Path(file.filename or "").suffix.lower() or ".bin"
    if ext not in ALLOWED_UPLOAD_EXT:
        raise HTTPException(415, f"Unsupported file extension {ext}")
    name = f"{_uid()}{ext}"
    dest = STORAGE_DIR / "uploads" / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Stream-write with size cap to avoid loading huge files into RAM
    total = 0
    with dest.open("wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                f.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"File too large (>{MAX_UPLOAD_BYTES // (1024 * 1024)}MB)")
            f.write(chunk)
    media_type = "video" if ext in {".mp4", ".mov", ".webm", ".m4v"} else (
        "audio" if ext in {".mp3", ".wav", ".m4a", ".ogg"} else "image"
    )
    return {
        "url": f"/api/storage/uploads/{name}",
        "filename": file.filename,
        "size": total,
        "media_type": media_type,
        "kind": kind,
    }


app.include_router(api)


@app.on_event("startup")
async def startup():
    Path(STORAGE_DIR).mkdir(parents=True, exist_ok=True)
    (STORAGE_DIR / "voiceover").mkdir(exist_ok=True)
    (STORAGE_DIR / "renders").mkdir(exist_ok=True)
    (STORAGE_DIR / "uploads").mkdir(exist_ok=True)
    logger.info("Voltcut API ready")
