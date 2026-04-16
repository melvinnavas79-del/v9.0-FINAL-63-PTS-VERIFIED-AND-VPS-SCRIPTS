# Lluvia Live - Guia de Instalacion en VPS

## Requisitos del Servidor
- Ubuntu 20.04+ / Debian 11+
- Node.js 18+ y Yarn
- Python 3.10+
- MongoDB 6+
- Nginx (reverse proxy)
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
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configurar variables de entorno
nano .env
```

## 3. Frontend
```bash
cd ../frontend
yarn install
echo "REACT_APP_BACKEND_URL=https://tu-dominio.com" > .env
yarn build
```

## 4. Variables de Entorno (.env del backend)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=lluvia_live_db
CORS_ORIGINS=https://tu-dominio.com
AGORA_APP_ID=tu_agora_app_id
AGORA_APP_CERTIFICATE=tu_agora_certificate
PAYPAL_CLIENT_ID=tu_paypal_client_id
PAYPAL_CLIENT_SECRET=tu_paypal_client_secret
PAYPAL_MODE=live
GEMINI_API_KEY=tu_clave_google_ai
```

### Donde obtener las claves:
- **AGORA**: https://console.agora.io
- **PAYPAL**: https://developer.paypal.com/dashboard/applications
  - Crear aplicacion → Copiar Client ID y Secret
  - Para produccion: usar las claves LIVE (no sandbox)
- **GEMINI_API_KEY**: https://aistudio.google.com/apikey

## 5. PM2 (Gestor de procesos)
```bash
npm install -g pm2
cd /root/lluvia-live/backend
pm2 start "venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001" --name lluvia-backend
pm2 save
pm2 startup
```

## 6. Nginx
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        root /root/lluvia-live/frontend/build;
        try_files $uri /index.html;
    }

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

## 7. SSL
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d tu-dominio.com
```

## Dependencias (todas directas, sin intermediarios)
- fastapi, uvicorn, motor (MongoDB)
- bcrypt (contrasenas)
- paypalrestsdk (pagos PayPal directo)
- google-genai (Bot AI Gemini directo)
- agora-token-builder (tokens audio)

## Archivos a eliminar en produccion
- server_backup.py
- backend_test.py
- test_reports/
- test_result.md
- memory/
- .emergent/
