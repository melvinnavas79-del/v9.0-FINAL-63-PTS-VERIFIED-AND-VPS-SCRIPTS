# Lluvia Live - PRD

## Descripcion
App de streaming de audio en vivo (estilo TikTok Live) con salas, juegos, economia de monedas, Bot IA y sistema de clanes/parejas.

## Stack
- Frontend: React.js + TailwindCSS + Agora.io WebRTC
- Backend: FastAPI + Motor (MongoDB async)
- AI Bot: emergentintegrations (Gemini) + Web Speech API (TTS/STT)
- Deploy: PM2 + Nginx en Contabo VPS

## Implementado
- [x] Auth (login/registro), roles (dueño, admin, moderador, supervisor, usuario)
- [x] Salas de audio con Agora WebRTC (mic/speaker, auto-mute, seats)
- [x] Monthly Star con 3 circulos (Clan, Recarga mensual centro, Pareja)
- [x] Semanales: Clan Semanal, Pareja CP, Eventos con animaciones
- [x] Bot ON/OFF switch + voz muteada por defecto (persistente en localStorage)
- [x] Bot con 4 modos de voz: Mujer, Hombre, Animador, Serio
- [x] Bot obedece "callate" / "habla" / modos
- [x] Minimizar sala (pantalla flotante)
- [x] Mic no graba al entrar (solo al activar)
- [x] Auto-mute 2 min
- [x] Panel de Control MAESTRO (Salas, Config, Consola, Bot IA)
- [x] Premios Clanes EDITABLES en Panel de Control (1er, 2do, 3er lugar)
- [x] Panel Premios: config recarga mensual, retorno semanal, pago auto
- [x] Chat limpio al entrar
- [x] 10 Cofres, 7 Sobres, 15 regalos, 6 juegos en sala
- [x] ID unico + busqueda
- [x] Bot autonomo, amigo personal, memoria finanzas
- [x] Dashboard: lista (iconos medalla), Pareja, Clan (mismo estilo visual)
- [x] Dashboard Event tab con 3 tarjetas (King, CP Event, Recarga)
- [x] Tienda en sala (Supermercado, Aristocracia, etc.)
- [x] Flash Fame y animaciones de ganadores
- [x] Deploy en GitHub + Contabo VPS configurado

## Pendiente
- Eventos King 1/2/3 (flujo completo en sala)
- Eventos CP nivel 6/7
- Sistema aprobacion eventos
- Musica en sala (upload y playback sincronizado)
- Ludo game WebView integration
- Zoom en fotos del chat
- Cashback semanal automatico
- Refactorizar server.py (~3000 lineas)
- Mas regalos con efectos

## Credenciales
- Melvin_Live / test123 - Role: dueño
