# Text-to-Video Render Backend

FastAPI backend used by the main app's `generate-video` Supabase Edge Function.

## Local Run

```sh
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

Fill `backend/.env` before starting the server. `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are required for real generation.

Health check:

```sh
curl http://127.0.0.1:8001/api/
curl http://127.0.0.1:8001/api/meta
```

## Supabase Wiring

The frontend calls `supabase/functions/generate-video`. That Edge Function authenticates the user, checks subscription/credits, then calls this backend.

Set these Supabase function secrets:

```sh
supabase secrets set TEXT_TO_VIDEO_ENDPOINT=https://your-domain.com
supabase secrets set TEXT_TO_VIDEO_API_KEY=
supabase functions deploy generate-video
```

`TEXT_TO_VIDEO_ENDPOINT` must be the public origin that proxies `/api` to this backend. Do not include `/api` in the value.
