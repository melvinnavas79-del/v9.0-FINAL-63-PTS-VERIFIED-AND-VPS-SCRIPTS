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
- [x] Salas de audio con Agora WebRTC (mic/speaker, auto-mute 2min, seats)
- [x] Monthly Star con 3 circulos (Clan, Recarga centro, Pareja)
- [x] Semanales: Clan Semanal, Pareja CP, Eventos con animaciones
- [x] Bot ON/OFF switch + voz muteada por defecto (persistente localStorage)
- [x] Bot con 4 modos de voz: Mujer, Hombre, Animador, Serio
- [x] Minimizar sala (pantalla flotante)
- [x] Panel de Control MAESTRO (Salas, Config, Consola, Bot IA)
- [x] Premios Clanes EDITABLES en Panel de Control
- [x] Cashback Semanal automatico (100M=10M, 500M=25M, 600M=45M)
- [x] Eventos King 1/2/3 en sala (300M/500M/1B) - boton corona en header
- [x] Eventos CP Nivel 6/7 en sala (5M por usuario)
- [x] Modo Fantasma FUNCIONAL (oculta de rankings y busquedas)
- [x] Zoom en fotos del chat (modal fullscreen al hacer click)
- [x] 10 Cofres, 7 Sobres, 15 regalos, 6 juegos en sala
- [x] Tienda en sala (Supermercado, Aristocracia, Oros, Marco, Entradas, Anillo)
- [x] Musica en sala (upload y playback)
- [x] Dashboard: lista (iconos medalla), Pareja, Clan (mismo estilo)
- [x] Dashboard Event tab con 3 tarjetas (King, CP Event, Recarga)
- [x] Flash Fame, animaciones de ganadores, entrada VIP
- [x] Upload de avatar
- [x] Notificaciones (Global, CP, Connection, Invites)
- [x] Deploy en GitHub + Contabo VPS configurado

## Pendiente / Backlog
- Ludo game WebView integration
- Refactorizar server.py (~3000 lineas) en modulos
- Mas regalos con efectos especiales animados
- Sistema de aprobacion de eventos por admin

## Credenciales
- Melvin_Live / test123 - Role: dueño
