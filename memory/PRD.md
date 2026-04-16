# Lluvia Live - Product Requirements Document

## Original Problem Statement
Full-stack social audio streaming platform ("Lluvia Live") - 100% autónomo e independiente.

## Tech Stack (100% Directo, Sin Wrappers)
- Frontend: React.js, TailwindCSS
- Backend: FastAPI, Motor (MongoDB async)
- Pagos: **stripe** (SDK oficial de Python)
- Bot AI: **google-genai** (SDK oficial de Google)
- Audio: Agora.io WebRTC
- Base de datos: MongoDB

## Dependencias Directas (Sin intermediarios)
- `stripe` → Pagos con tarjeta
- `google-genai` → Bot AI con Gemini
- `agora-token-builder` → Tokens de audio
- `bcrypt` → Contraseñas
- `motor` → MongoDB async
- `fastapi` / `uvicorn` → Servidor

## Variables de Entorno del Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=lluvia_live_db
CORS_ORIGINS=https://tu-dominio.com
AGORA_APP_ID=tu_app_id
AGORA_APP_CERTIFICATE=tu_certificate
STRIPE_API_KEY=sk_live_tu_clave
STRIPE_WEBHOOK_SECRET=whsec_tu_secret
GEMINI_API_KEY=tu_clave_google_ai
```

## Lo que se ha completado
- Sistema de auth (login, registro, case-insensitive)
- Salas de audio con Agora WebRTC (9 asientos, auto-mute)
- Gamificación (aristocracia, VIP, CP, clanes)
- Economía (monedas, diamantes, regalos, sobres, cofres)
- 12 mini-juegos incluyendo Lion vs Tiger casino
- Bot AI con Gemini (SDK directo google-genai)
- Sistema de eventos King/CP con aprobación
- Panel de control administrativo
- Pagos con Stripe (SDK directo)
- Sistema de notificaciones
- 29 medallas automáticas en 7 categorías
- Anuncios de entrada por rol (dueño, admin, VIP, aristocracia)
- Formato de números K/M/B
- Limpieza de audio al salir de sala
- Código 100% limpio sin dependencias de terceros innecesarias
- Imágenes de juegos almacenadas localmente en /uploads/

## Archivos a eliminar en producción
- `server_backup.py` (monolito antiguo)
- `backend_test.py` (tests de desarrollo)
- `test_reports/` (reportes de testing)
- `memory/` (archivos de desarrollo)
