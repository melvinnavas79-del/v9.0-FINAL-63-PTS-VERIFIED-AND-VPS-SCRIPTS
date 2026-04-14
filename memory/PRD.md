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
- [x] SISTEMA DE EVENTOS CON APROBACION:
  - Solicitar Evento (boton corona en sala, visible para todos)
  - Admin aprueba/rechaza solicitudes
  - Limite mensual: 1 evento por usuario
  - King: Meta 200M juegos → Pago 3M
  - King 1: Meta 300M juegos → Pago 4M
  - King 3: Meta 500M juegos → Pago 5M
  - CP Nivel 6: 5M para cada uno de la pareja
  - CP Nivel 7: 7M para cada uno de la pareja
  - Progreso de juegos se trackea automaticamente
- [x] Modo Fantasma FUNCIONAL (oculta de rankings y busquedas)
- [x] Zoom en fotos del chat (modal fullscreen)
- [x] 10 Cofres, 7 Sobres, 15 regalos, 6 juegos en sala
- [x] Tienda en sala (Supermercado, Aristocracia, Oros, Marco, Entradas, Anillo)
- [x] Musica en sala (upload y playback)
- [x] Dashboard: lista, Pareja, Clan + Event tab
- [x] Flash Fame, animaciones, entrada VIP, notificaciones
- [x] Deploy en GitHub + Contabo VPS configurado

## Pendiente / Backlog
- Ludo game WebView integration
- Refactorizar server.py (~3000 lineas) en modulos
- Mas regalos con efectos especiales animados

## Credenciales
- Melvin_Live / test123 - Role: dueño
