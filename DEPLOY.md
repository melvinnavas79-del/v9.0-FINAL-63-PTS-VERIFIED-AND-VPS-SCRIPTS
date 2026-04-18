# Lluvia Live — Guía de Despliegue en VPS

> Esta app es **100% white-label**. NO usa dependencias proprietary de ninguna plataforma. Cero tracking, cero telemetría.

## ⚠️ Paso crítico ANTES de construir el frontend

La URL del backend se inyecta en el bundle de JavaScript al momento de compilar. **Cámbiala en `/app/frontend/.env` antes de `yarn build`**:

```bash
# /app/frontend/.env  — reemplaza con TU dominio de VPS
REACT_APP_BACKEND_URL=https://tu-dominio.com
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=tu-app.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tu-app
REACT_APP_FIREBASE_STORAGE_BUCKET=tu-app.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxx
REACT_APP_FIREBASE_APP_ID=1:xxx:android:xxx
```

## Backend — `/app/backend/.env`

```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lluvia_live_prod"
CORS_ORIGINS="https://tu-dominio.com"
AGORA_APP_ID=tu_agora_app_id
AGORA_APP_CERTIFICATE=tu_agora_cert
GEMINI_API_KEY=tu_key_real_de_google_ai_studio
PAYPAL_CLIENT_ID=tu_paypal_live_client_id
PAYPAL_CLIENT_SECRET=tu_paypal_live_secret
PAYPAL_MODE=live
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_WEB_API_KEY=AIzaSy...
```

## Instalación en VPS Ubuntu 22.04

```bash
# Dependencias base
sudo apt update && sudo apt install -y python3 python3-pip nodejs mongodb nginx

# Node 20+ (si el apt es viejo)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g yarn

# Backend
cd /opt/lluvia-live/backend
pip install -r requirements.txt

# Frontend (cambia .env PRIMERO — paso crítico arriba)
cd /opt/lluvia-live/frontend
yarn install
yarn build
```

## Servir con nginx + systemd (ejemplo)

```nginx
# /etc/nginx/sites-available/lluvia-live
server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate     /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    # Frontend (build estático)
    root /opt/lluvia-live/frontend/build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend (FastAPI detrás de uvicorn)
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```ini
# /etc/systemd/system/lluvia-backend.service
[Unit]
Description=Lluvia Live Backend
After=network.target mongod.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/lluvia-live/backend
EnvironmentFile=/opt/lluvia-live/backend/.env
ExecStart=/usr/local/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lluvia-backend
sudo systemctl enable --now mongod
sudo ln -s /etc/nginx/sites-available/lluvia-live /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Claves externas: dónde obtenerlas

| Servicio | URL | Para qué |
|---|---|---|
| Google AI Studio | https://aistudio.google.com/apikey | `GEMINI_API_KEY` — filtro IA de imágenes + bot conversacional |
| Agora.io | https://console.agora.io | `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` — audio WebRTC de salas |
| PayPal | https://developer.paypal.com (modo Live) | `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` — pagos reales |
| Firebase | https://console.firebase.google.com | Auth Google + Phone |

## Verificación post-deploy

```bash
curl https://tu-dominio.com/api/rooms               # → 200
curl https://tu-dominio.com/api/rankings/daily-games # → 200 con rewards [3M,2M,1M]
```

## Estado actual de Producción (Feb 2026) ✅

| Servicio | Estado | Notas |
|---|---|---|
| **Agora LIVE** | ✅ OPERATIVO | App ID `eccc14...2ce542` + Cert configurados. Tokens generan OK (139 chars, uid dinámico). |
| **PayPal LIVE** | ✅ OPERATIVO | OAuth retorna access_token 200 de `api-m.paypal.com`. App ID: `APP-9E950290LB550220K`. Modo `live`. |
| **Firebase Auth** | ✅ CONFIGURADO | Proyecto `lluvia-live-69a05`, auth Google + Phone. |
| **MongoDB** | ✅ `lluvia_live` | DB renombrada (sin rastro "test"). 39 usuarios, 11 salas reales. Test artifacts purgados. |
| **Gemini Vision** | ⚠️ KEY INVALIDA | Google rechaza la key `AIzaSy...tLlgws` con `API_KEY_INVALID`. Código hace fail-open (no bloquea fondos). Ver sección abajo. |

## ⚠️ Cómo reparar la Gemini API Key

Google responde `API_KEY_INVALID` a tu key actual. Causas típicas:

1. **Key no tiene habilitada la "Generative Language API"**:
   - Ve a https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
   - Selecciona tu proyecto → botón **ENABLE**

2. **Key restringida por IP/dominio**:
   - Ve a https://console.cloud.google.com/apis/credentials
   - Click en tu key → **Application restrictions: None** (para pruebas) o whitelist la IP del VPS.

3. **Forma alternativa (más simple)**:
   - Ve a https://aistudio.google.com/apikey → **Create API Key** → copia la nueva.
   - Pega en `backend/.env` como `GEMINI_API_KEY=AIza...`
   - Reinicia backend: `sudo supervisorctl restart backend`.

Mientras la key no sea válida, el filtro de fondos de sala solo bloquea por nombre de archivo sospechoso (nude, gun, etc.) — ya es una capa de protección. Una vez arreglada la key, Gemini 2.0 Flash analiza los píxeles en tiempo real.

## Pruebas

```bash
cd /opt/lluvia-live/backend
python -m pytest tests/ -v
```

Los tests están en `/app/backend/tests/` — son pruebas de regresión, NO se ejecutan en producción.
