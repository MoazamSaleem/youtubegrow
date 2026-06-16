# Youtube Shorts Maker Service

This service is the FastAPI text-to-video module from `dwilliam9786-design/Youtube-Shorts-Maker`.

It exposes the API contract used by the app's `generate-video` Supabase Edge Function:

- `POST /api/projects/generate`
- `POST /api/renders`
- `GET /api/renders/{job_id}`
- `GET /api/storage/{kind}/{name}`

## Local Setup

```powershell
cd services/youtube-shorts-maker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Update `.env` with real values. FFmpeg and FFprobe must be installed and available on `PATH`.

Start the service:

```powershell
uvicorn server:app --host 0.0.0.0 --port 8001
```

For the hosted Supabase Edge Function to call this service, `TEXT_TO_VIDEO_ENDPOINT` must be a public URL for this backend, not `localhost`. Use a deployed backend URL or a tunnel during development.

```powershell
supabase secrets set TEXT_TO_VIDEO_ENDPOINT="https://your-public-video-service-url"
supabase secrets set TEXT_TO_VIDEO_API_KEY="optional-api-key"
supabase functions deploy generate-video
```
