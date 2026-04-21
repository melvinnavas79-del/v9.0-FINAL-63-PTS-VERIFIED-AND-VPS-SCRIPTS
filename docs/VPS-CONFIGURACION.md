# 🚀 Guía de Configuración del VPS — Lluvia Live v9.0

> **Para:** Melvin Navas
> **Servidor:** Contabo VPS — dominio `lluvia-live.com`
> **Objetivo:** Dejar los 63 puntos de la v9.0 funcionando en producción.
>
> **Tiempo estimado:** 15–20 minutos si ya tiene las llaves.

---

## 📌 Principio fundamental

El código que usted recibió está **100% completo y probado** en el entorno de preview de Emergent. Cuando usted hizo el despliegue a Contabo, lo que viajó fue **únicamente el código fuente** — los archivos `.env` (que contienen las llaves API) **no se suben al repositorio por seguridad** (`.gitignore` los excluye).

Por lo tanto, en su VPS usted debe crear los archivos `.env` con SUS propias llaves, una sola vez. A partir de ese momento, todo funciona.

---

## ✅ PASO 1 — Verificar que el código desplegado es la v9.0

Conéctese por SSH a su VPS y ejecute:

```bash
cd /root/lluvia-live   # ← ajuste a la ruta real de su despliegue
git log --oneline -5
cat backend/routes/script_runner.py | head -3
ls backend/routes/economy.py backend/routes/reels.py backend/routes/diagnostics.py
```

**Debe ver:**
- Los últimos commits mencionando v9.0, economy, script_runner, reels, diagnostics.
- El archivo `script_runner.py` existe y empieza con `"""Consola Técnica (Script Runner)..."""`.
- Los tres archivos de `routes/` existen.

❌ **Si no los ve** → el despliegue es viejo. Haga `git pull` en la rama correcta o re-despliegue.

---

## ✅ PASO 2 — Crear `/root/lluvia-live/backend/.env`

Tome el archivo `.env.example` que ya viene en el repo como plantilla:

```bash
cd /root/lluvia-live/backend
cp .env.example .env
nano .env
```

Llene las variables exactamente con estas llaves (son **SUS llaves** que usted obtuvo de Google, Firebase y PayPal — no de Emergent):

```env
# === Base de datos ===
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=lluvia_live

# === Seguridad ===
MASTER_KEY=pegue_aqui_su_clave_maestra_de_32_caracteres_minimo
JWT_SECRET=pegue_aqui_un_secreto_largo_y_unico

# === Google Gemini (Bot IA) ===
# Obtener en: https://aistudio.google.com/apikey
GEMINI_API_KEY=AIzaSy...aqui_va_su_llave_gemini

# === Firebase (autenticación y storage de imágenes) ===
# Obtener en: https://console.firebase.google.com → Project Settings → Service Accounts
FIREBASE_PROJECT_ID=lluvia-live
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@lluvia-live.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=lluvia-live.appspot.com

# === PayPal (pagos LIVE) ===
# Obtener en: https://developer.paypal.com → My Apps & Credentials → LIVE
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=AWxxxxxxxxxxxxxxx...
PAYPAL_CLIENT_SECRET=EKxxxxxxxxxxxxxxx...

# === CORS (dominios autorizados) ===
CORS_ORIGINS=https://lluvia-live.com,https://www.lluvia-live.com
```

> ⚠️ **Importante sobre FIREBASE_PRIVATE_KEY**: en el archivo JSON de Firebase el valor tiene saltos de línea reales. Al copiarlo al `.env` debe quedar **todo en una sola línea** con `\n` literales entre comillas dobles, tal como está en el ejemplo.

---

## ✅ PASO 3 — Crear `/root/lluvia-live/frontend/.env`

```bash
cd /root/lluvia-live/frontend
cp .env.example .env
nano .env
```

Contenido:

```env
REACT_APP_BACKEND_URL=https://lluvia-live.com
```

> Nota: **sin barra final**, y si usted expone el backend en un subdominio (`api.lluvia-live.com`), use ese en su lugar. El frontend construye rutas como `${REACT_APP_BACKEND_URL}/api/rooms`.

---

## ✅ PASO 4 — Rebuild del frontend

Las variables `REACT_APP_*` se incrustan en el bundle compilado. Si cambió el `.env` del frontend, debe reconstruir:

```bash
cd /root/lluvia-live/frontend
yarn install
yarn build
```

---

## ✅ PASO 5 — Reiniciar servicios

```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo systemctl reload nginx
```

Verifique que arrancaron sin errores:

```bash
sudo supervisorctl status
tail -n 50 /var/log/supervisor/backend.err.log
```

---

## ✅ PASO 6 — Prueba rápida (los 6 endpoints clave)

Desde su VPS o desde cualquier otra máquina, ejecute:

```bash
BASE=https://lluvia-live.com
curl -s $BASE/api/rooms | head -c 200; echo
curl -s $BASE/api/webrtc/config | head -c 200; echo
curl -s $BASE/api/reels | head -c 200; echo
curl -s $BASE/api/diagnostics | head -c 400; echo
```

**Debe ver:**
- `/api/rooms` → JSON con lista de salas (o `[]` si está vacía).
- `/api/webrtc/config` → JSON con STUN/TURN servers.
- `/api/reels` → JSON con `{ "reels": [...] }`.
- `/api/diagnostics` → `{"paypal":"ok","uploads":"ok","mongo":"ok", ...}` ← **este es el panel de salud**.

Si `/api/diagnostics` responde `paypal: error` → revise `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`.
Si responde `mongo: error` → revise `MONGO_URL` y que MongoDB esté corriendo (`sudo systemctl status mongod`).
Si responde `uploads: error` → `chmod -R 755 backend/uploads && chown -R www-data:www-data backend/uploads`.

---

## ✅ PASO 7 — Probar el Bot IA

```bash
curl -s -X POST $BASE/api/bot/super/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"admin","message":"hola"}'
```

**Si responde** con un mensaje del Bot → Gemini está funcionando ✅.
**Si se queda colgado o da 500** → revise que `GEMINI_API_KEY` esté en el `.env` y sin espacios/comillas extras. Luego `sudo supervisorctl restart backend`.

---

## ✅ PASO 8 — Probar subida de imagen

Desde el panel de administrador en `https://lluvia-live.com`, intente subir una foto al perfil.
**Si falla** → revise las 4 variables `FIREBASE_*` y ejecute:

```bash
curl -s $BASE/api/diagnostics | python3 -m json.tool
```

El campo `firebase` debe decir `ok`.

---

## 🆘 Si algo sigue fallando

Ejecute el script de diagnóstico automático que le dejé en `/scripts/verificar-vps.sh` y comparta el output conmigo. En base a eso le doy el fix línea por línea.

```bash
cd /root/lluvia-live
chmod +x scripts/verificar-vps.sh
./scripts/verificar-vps.sh
```

---

## 🔒 Recordatorio de seguridad

- **Nunca** comparta el contenido completo de su `.env` en chats públicos ni capturas de pantalla.
- **Nunca** suba el `.env` al repositorio Git (ya está excluido por `.gitignore`).
- Si sospecha que una llave se filtró, rotéla inmediatamente en el panel del proveedor (Google AI Studio, Firebase, PayPal).

---

**Autor:** Agente Técnico Emergent
**Versión del código:** Lluvia Live v9.0
**Última revisión:** Feb 2026
