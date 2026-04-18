# Lluvia Live — PRD

## Product
Red social de audio en vivo con gamificación (monedas/diamantes), salas con Agora WebRTC, eventos (King/CP/PK), minijuegos, bot AI moderador y pagos reales PayPal Live. 100% white-label para deploy independiente en VPS.

## Core
- Auth: Firebase (Google + Phone) + usuario/contraseña legacy
- Rooms: Agora.io, 10↔24 micros, PK battles, cofres, sobres (lluvia de oro), backgrounds con filtro AI
- Gamification: SVIP 1-10, Aristocracia, badges automáticos, rankings (monedas, nivel, clanes, diario)
- Economy: PayPal LIVE + Hot Recharge dentro de la sala
- Mini-games: Ruleta, Dados, RPS, Trivia, Ludo, Yacaro, Carreras, Pool, Domino, Monster, Slot Machine 777, Lion vs Tiger
- Admin: Event Control Panel (traffic, flash banners, global/regional), Device ID banning, kick/mute con jerarquía SVIP

## Implemented (histórico)
- Firebase Auth + PayPal Live + Google GenAI bot
- Purga completa de dependencias proprietary (craco, emergentintegrations, tracking)
- Badges, Sobres, Cofres, PK Battles, Premium animations (Lion/Dragon), Hot Recharge
- SVIP hierarchy (1-10), Device/IP banning, Regional selectors
- Custom backgrounds + AI safety filter, 10/24 seats expand

### P0 — PayPal /config endpoint + Level-up automático + TTS nativo (Feb 2026) ✅
- **PayPal endpoints nuevos**:
  - `GET /api/store/paypal/config` → retorna `{mode, client_id, configured, currency}` para init del SDK en frontend.
  - `GET /api/store/paypal/status` → verifica credenciales vía OAuth real contra `api-m.paypal.com`. Retorna `authenticated:true` con `app_id APP-9E950290LB550220K`, scope_count, token_type, expires_in.
- **Level-up automático** (`/app/backend/routes/levels.py`):
  - Sistema de XP con curva `100*(level-1)^1.5`, niveles 1-500.
  - Fuentes: regalos enviados (+2 XP/coin), regalos recibidos (+1 XP/coin), juegos ganados (+3 +bet/100 XP), heartbeat (+10 XP/min con mic activo, throttled a 55s).
  - Milestone rewards en niveles 2/5/10/15/20/30/40/50/60/75/100 con premios escalonados (5K → 25M monedas).
  - Auto-notificación al subir de nivel con bonus coins.
  - Endpoints: `/api/levels/me/:id`, `/api/levels/leaderboard`, `/api/levels/heartbeat/:id`.
  - Frontend: `LevelBadge` con polling 30s + barra de progreso con gradiente neón (gris→cyan→violeta→rosa según nivel); `useLevelHeartbeat` hook que envía heartbeat cada minuto mientras mic activo.
- **TTS nativo (Web Speech API)** (`useTTS` hook + integración en RoomView):
  - 100% local (sin costo, sin cuota, sin servicio externo).
  - Toggle desde ToolsPanel: antes "Efecto" → ahora "Voz ON/OFF" con label dinámico.
  - Selecciona voz española automáticamente (prefiere female).
  - Lee mensajes nuevos del chat de OTROS usuarios cuando está activado.
  - Persiste preferencia en localStorage `lluvia_tts_enabled`.
- **Agora cert**: casing exacto `C25be026f8444fbca9ab71c0c0cdc465` según especificación.
- **Testing**: 9/9 backend pytest pasando, frontend wiring validado.

### P0 — Limpieza visual de la sala ✅
- **Eliminados botones duplicados** de la barra superior de RoomView: `bar-cofres`, `bar-sobres`, `bar-juegos`, `bar-tienda`. Toda la acción ahora vive en el ToolsPanel. Solo queda el indicador de monedas 💰 y (para el dueño) el botón `bar-fondo`.
- **GameResultToast** (`/app/frontend/src/components/GameResultToast.js`): toast flotante premium con animación grt-in cubic-bezier, fondo glass, bordes dorados cuando se gana. Muestra dados reales dibujados con puntos (DiceFace 1-6), reels de slots o multiplicador. Auto-dismiss ~3.2s.
- **Bug fix backend `/api/games/play` para `dados`**: `play_generic` ahora tiene rama explícita que rolea 2 dados aleatorios y devuelve `game_data={dice1,dice2,total}`. Gana si total ≥ 8 (mult 2 para 8-10, mult 3 para 11-12).
- **ToolsPanel BubbleCircle** repotenciado con 3 capas de highlights para look 3D/glossy Grandes Ligas: top specular gloss, punto especular, rim shadow inferior.

## Implementado en esta sesión (Feb 2026)

### P0 — Diagnóstico y blindaje de deploy ✅
- **Hallazgo**: la app NO tenía bugs funcionales. Todos los endpoints respondían 200, login funcionaba, salas cargaban, audio conectaba. La "huella" `VisualEditsPlugin` que aparecía en logs era del dev-server del preview de Emergent — NO forma parte del `yarn build` de producción (verificado: `package.json` está 100% limpio, build de producción `Compiled successfully` sin warnings).
- **Blindaje Gemini**: `ai_moderate_image` ahora detecta `placeholder_key`, `placeholder`, `your_key_here`, `tu_key_aqui`, string vacío y whitespace — fail-opens con `ai_key_not_configured` antes de llamar a `google.genai.Client`. Evita que keys de prueba crasheen el endpoint.
- **Guía de despliegue**: `/app/DEPLOY.md` con instrucciones VPS completas (nginx, systemd, .env real, dónde obtener cada key externa).
- **Nota crítica para deploy**: la `REACT_APP_BACKEND_URL` queda baked-in en el bundle de JS al compilar. Cambiar el valor en `frontend/.env` a la URL del VPS **antes** de `yarn build`.

### P0 — Refactor profesional de RoomView ✅
- Extraídos dos sub-componentes presentacionales:
  - `/app/frontend/src/components/SeatsGrid.js` (102 líneas) — grilla de 10/24 asientos con anillo neón verde cuando hablas, candado, badge SVIP.
  - `/app/frontend/src/components/ChatArea.js` (103 líneas) — lista de mensajes con autoscroll, input, upload de foto.
- `RoomView.js` bajó de 1069 a 1029 líneas y toda la lógica de negocio (axios, join/leave, regalos) quedó en RoomView — los sub-componentes son puramente visuales con props `onSeatClick`, `onSeatLongPress`, `onSend`, `onPhotoUpload`, `onZoomImage`.
- Testing agent verificó 100% sin regresiones: seat-btn-N, chat-input, chat-send-btn, tools-panel-btn, global-mini-player, todos operativos. Zero errores de consola.

### P0 — Persistencia de Audio Global / MiniPlayer ✅
- `AudioContext.js`: estado Agora global (activeRoom, isMuted, isDeafened, audioStatus, mySeat). Auto-mute tras 2 min preservado.
- `MiniPlayer.js`: componente flotante con dot de estado (verde/amarillo/rojo), botón mute, botón desconectar, botón volver a sala. Aparece cuando `activeRoom` existe y la vista activa ≠ room.
- `App.js`: envuelve app en `<AudioProvider>` y renderiza `<MiniPlayer/>` globalmente.
- `RoomView.js`: refactorizado — sin gestión local de Agora (joinAgora/leaveAgora eliminados). Botones "← Salir" y "⬇️ Minimizar" solo navegan (audio persiste). Solo el botón rojo ✕ al fondo desconecta.
- Navegación a Dashboard, Rankings, Tienda, etc. NO desconecta el audio.

### P0 — Ranking Diario de Juegos ✅
- Backend: nueva colección `daily_game_stats` `{user_id, date, total_won, total_bet, games_played}`. Helper `record_daily_win` incrementa en cada victoria de `play_generic`, `pk-battle/end`, `lion-tiger/win`, `ruleta`, `dados`, `slot-machine`.
- Endpoints: `GET /api/rankings/daily-games` (top 10 hoy + premios [3M,2M,1M]), `GET /api/rankings/daily-games/yesterday` (top 3 del día anterior).
- Distribución automática idempotente: al consultar el endpoint, si no se repartieron los premios de ayer, se reparten al top 3 y se notifica (flag en `system_flags`).
- Frontend: podio 1º/2º/3º en tab "Popular" del Dashboard + lista 4-9, auto-refresh 30s.

### P0 — ToolsPanel Premium (4x2 Glass Panel) ✅
- `/app/frontend/src/components/ToolsPanel.js`: panel flotante con fondo glass oscuro (backdrop-blur 22px + saturate), bordes 28px, ambient glow radial, 8 iconos circulares con gradientes 3D (highlight superior + inner shadow). Animación fade+slide-up 0.28s cubic-bezier; cada icono entra con stagger de 30ms.
- 8 herramientas conectadas: Sorpresa (abre Cofres), Número (ruleta rápida 1000 monedas), Dado (dados rápidos), Mora (RPS rápido random), Conmutación de Identidad (toggle ghost_mode), Borrar todo (limpia chat local), Música (abre upload), Efecto (burst emoji 1.8s).
- Integrado en `RoomView.js` con nuevo botón `tools-panel-btn` (SVG 4-cuadrados) en bottom bar junto al ✕.
- Iconos son SVG vectoriales propios (no emojis): GiftBagIcon, DiceIcon, RouletteIcon, HandIcon, SwitchIdIcon, TrashIcon, MusicIcon, EffectIcon.

### P0 — AI Image Moderation (Gemini Vision) ✅
- `/app/backend/routes/rooms.py::ai_moderate_image`: Gemini 2.0 Flash analiza cada imagen de fondo antes de guardar. Rechaza desnudez, armas, violencia, sangre, gore, drogas, odio.
- Fail-open defensivo: si `GEMINI_API_KEY` está vacío o falla la API, permite subir (no bloquea el producto en outages). Recomendación: setear key real en producción.
- Integrado en `POST /api/rooms/{room_id}/background` además del filename-blocklist previo.

## Backlog
### P1
- Sistema automático de niveles (level-up por tiempo de juego y regalos)
- Reorganización: RoomView.js sigue con >1000 líneas — extraer GiftPanels, SeatsGrid

### P2
- Google Cloud TTS / Azure TTS para el bot
- Normalizar TRIVIA_QUESTIONS (referencias rotas en games.py, ya pre-existentes)

## Tech Stack
- Frontend: React 19 + react-scripts (NO craco), Tailwind, Firebase Web SDK
- Backend: FastAPI + Motor + Pydantic
- DB: MongoDB
- Real-time: Agora.io SDK
- Pagos: PayPal REST SDK (LIVE)
- AI: Google GenAI directo

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`

## Base de datos
MongoDB `lluvia_live` (renombrada desde `test_database` en Feb 2026). Test artifacts purgados. 39 usuarios productivos, 11 salas.
