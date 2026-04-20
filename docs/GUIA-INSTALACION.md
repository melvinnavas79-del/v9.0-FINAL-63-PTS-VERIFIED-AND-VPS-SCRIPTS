# Lluvia Live — Guía de Instalación

> **Sistema 100% self-hosted. Cero dependencias de terceros para audio (WebRTC nativo).**

## 1. Pre-requisitos en el VPS (Ubuntu 22.04)

```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv nginx mongodb-org git

# Node.js 20 + Yarn
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn pm2

sudo systemctl enable --now mongod
```

## 2. Clonar e instalar backend

```bash
cd /opt
sudo git clone <tu-repo> lluvia-live
cd lluvia-live/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus claves reales (ver sección 4)
nano .env
```

## 3. Instalar y buildear frontend

```bash
cd ../frontend
echo "REACT_APP_BACKEND_URL=https://tu-dominio.com" > .env
# Agregar el resto de variables Firebase (ver sección 4)
yarn install
yarn build
```

## 4. Variables de entorno

### `/app/backend/.env`
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=lluvia_live_db
CORS_ORIGINS=https://tu-dominio.com
PAYPAL_CLIENT_ID=tu_paypal_client_id
PAYPAL_CLIENT_SECRET=tu_paypal_client_secret
PAYPAL_MODE=live
GEMINI_API_KEY=tu_clave_google_ai
FIREBASE_PROJECT_ID=tu_firebase_project
FIREBASE_WEB_API_KEY=tu_firebase_web_api_key

# OPCIONAL: TURN server propio si algunos usuarios reportan "audio no conecta"
# (95% de casos el STUN gratis de Google es suficiente)
# TURN_URL=turn:tu-coturn.tu-dominio.com:3478
# TURN_USER=usuario
# TURN_PASS=password
```

### `/app/frontend/.env`
```bash
REACT_APP_BACKEND_URL=https://tu-dominio.com
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=tu-app.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tu-app
REACT_APP_FIREBASE_STORAGE_BUCKET=tu-app.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxx
REACT_APP_FIREBASE_APP_ID=1:xxxx:web:xxxx   # DEBE ser tipo :web: (NO android)
```

### Donde obtener las claves
- **PayPal** (LIVE): https://developer.paypal.com/dashboard/applications → Live app → Client ID + Secret
- **Gemini API Key**: https://aistudio.google.com/apikey
- **Firebase Auth** (Google + Phone): https://console.firebase.google.com → Project Settings → Your apps → **Add app → Web** (asegúrate que el appId contiene `:web:`). Authentication → Settings → Authorized domains → agregar tu dominio.

## 5. systemd — Backend FastAPI

`/etc/systemd/system/lluvia-backend.service`:
```ini
[Unit]
Description=Lluvia Live Backend
After=network.target mongod.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/lluvia-live/backend
EnvironmentFile=/opt/lluvia-live/backend/.env
ExecStart=/opt/lluvia-live/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> `--workers 1` porque el signaling WebRTC mantiene estado en memoria. Para escalar a varios workers, migrar a Redis pub/sub.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lluvia-backend
```

## 6. Nginx con WebSocket upgrade (crítico para audio)

`/etc/nginx/sites-available/lluvia-live`:
```nginx
# map a nivel http (fuera de 'server'), necesario para WebSocket
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;

    ssl_certificate     /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    client_max_body_size 100M;

    root /opt/lluvia-live/frontend/build;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }

    location /api/ {
        proxy_pass http://127.0.0.1:8001;

        # WebSocket upgrade — sin esto el audio NO conecta
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lluvia-live /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 7. SSL con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

## 8. Dependencias principales

- `fastapi`, `uvicorn`, `motor` (MongoDB async)
- `bcrypt` (contraseñas)
- `paypalrestsdk` (PayPal LIVE directo)
- `google-genai` (Bot IA + moderación de imágenes)
- `firebase-admin` (validación tokens Google/Phone)
- `websockets` (signaling WebRTC interno de FastAPI)

**Sistema de audio 100% self-hosted.** WebRTC corre peer-to-peer en el navegador de tus usuarios; tu servidor solo relaya el "handshake" inicial (<1KB por conexión). Cero servicios externos de audio, cero costos variables.

## 9. Verificación post-deploy

```bash
curl https://tu-dominio.com/api/rooms
curl https://tu-dominio.com/api/webrtc/config
curl "https://tu-dominio.com/api/diagnostics?user_id=<tu_user_id>" | jq
curl "https://tu-dominio.com/api/bot/super/integrity?admin_id=<tu_user_id>" | jq
```

## 10. Actualización futura

```bash
cd /opt/lluvia-live
git pull origin main
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && yarn install && yarn build
sudo systemctl restart lluvia-backend
sudo systemctl reload nginx
```
