"""Pixabay stock media integration with graceful mock fallback."""
from __future__ import annotations
import os
import re
import httpx
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()
_KEY = os.environ.get("PIXABAY_API_KEY", "").strip()

# Curated cinematic mock library (used when no API key)
_MOCK_IMAGES: List[Dict[str, Any]] = [
    {"id": "m1", "type": "image", "title": "Neon city night", "thumb": "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=400", "url": "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=1920", "tags": "city neon night"},
    {"id": "m2", "type": "image", "title": "Coffee pour close up", "thumb": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400", "url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1920", "tags": "coffee cafe"},
    {"id": "m3", "type": "image", "title": "Mountain sunrise", "thumb": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400", "url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920", "tags": "mountain sunrise nature"},
    {"id": "m4", "type": "image", "title": "Studio camera", "thumb": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400", "url": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1920", "tags": "camera studio"},
    {"id": "m5", "type": "image", "title": "Ocean waves", "thumb": "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400", "url": "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920", "tags": "ocean sea waves"},
    {"id": "m6", "type": "image", "title": "Tech laptop", "thumb": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400", "url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1920", "tags": "tech laptop code"},
    {"id": "m7", "type": "image", "title": "Athlete sprint", "thumb": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400", "url": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1920", "tags": "sport running fitness"},
    {"id": "m8", "type": "image", "title": "Crowd concert", "thumb": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400", "url": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1920", "tags": "crowd concert lights"},
    {"id": "m9", "type": "image", "title": "Cinematic forest", "thumb": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400", "url": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920", "tags": "forest fog cinematic"},
    {"id": "m10", "type": "image", "title": "Money close up", "thumb": "https://images.unsplash.com/photo-1561414927-6d86591d0c4f?w=400", "url": "https://images.unsplash.com/photo-1561414927-6d86591d0c4f?w=1920", "tags": "money cash finance"},
    {"id": "m11", "type": "image", "title": "Person thinking", "thumb": "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=400", "url": "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=1920", "tags": "person portrait thinking"},
    {"id": "m12", "type": "image", "title": "Abstract neon waves", "thumb": "https://images.unsplash.com/photo-1554189097-ffe88e998a2b?w=400", "url": "https://images.unsplash.com/photo-1554189097-ffe88e998a2b?w=1920", "tags": "abstract neon waves"},
]

_MOCK_VIDEOS: List[Dict[str, Any]] = [
    {
        "id": "v1",
        "type": "video",
        "title": "Flower macro",
        "thumb": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.jpg",
        "url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        "video_url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        "tags": "nature flower close up cinematic",
    },
    {
        "id": "v2",
        "type": "video",
        "title": "Sintel trailer",
        "thumb": "https://media.w3.org/2010/05/sintel/poster.png",
        "url": "https://media.w3.org/2010/05/sintel/trailer.mp4",
        "video_url": "https://media.w3.org/2010/05/sintel/trailer.mp4",
        "tags": "cinematic story people action",
    },
    {
        "id": "v3",
        "type": "video",
        "title": "Small motion sample",
        "thumb": "https://media.w3.org/2010/05/video/poster.png",
        "url": "https://media.w3.org/2010/05/video/movie_300.mp4",
        "video_url": "https://media.w3.org/2010/05/video/movie_300.mp4",
        "tags": "city travel movement lifestyle",
    },
    {
        "id": "v4",
        "type": "video",
        "title": "Bunny trailer",
        "thumb": "https://media.w3.org/2010/05/bunny/poster.png",
        "url": "https://media.w3.org/2010/05/bunny/trailer.mp4",
        "video_url": "https://media.w3.org/2010/05/bunny/trailer.mp4",
        "tags": "nature character story bright",
    },
]

_MOCK_MUSIC: List[Dict[str, Any]] = [
    {"id": "mu1", "type": "audio", "title": "Cinematic Tension", "duration": 30, "preview": "https://cdn.pixabay.com/audio/2022/03/15/audio_8398a9bf3a.mp3", "tags": "cinematic dark"},
    {"id": "mu2", "type": "audio", "title": "Upbeat Pop Energy", "duration": 30, "preview": "https://cdn.pixabay.com/audio/2022/10/30/audio_946bc6c190.mp3", "tags": "pop upbeat"},
    {"id": "mu3", "type": "audio", "title": "Lo-fi Chill Beat", "duration": 30, "preview": "https://cdn.pixabay.com/audio/2022/08/03/audio_2dde668ca5.mp3", "tags": "lofi chill"},
    {"id": "mu4", "type": "audio", "title": "Epic Trailer Drum", "duration": 30, "preview": "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3", "tags": "epic trailer"},
]

_VIDEO_STYLE_QUERY = {
    "cinematic": "cinematic film dramatic",
    "documentary": "documentary nature real",
    "animated": "animation motion graphics",
    "realistic": "real life natural",
    "product": "product close up commercial",
    "vertical-short": "viral vertical motion",
}

IMAGE_MEDIA_RE = re.compile(r"\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$", re.IGNORECASE)
VIDEO_MEDIA_RE = re.compile(r"\.(?:mp4|mov|webm|m4v)(?:[?#].*)?$", re.IGNORECASE)


def _mock_filter(items: List[Dict[str, Any]], query: str, per_page: int) -> List[Dict[str, Any]]:
    q = query.lower().strip()
    if not q:
        return items[:per_page]
    results = [item for item in items if any(token in item["tags"].lower() for token in q.split())]
    return (results or items)[:per_page]


def _pixabay_video_url(item: Dict[str, Any]) -> str | None:
    videos = item.get("videos") or {}
    for key in ("medium", "small", "tiny", "large"):
        video = videos.get(key) or {}
        url = video.get("url")
        if url:
            return url
    return None


def _looks_like_image_url(value: str | None) -> bool:
    return bool(value and IMAGE_MEDIA_RE.search(value.strip()))


def _looks_like_video_url(value: str | None) -> bool:
    return bool(value and VIDEO_MEDIA_RE.search(value.strip()))


def _first_playable_video_url(item: Dict[str, Any]) -> str | None:
    for key in ("video_url", "url"):
        value = item.get(key)
        if isinstance(value, str) and value and _looks_like_video_url(value) and not _looks_like_image_url(value):
            return value
    return None


def _pixabay_video_thumb(item: Dict[str, Any]) -> str:
    picture_id = item.get("picture_id")
    if picture_id:
        return f"https://i.vimeocdn.com/video/{picture_id}_640x360.jpg"
    return item.get("userImageURL") or ""


async def search_pixabay(
    query: str,
    media_type: str = "image",
    per_page: int = 12,
    orientation: str = "vertical",
) -> List[Dict[str, Any]]:
    """Search Pixabay images or music. Falls back to curated mock if no API key."""
    if media_type == "audio":
        media_type = "music"
    if not _KEY:
        if media_type == "video":
            return _mock_filter(_MOCK_VIDEOS, query, per_page)
        if media_type == "music":
            matches = [m for m in _MOCK_MUSIC if not query or any(token in m["tags"].lower() for token in query.lower().split())]
            return [{**m, "url": m.get("preview"), "preview_url": m.get("preview")} for m in (matches or _MOCK_MUSIC)[:per_page]]
        return _mock_filter(_MOCK_IMAGES, query, per_page)

    async with httpx.AsyncClient(timeout=15) as client:
        if media_type == "music":
            # Pixabay music endpoint isn't open; return mock when music requested
            return [{**m, "url": m.get("preview"), "preview_url": m.get("preview")} for m in _MOCK_MUSIC[:per_page]]
        if media_type == "video":
            url = "https://pixabay.com/api/videos/"
            params = {
                "key": _KEY,
                "q": query or "cinematic",
                "video_type": "film",
                "orientation": orientation if orientation in {"horizontal", "vertical"} else "all",
                "per_page": per_page,
                "safesearch": "true",
            }
            r = await client.get(url, params=params)
            r.raise_for_status()
            items = r.json().get("hits", [])
            results = []
            for it in items:
                video_url = _pixabay_video_url(it)
                if not video_url:
                    continue
                results.append(
                    {
                        "id": str(it.get("id")),
                        "type": "video",
                        "title": it.get("tags", "")[:40],
                        "thumb": _pixabay_video_thumb(it),
                        "url": video_url,
                        "video_url": video_url,
                        "tags": it.get("tags", ""),
                    }
                )
            return results
        url = "https://pixabay.com/api/"
        params = {
            "key": _KEY,
            "q": query or "cinematic",
            "image_type": "photo",
            "orientation": orientation if orientation in {"horizontal", "vertical"} else "all",
            "per_page": per_page,
            "safesearch": "true",
        }
        r = await client.get(url, params=params)
        r.raise_for_status()
        items = r.json().get("hits", [])
        return [
            {
                "id": str(it.get("id")),
                "type": "image",
                "title": it.get("tags", "")[:40],
                "thumb": it.get("webformatURL"),
                "url": it.get("largeImageURL") or it.get("webformatURL"),
                "tags": it.get("tags", ""),
            }
            for it in items
        ]


async def fetch_first_image_for_keywords(keywords: list) -> str | None:
    """Helper used by AI generator to pick a stock image for a scene."""
    q = " ".join(keywords[:2]) if keywords else "cinematic"
    items = await search_pixabay(q, "image", per_page=6)
    if items:
        return items[0]["url"]
    return None


async def fetch_first_video_for_keywords(keywords: list, aspect: str = "9:16", style: str = "vertical-short") -> str:
    """Helper used by AI generator to pick a stock video for a scene."""
    style_query = _VIDEO_STYLE_QUERY.get(style, _VIDEO_STYLE_QUERY["vertical-short"])
    keyword_query = " ".join(str(item).strip() for item in keywords[:2] if str(item).strip())
    q = " ".join(part for part in [style_query, keyword_query] if part).strip() or "cinematic"
    orientation = "horizontal" if aspect == "16:9" else "vertical"
    items = await search_pixabay(q, "video", per_page=6, orientation=orientation)
    if not items and keyword_query:
        items = await search_pixabay(keyword_query, "video", per_page=6, orientation=orientation)
    if not items:
        items = await search_pixabay("cinematic motion", "video", per_page=6, orientation=orientation)
    if items:
        for item in items:
            video_url = _first_playable_video_url(item)
            if video_url:
                return video_url
    return _MOCK_VIDEOS[0]["video_url"]
