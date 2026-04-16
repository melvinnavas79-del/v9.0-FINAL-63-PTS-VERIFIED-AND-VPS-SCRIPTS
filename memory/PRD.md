# Lluvia Live - PRD

## Stack (100% Directo)
- Backend: FastAPI + Motor (MongoDB)
- Frontend: React.js + TailwindCSS
- Pagos: paypalrestsdk (PayPal directo)
- Bot AI: google-genai (Gemini directo)
- Audio: Agora.io
- DB: MongoDB

## .env Backend
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=lluvia_live_db
CORS_ORIGINS=https://tu-dominio.com
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=live
GEMINI_API_KEY=
```

## Completado
- Auth, salas audio, gamificacion, economia
- 12 juegos, Lion vs Tiger casino
- Bot AI Gemini, eventos King/CP
- Panel admin, notificaciones
- 29 medallas automaticas
- PayPal integrado (SDK directo)
- Codigo 100% limpio y autonomo
