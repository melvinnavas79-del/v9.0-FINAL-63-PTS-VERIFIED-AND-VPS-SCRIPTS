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

## Implementado en esta sesión (Feb 2026)
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
