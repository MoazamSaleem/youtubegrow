# Hostinger KVM Deployment

Target repo path: `/var/www/render`.

## 1. Install System Packages

```sh
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx ffmpeg fonts-liberation fonts-freefont-ttf
```

## 2. Pull And Build

```sh
cd /var/www/render
git pull
npm ci
npm run build
```

## 3. Configure Backend Env

```sh
cd /var/www/render/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env
```

Use real values:

```sh
OPENAI_API_KEY=your_openai_key
OPENAI_BASE_URL=https://api.openai.com/v1
PIXABAY_API_KEY=your_pixabay_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STORAGE_DIR=/var/www/render/storage
CORS_ORIGINS=https://your-domain.com
```

Prepare writable storage:

```sh
sudo mkdir -p /var/www/render/storage
sudo chown -R www-data:www-data /var/www/render/storage /var/www/render/backend/data
```

## 4. Create Systemd Service

```sh
sudo nano /etc/systemd/system/youtube-render.service
```

Paste:

```ini
[Unit]
Description=YouTube Text-to-Video Render Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/render/backend
EnvironmentFile=/var/www/render/backend/.env
ExecStart=/var/www/render/backend/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Start it:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now youtube-render
sudo systemctl status youtube-render
```

## 5. Nginx Site

```sh
sudo nano /etc/nginx/sites-available/render
```

Use your real domain:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/render/dist;
    index index.html;
    client_max_body_size 250M;

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable:

```sh
sudo ln -sf /etc/nginx/sites-available/render /etc/nginx/sites-enabled/render
sudo nginx -t
sudo systemctl reload nginx
```

Add SSL with Certbot if it is not already configured.

## 6. Supabase Secrets

From your machine with the Supabase CLI linked to this project:

```sh
supabase db push
supabase secrets set TEXT_TO_VIDEO_ENDPOINT=https://your-domain.com
supabase functions deploy generate-video
```

Do not set `TEXT_TO_VIDEO_ENDPOINT` to `https://your-domain.com/api`; the Edge Function already appends `/api/...`.

## 7. Verify

```sh
curl https://your-domain.com/api/
curl https://your-domain.com/api/meta
sudo journalctl -u youtube-render -f
```

Then generate a video from `/dashboard/text-to-video`.
