#!/bin/bash
# ==============================================
# LLUVIA LIVE - Script de Deploy Automatico
# Ejecutar en tu servidor VPS (Termius)
# ==============================================

set -e
echo "============================================="
echo "  LLUVIA LIVE - Instalacion en Servidor"
echo "============================================="

# Variables - EDITAR ANTES DE EJECUTAR
DOMAIN="lluvia-live.com"
APP_DIR="/root/lluvia-live"
REPO_URL="PEGA_TU_URL_DE_GITHUB_AQUI"

# 1. Instalar dependencias del sistema
echo ""
echo "[1/8] Instalando dependencias del sistema..."
apt update -y
apt install -y python3 python3-pip python3-venv nodejs npm nginx certbot python3-certbot-nginx
npm install -g yarn pm2

# 2. Clonar o actualizar repositorio
echo ""
echo "[2/8] Descargando codigo..."
if [ -d "$APP_DIR" ]; then
    cd $APP_DIR && git pull
else
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# 3. Backend
echo ""
echo "[3/8] Configurando backend..."
cd $APP_DIR/backend
python3 -m venv venv
source venv/bin/activate

# Limpiar cualquier pip.conf con indices externos
mkdir -p /root/.config/pip
echo "[global]" > /root/.config/pip/pip.conf
echo "# Solo PyPI oficial" >> /root/.config/pip/pip.conf

# Instalar SOLO desde PyPI oficial
pip install --index-url https://pypi.org/simple/ -r requirements.txt

# Verificar que NO se instalo emergentintegrations
pip uninstall -y emergentintegrations 2>/dev/null || true

# Verificar que .env existe
if [ ! -f .env ]; then
    cp .env.example .env
    echo "IMPORTANTE: Edita $APP_DIR/backend/.env con tus credenciales reales"
fi

# Verificar que firebase-admin.json existe
if [ ! -f firebase-admin.json ]; then
    echo "IMPORTANTE: Copia firebase-admin.json a $APP_DIR/backend/"
fi

# 4. Frontend
echo ""
echo "[4/8] Compilando frontend..."
cd $APP_DIR/frontend
yarn install

# Configurar .env del frontend
cat > .env << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
REACT_APP_FIREBASE_API_KEY=AIzaSyDuGlEMCD1XIW1T80A6ZiVvM6YjdfJnWLA
REACT_APP_FIREBASE_AUTH_DOMAIN=lluvia-live-69a05.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=lluvia-live-69a05
REACT_APP_FIREBASE_STORAGE_BUCKET=lluvia-live-69a05.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=909704512499
REACT_APP_FIREBASE_APP_ID=1:909704512499:android:fc5612610ff14fde610886
EOF

yarn build
echo "Frontend compilado en $APP_DIR/frontend/build/"

# 5. Crear directorio de uploads
echo ""
echo "[5/8] Preparando uploads..."
mkdir -p $APP_DIR/backend/uploads

# 6. Configurar Nginx
echo ""
echo "[6/8] Configurando Nginx..."
cat > /etc/nginx/sites-available/lluvia-live << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Frontend (archivos estaticos)
    location / {
        root $APP_DIR/frontend/build;
        try_files \$uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 50M;
        proxy_read_timeout 120s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/lluvia-live /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 7. Iniciar backend con PM2
echo ""
echo "[7/8] Iniciando backend..."
cd $APP_DIR/backend
source venv/bin/activate
pm2 delete lluvia-backend 2>/dev/null || true
pm2 start "venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001" --name lluvia-backend
pm2 save
pm2 startup

# 8. SSL (HTTPS)
echo ""
echo "[8/8] Configurando SSL..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || echo "SSL: Ejecuta manualmente 'certbot --nginx -d $DOMAIN'"

echo ""
echo "============================================="
echo "  LLUVIA LIVE - INSTALACION COMPLETADA"
echo "============================================="
echo ""
echo "  URL: https://$DOMAIN"
echo "  Backend: pm2 status"
echo "  Logs: pm2 logs lluvia-backend"
echo ""
echo "  CHECKLIST:"
echo "  [ ] Verifica que .env tiene tus credenciales"
echo "  [ ] Verifica que firebase-admin.json existe"
echo "  [ ] Prueba: https://$DOMAIN"
echo ""
echo "============================================="
