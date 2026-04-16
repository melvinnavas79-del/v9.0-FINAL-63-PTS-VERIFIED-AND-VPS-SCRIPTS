# Lluvia Live - Guía de Instalación en VPS

## Requisitos del Servidor
- Ubuntu 20.04+ / Debian 11+
- Node.js 18+ y Yarn
- Python 3.10+
- MongoDB 6+
- Nginx (como reverse proxy)
- PM2 (gestor de procesos)

## 1. Clonar el proyecto
```bash
cd /root
git clone [TU_REPO] lluvia-live
cd lluvia-live
```

## 2. Backend
```bash
cd backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
nano .env
# EDITAR con tus claves reales (ver sección Variables)
```

## 3. Frontend
```bash
cd ../frontend

# Instalar dependencias
yarn install

# Configurar URL del backend
echo "REACT_APP_BACKEND_URL=https://tu-dominio.com" > .env

# Compilar para producción
yarn build
```

## 4. Variables de Entorno (.env del backend)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=lluvia_live_db
CORS_ORIGINS=https://tu-dominio.com
AGORA_APP_ID=tu_agora_app_id
AGORA_APP_CERTIFICATE=tu_agora_certificate
STRIPE_API_KEY=sk_live_tu_clave_stripe
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret
GEMINI_API_KEY=tu_clave_google_ai
```

### Dónde obtener las claves:
- **AGORA**: https://console.agora.io → Crear proyecto → App ID y Certificate
- **STRIPE**: https://dashboard.stripe.com/apikeys → Secret key (sk_live_...)
- **STRIPE_WEBHOOK_SECRET**: Stripe Dashboard → Developers → Webhooks → Crear endpoint → Secret
- **GEMINI_API_KEY**: https://aistudio.google.com/apikey → Crear API key

## 5. PM2 (Gestor de procesos)
```bash
# Instalar PM2
npm install -g pm2

# Iniciar backend
cd /root/lluvia-live/backend
pm2 start "venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001" --name lluvia-backend

# Guardar configuración
pm2 save
pm2 startup
```

## 6. Nginx (Reverse Proxy)
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    # Frontend (archivos estáticos)
    location / {
        root /root/lluvia-live/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
```

```bash
# Activar sitio
ln -s /etc/nginx/sites-available/lluvia-live /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## 7. SSL con Certbot
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d tu-dominio.com
```

## 8. Stripe Webhook
En tu panel de Stripe:
1. Ve a Developers → Webhooks
2. Agrega endpoint: `https://tu-dominio.com/api/webhook/stripe`
3. Selecciona evento: `checkout.session.completed`
4. Copia el Signing Secret y ponlo en `.env` como `STRIPE_WEBHOOK_SECRET`

## Dependencias del Backend (pip)
- fastapi, uvicorn, motor (MongoDB async)
- bcrypt (contraseñas)
- stripe (pagos directos)
- google-genai (Bot AI con Gemini)
- agora-token-builder (tokens de audio)
- python-dotenv

## Notas
- El código es 100% autónomo e independiente
- No requiere servicios de terceros más allá de Agora, Stripe y Google AI
- Las imágenes de juegos están en `/backend/uploads/`
- Los archivos subidos (fotos, música) se guardan en `/backend/uploads/`
