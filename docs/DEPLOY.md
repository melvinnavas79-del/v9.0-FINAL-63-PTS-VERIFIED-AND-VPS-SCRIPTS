# Lluvia Live — Guía de Despliegue en VPS

> Esta app es **100% white-label**. NO usa dependencias proprietary de ninguna plataforma. Cero tracking, cero telemetría. Audio WebRTC self-hosted en tu propio servidor — zero costo variable.

---

## Arquitectura

```
Cliente (navegador)
   ↓ HTTPS                    ↓ WSS (audio signaling)
   ↓ HTTPS (API)
Nginx (:443, SSL)
   ↓ proxy_pass 127.0.0.1:8001 (con WebSocket upgrade)
FastAPI / uvicorn (lluvia-backend.service)
   ↓
MongoDB (:27017)
```

El audio de los usuarios nunca pasa por tu VPS: viaja peer-to-peer (WebRTC nativo) entre navegadores. Tu servidor solo relaya **señalización** (offer/answer/ICE candidates, <1KB por evento). Bandwidth del servidor: mínimo.

---

## 1. Variables de entorno

### `/app/frontend/.env` (cámbialo ANTES de `yarn build`)

```bash
REACT_APP_BACKEND_URL=https://tu-dominio.com
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=tu-app.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tu-app
REACT_APP_FIREBASE_STORAGE_BUCKET=tu-app.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxx
# ⚠️ IMPORTANTE: debe ser un App ID de tipo WEB (contiene ':web:'), NO android
REACT_APP_FIREBASE_APP_ID=1:xxxxxxxxxx:web:xxxxxxxxxxxxxxxxxxxx
```

### `/app/backend/.env`

```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lluvia_live"
CORS_ORIGINS="https://tu-dominio.com"
GEMINI_API_KEY=tu_key_real_de_google_ai_studio
PAYPAL_CLIENT_ID=tu_paypal_live_client_id
PAYPAL_CLIENT_SECRET=tu_paypal_live_secret
PAYPAL_MODE=live
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_WEB_API_KEY=AIzaSy...

# OPCIONAL: TURN server propio (solo si usuarios reportan "audio no conecta").
# 95% de los casos el STUN gratis de Google es suficiente.
# TURN_URL=turn:tu-coturn.tu-dominio.com:3478
# TURN_USER=user
# TURN_PASS=password
```

---

## 2. Instalación en VPS Ubuntu 22.04

```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv nginx mongodb-org

# Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g yarn

# Backend
cd /opt/lluvia-live/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Frontend (cambia .env PRIMERO)
cd ../frontend
yarn install
yarn build

sudo systemctl enable --now mongod
```

---

## 3. Nginx — Config completa con WebSocket (CRÍTICO para audio)

`/etc/nginx/sites-available/lluvia-live`:

```nginx
# Map para WebSocket upgrade
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate     /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    client_max_body_size 100M;   # subida de fotos/música

    # Frontend build estático
    root /opt/lluvia-live/frontend/build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API + WebSocket (audio signaling)
    location /api/ {
        proxy_pass http://127.0.0.1:8001;

        # === WebSocket upgrade (requerido para /api/ws/audio/*) ===
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        # =======================================================

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;      # WebSocket long-lived (1h sin tráfico = OK)
        proxy_send_timeout 3600s;
    }
}
```

Activa y recarga:

```bash
sudo ln -s /etc/nginx/sites-available/lluvia-live /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> **Si no agregas las 3 líneas de `Upgrade / Connection`, el audio NUNCA conectará** aunque todo lo demás funcione.

---

## 4. systemd — Backend FastAPI

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
# ⚠️ --workers 1 porque el diccionario ROOMS del signaling vive en memoria.
# Si necesitas >1 worker, migra a Redis pub/sub (ver routes/webrtc.py).
ExecStart=/opt/lluvia-live/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lluvia-backend
```

---

## 5. Firebase — Configurar Web App correctamente (para Login Google + Teléfono)

Si al intentar login con Google aparece error de dominio no autorizado, o el login con teléfono nunca envía el SMS, es porque tu `REACT_APP_FIREBASE_APP_ID` es de **Android** en lugar de Web.

**Cómo arreglarlo (5 minutos)**:

1. Ve a https://console.firebase.google.com → selecciona tu proyecto.
2. ⚙️ **Project Settings** → tab **General** → sección **Your apps**.
3. Click **Add app** → elige el icono `</>` (Web).
4. Dale un nombre (ej. "Lluvia Live Web") → **Register app**.
5. Firebase te muestra un objeto `firebaseConfig`. Copia el `appId` — contiene `:web:`, ej. `1:909704512499:web:abc123xyz456`.
6. Pégalo en `/app/frontend/.env` como `REACT_APP_FIREBASE_APP_ID`.
7. Ve a **Authentication → Settings → Authorized domains**. Agrega:
   - `lluvia-live.com`
   - `www.lluvia-live.com`
   - Cualquier otro dominio/subdomain desde donde acceden.
8. Rebuild y redeploy el frontend:
   ```bash
   cd /opt/lluvia-live/frontend
   yarn build
   sudo systemctl reload nginx
   ```

---

## 6. Endpoint de diagnóstico

Abre en tu navegador (logueado como dueño):

```
https://tu-dominio.com/api/diagnostics?user_id=<tu_user_id>
```

Te devuelve JSON con el estado real de:
- PayPal LIVE (OAuth real)
- Uploads (permisos de escritura)
- Disco, MongoDB
- Variables de entorno configuradas

También:
```
GET /api/auth/firebase/status  → verifica si tu config Firebase es correcta
POST /api/diagnostics/paypal/test-order?user_id=<id>&amount=1.00  → crea orden real (no captura)
```

---

## 7. Claves externas — dónde obtenerlas

| Servicio | URL | Para qué |
|---|---|---|
| Google AI Studio | https://aistudio.google.com/apikey | `GEMINI_API_KEY` — filtro IA de imágenes + bot |
| PayPal | https://developer.paypal.com (Live mode) | `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` |
| Firebase | https://console.firebase.google.com | Auth Google + Phone (Web App ID) |

> El audio corre 100% en tu servidor con WebRTC nativo. Cero servicios externos.

---

## 8. Verificación post-deploy

```bash
# API responde
curl https://tu-dominio.com/api/rooms

# Config WebRTC
curl https://tu-dominio.com/api/webrtc/config

# WebSocket audio (debe devolver HTTP 426 "Upgrade Required" si SIN upgrade)
curl -i https://tu-dominio.com/api/ws/audio/test?user_id=x

# Diagnóstico completo (como dueño)
curl "https://tu-dominio.com/api/diagnostics?user_id=<tu_id>" | jq
```

---

## 9. Pruebas de regresión

```bash
cd /opt/lluvia-live/backend
source venv/bin/activate
python -m pytest tests/ -v
```
