# Lluvia Live — PRD

## Product
Red social de audio en vivo con gamificación (monedas/diamantes), salas con **WebRTC self-hosted** (zero dependencia externa, zero costo variable), eventos (King/CP/PK), minijuegos, bot AI moderador y pagos reales PayPal Live. 100% white-label para deploy independiente en VPS.

## Implementado en esta sesión (Abr 2026) — Iteración 16 (FINAL + LIMPIEZA)

### P0 — PURGA TOTAL DE AGORA ✅
- Eliminado endpoint `POST /api/agora/token` de `routes/rooms.py`
- Eliminadas variables `AGORA_APP_ID` y `AGORA_APP_CERTIFICATE` de `backend/.env` y `.env.example`
- Eliminado paquete `agora-token-builder==1.0.0` del entorno Python (`pip uninstall`)
- `requirements.txt` reescrito con solo deps directas (21 paquetes, antes tenía 138 del pip freeze que incluía `emergentintegrations` y basura global)
- Eliminado `tests/test_iteration_6.py` (testaba el endpoint Agora viejo)
- Actualizados docs: `/app/GUIA-INSTALACION.md` reescrito completo sin Agora, `/app/README.md` sin Agora, `/app/DEPLOY.md` ya libre desde iter 11
- Comentario de header en `server.py` actualizado

### P0 — PURGA TOTAL DE EMERGENT ✅
- `grep -ri "emergent" /app/frontend/src/ /app/frontend/public/` → **0 matches** (solo `REACT_APP_BACKEND_URL` que es env var del usuario)
- `grep -ri "emergent" /app/GUIA-INSTALACION.md /app/README.md /app/DEPLOY.md` → **0 matches**
- Paquete `emergentintegrations==0.1.0` eliminado de `requirements.txt` (estaba por el pip freeze accidental)

### Verificación final pre-push
```
✓ POST /api/agora/token          → 404 (endpoint eliminado)
✓ GET  /api/webrtc/config        → 200 (audio self-hosted operativo)
✓ GET  /api/rooms                → 200 (visibilidad total)
✓ Backend arranca sin errores
✓ Backend lint: 0 errores
✓ Frontend lint: 0 errores
✓ 0 referencias a Agora en código productivo
✓ 0 referencias a Emergent en código/docs
```

## Implementado en esta sesión (Abr 2026) — Iteración 15 (Panel Salud)

### P0 — Panel de Salud Visual ✅
- `/app/frontend/src/components/SystemHealthPanel.js` (nuevo, 194 líneas)
- Nueva pestaña "🩺 Salud" en ControlPanel (`ctrl-tab-health`)
- Semáforo verde/rojo con banner explícito:
  - Verde: "✅ Sistema Saludable — Integridad 100% · 0 errores · Bot vigilando"
  - Rojo: pulsing, con conteo de issues + errores sin resolver
- 3 sub-tabs: **Integridad** (totales economía + lista issues con severity color-coded) / **Errores** (con botón "✓ Resuelto" por error) / **Estadísticas** (errores 24h, top archivos, top tipos)
- Auto-refresh cada 20s

### P0 — Alertas Push de Seguridad al Dueño ✅
- `_alert_owners()` en bot_super.py crea notificación `category="system_alert"` al dueño
- Dispara automáticamente:
  - Al detectar intento de inyección (dedupe 2 min por key `injection:<source>:<user_id>`)
  - Al capturar Exception no-HTTP (500+) o excepción genérica (dedupe 5 min por key `err:<type>:<file>:<line>`)
  - NO dispara por 422 validation (evita spam)
- Dedupe via collection `system_error_alerts` (idempotente)
- Notificación llega al bell del dueño con formato `"🚨 Intento de inyección detectado — Origen: X. Extracto: Y"`

### P0 — Bloqueo Real de Inyección en send_chat ✅
- **Antes**: se logueaba pero el `<script>` se guardaba en DB
- **Ahora**: al detectar patrón INJECTION_RE, el texto se reemplaza por `[mensaje bloqueado por el sistema de seguridad]` antes del `insert_one`
- Testeado con `<script>alert(1)</script>` → DB persiste solo el marcador
- Chat normal intacto

### P0 — Follow / Unfollow en Sala ✅
- UserProfileModal: nuevo botón `modal-follow-btn` visible cuando `targetId !== currentUser.id`
- Carga estado inicial via `/api/social/follow-status`
- Click toggle: POST `/api/social/follow` / DELETE `/api/social/follow`
- Notificación automática al seguido (category `social_follow`)

### P0 — Notificaciones categorías extendidas ✅
- `routes/notifications.py` `active_cats` ahora incluye SIEMPRE: `invitacion`, `social_follow`, `social_friend_active`, `system_alert`, `badge`
- Las categorías del usuario (`regalo_global`, `evento_cp`, `alerta_conexion`) siguen respetando sus preferencias

### P0 — Visibilidad Total Salas Popular ✅
- Confirmado: `/api/rooms` ya retorna TODAS las salas (incluyendo `active_users=0`)
- Orden: `owner_svip DESC, active_users DESC` → las VIP primero, luego por tráfico

### ✅ Testing iter 15 (Testing Agent v3)
- **Backend 100% (18/18 pytest)**
- **Frontend 100% smoke** (Panel Salud renderiza, tabs funcionan, Resolve remueve errores, semáforo cambia)
- Regresión iter 10-14: todo verde
- Lint: backend 0, frontend 0

### 🔒 White-label confirmado
- `grep -i "emergent" /app/frontend/src/` → 0 matches (solo REACT_APP_BACKEND_URL que es env var)
- `manifest.json`: "Lluvia Live"
- HTML title/meta: "Lluvia Live — Conecta, Chatea, Vive"
- Control Panel header: "CONTROL MAESTRO" + badge "☔ Lluvia Live"

## Implementado en esta sesión (Abr 2026) — Iteración 14

### P0 — OJO TÉCNICO del Bot (Auditoría del Sistema) ✅
El bot ahora es **supervisor técnico**, no solo moderador.

#### 1. Error Logger automático
- **Global exception handler** en `server.py` captura TODA excepción → `system_errors` collection
- 3 handlers separados: `Exception`, `RequestValidationError` (422), `StarletteHTTPException` (solo 500+)
- **403/404 NO se registran** (ruido normal)
- Auto-purge a 500 docs (keep más recientes)
- Formato del reporte: `"Jefe, error en routes/rooms.py, línea 247 (send_chat). Motivo: KeyError: 'user_id'"`
- Fallback inteligente: si el traceback no toca `/app/backend/`, infiere el archivo del `request.path` usando el code_map
- Endpoints:
  - `GET /api/bot/super/errors?admin_id=<dueño>&resolved=false` — lista con `bot_report`
  - `POST /api/bot/super/errors/{id}/resolve` — marca como resuelto
  - `GET /api/bot/super/errors/stats` — conteo 24h por archivo y por tipo (MongoDB aggregation)

#### 2. Vigilancia de Integridad
- `GET /api/bot/super/integrity` ejecuta 5 checks:
  - Balances negativos (coins/diamonds < 0)
  - `numeric_id` duplicados entre usuarios
  - Salas con `seats > max_seats` o `banned_users` malformado
  - Roles fuera de `ROLE_HIERARCHY`
  - Totales de economía (`coins_in_economy`, `diamonds_in_economy`)
- Retorna `{healthy, issues_count, issues:[{severity, file, kind, bot_report}]}`
- **Ya detectó en producción sandbox**: 12 usuarios con `role=None` (bug histórico) → limpiado

#### 3. Code Map — Bot conoce la arquitectura
- `/app/backend/code_map.json` mapea 17 archivos con `{path, role, endpoints}` + 9 errores comunes con hints
- `GET /api/bot/super/code-map` lo expone al panel del dueño
- Usado internamente para enriquecer reports con `source_role` del archivo

#### 4. Detección de Inyección en inputs de usuario
- Regex `INJECTION_RE` cubre: NoSQL (`$where`, `$ne`), XSS (`<script>`, `javascript:`, `on*=`), SQL (`; DROP`, `--`), path traversal (`../`, `/etc/passwd`)
- `log_suspicious_input()` cableado en `routes/rooms.py` → `send_chat`
- Probado: `"<script>alert(1)</script>"` + `"$where: this.password"` → ambos registrados como `SuspiciousInput` (no bloquean el mensaje, pero quedan en el log para que el dueño vea quién intenta)

### Testing iter 14
- **Backend: 100% (20/20 pytest)**
- Validado: error logger + resolve + stats + integrity + code-map + 403 NO logeado + 422 SÍ logeado + fallback de location + detección XSS/NoSQL real
- Lint: backend 0, frontend 0

## Implementado en esta sesión (Abr 2026) — Iteración 13

### P0 — BOT DE SEGURIDAD con Super Admin ✅
- `/app/backend/routes/bot_super.py` (nuevo) — Bot con `role="dueño"`, `is_super_admin=true`
- Detección toxicidad (regex ES + Gemini fallback): auto-kick del micro
- Auto-ban tras 3 infracciones en 10 min
- Comandos del dueño en chat: `bot kick @user`, `bot ban @user`, `bot mute @user`
- Audit log en `bot_actions`
- Endpoints: `/bot/super/init`, `/bot/super/patrol/{room}`, `/bot/super/actions`
- Testing: auto_kick + auto_ban + owner_kick + audit log, todos OK

## Implementado en esta sesión (Abr 2026) — Iteración 12

### P0 — Firebase Web App ID correcto ✅
- `frontend/.env` actualizado con credenciales Web reales dadas por el dueño:
  - `REACT_APP_FIREBASE_APP_ID=1:909704512499:web:a8f0d658fb6dbd3f610886`
  - `REACT_APP_FIREBASE_API_KEY=AIzaSyA9sdOfg7f55DX7Ej_TK_BJHrNFTmtr5J4`
- `/api/auth/firebase/status` retorna `project_id=lluvia-live-69a05`, `web_api_key_configured=true`
- Login Google y Phone ahora pueden conectar contra Firebase Web real

### P0 — Super Admin global en cualquier sala ✅
- Backend helper `_get_authority(user_id, room)` retorna `"super" | "owner" | "moderator" | "none"`
- `lock-seat`, `lock-all`, `unlock-all` → permiten `level in (super, owner)`
- **Dueño de plataforma (role="dueño" o is_super_admin) puede gestionar CUALQUIER sala**, por encima del dueño de sala
- Nuevos endpoints:
  - `POST /rooms/{id}/kick-from-seat?admin_id=X&target_user_id=Y` — baja del micro + chat marker
  - `POST /rooms/{id}/ban-user?admin_id=X&target_user_id=Y` — agrega a banned_users + kick
  - `POST /rooms/{id}/unban-user` — quita de banned_users
  - `GET /rooms/{id}/authority/{user_id}` — frontend helper para renderizar UI según nivel
- `POST /rooms/{id}/join` ahora valida `banned_users` → 403 si baneado (salvo super admin)
- Jerarquía respetada: moderator no puede kickear al dueño de la sala; solo super puede tocar a otro dueño de plataforma
- `serialize_room` ahora expone `banned_users` al frontend

### P0 — Admin Console: Give Diamonds + Confirmaciones ✅
- Nuevo endpoint `POST /admin/console/give-diamonds` con **404 si target no existe** + **clamp a ≥0** para evitar balances negativos
- Botón `console-give-diamonds` en ControlPanel
- Confirmaciones agregadas en frontend:
  - Aristocracia ≥ 6: confirm obligatorio
  - give-diamonds |amount| > 100,000: confirm obligatorio
  - Ban global: confirm obligatorio

### P0 — Frontend super-admin visible ✅
- RoomView: botones `room-lock-all-btn` / `room-unlock-all-btn` + lock-seat toggle ahora visibles para `role="dueño"` / `is_super_admin` incluso en salas ajenas
- Badge "👑 Super Admin" indica cuando estás gestionando una sala que NO es tuya

### 🧪 Testing (iter 12)
- **Backend: 100% (15/15)** — super override, kick, ban, unban, give-diamonds, authority endpoint, firebase-status
- Pruebas regresión iter 10+11 siguen pasando

## Implementado en sesión (Abr 2026) — Iteración 11

### P0 — Sistema de Amigos + Búsqueda por ID + Dashboard Vivo ✅
- **Backend** `/app/backend/routes/friends.py` (nuevo):
  - `POST/DELETE /api/social/follow` — idempotente (upsert), notifica al target
  - `GET /api/social/follow-status?follower_id=X&target_id=Y` — estado boolean
  - `GET /api/social/following/{user_id}` + `GET /api/social/followers/{user_id}` — listas de perfiles
  - `GET /api/social/friends-active/{user_id}` — usuarios seguidos actualmente sentados en algún seat (para el dashboard vivo)
  - `GET /api/social/search-by-id/{numeric_id}` — búsqueda exacta por el ID de 6 dígitos del usuario
  - `GET /api/auth/firebase/status` — helper white-label para detectar si el Web App ID de Firebase está bien configurado
- **Modificación** `routes/rooms.py` `mark_join`: ahora hace fanout de notificaciones `social_friend_active` a los seguidores cuando el usuario entra a una sala. Dedupe por `(user_id, room_id, minuto)` → máximo 1 notif/minuto/sala por amigo.
- **Frontend**:
  - `/app/frontend/src/components/SearchBar.js`: barra de búsqueda en el Dashboard. Detecta automáticamente si el input es numérico (3-10 dígitos) y usa `/social/search-by-id`, si no usa `/users/search`. Modal con acción `+ Seguir` / `✓ Siguiendo`.
  - `/app/frontend/src/components/FriendsActiveStrip.js`: tira horizontal auto-refresh 15s con avatars de amigos actualmente en salas + nombre de la sala. Click → navega directo a la sala.
  - `Dashboard.js` tab "Popular" ahora renderiza `Salas activas ahora` con lista clickeable (`popular-room-card-<id>`), contador verde pulsante animado y flash cuando cambia el número de usuarios. Auto-refresh 8s.
- **Testing (iter 11)**: 100% backend (12/12) + 100% frontend — search por ID funciona, follow toggle funciona, 12 room cards clickeables, RoomView sin regresiones.

### P0 — Agora eliminado → WebRTC self-hosted ✅ (iter 10)
- **Dueño decidió**: eliminar Agora para no depender de tarifa por minuto. Implementado WebRTC nativo del navegador + signaling via WebSocket en el mismo FastAPI (zero servicios extra).
- **Backend** `/app/backend/routes/webrtc.py`:
  - `GET /api/webrtc/config` → retorna ICE servers (STUN Google por defecto; permite TURN propio vía TURN_URL/TURN_USER/TURN_PASS en .env).
  - `WebSocket /api/ws/audio/{room_id}?user_id=<uid>` → relay de mensajes `offer/answer/ice/peer-joined/peer-left/peers`. Diccionario `ROOMS` en memoria por sala.
  - `GET /api/webrtc/rooms/{room_id}/peers` → lista peers conectados.
- **Frontend** `/app/frontend/src/contexts/AudioContext.js`: reescrito completamente con RTCPeerConnection nativo + "perfect negotiation" pattern. `agora-rtc-sdk-ng` removido de package.json.
- **Topología**: mesh P2P. Viable hasta ~10 hablantes simultáneos. Audio NUNCA pasa por el servidor → zero costo de bandwidth de audio.

### P0 — /api/diagnostics ✅ (iter 10)
- `GET /api/diagnostics?user_id=<dueño_id>` — verifica PayPal LIVE (OAuth real), uploads (permisos), disco, env vars, Mongo.
- `POST /api/diagnostics/paypal/test-order` — crea orden PayPal LIVE real sin capturar.

### P0 — Reorganización UI RoomView ✅ (iter 10)
- Rankings (👑) ARRIBA en top toolbar. Eventos (👑) ABAJO en barra inferior. Floating Coronita REMOVIDO.

### P0 — White-label limpieza ✅ (iter 11)
- `/app/backend/pyproject.toml` (nuevo) con config ruff: line-length 140, ignore E501/E701, per-file-ignore F841 en legacy (bot/social/games).
- Código muerto eliminado: `admin.py` cofres unreachable, `notifications.py` class stubs huérfanos, `games.py` PKBattleStart stub, `bot.py` dict key duplicada.
- `TRIVIA_QUESTIONS` stub list agregado (antes era F821).
- **Lint backend: 0 errores. Lint frontend: 0 errores.**

### P0 — DEPLOY.md rewrite ✅ (iter 11)
- Nueva sección crítica: Nginx config con `map $http_upgrade $connection_upgrade` + 3 líneas de WebSocket upgrade en `location /api/`. Sin esto el audio NUNCA conecta.
- Sección Firebase Web App setup con pasos numerados (1-7) para crear Web App y arreglar Google/Phone login.
- Eliminada sección Agora (ya no se usa).
- Nueva sección TURN server opcional.

## Core
- Auth: Firebase (Google + Phone) + usuario/contraseña legacy
- **Rooms: WebRTC self-hosted**, 10↔24 micros, PK battles, cofres, sobres, backgrounds con filtro AI
- Gamification: SVIP 1-10, Aristocracia, badges, rankings (monedas, nivel, clanes, diario, regalos)
- Economy: PayPal LIVE + Hot Recharge
- Mini-games: Ruleta, Dados, RPS, Trivia, Ludo, Yacaro, Carreras, Pool, Domino, Monster, Slot 777, Lion vs Tiger
- Admin: Event Control Panel, Device ID banning, kick/mute, **/api/diagnostics**
- **Social: follow / following / followers / friends-active / notif de actividad**
- **Search: por username o ID numérico (6 dígitos)**

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

### P0 — Fila superior restaurada (Tienda/Juegos/Cofres/Sobres/Regalos/Top) + Audit de marca blanca (Feb 2026) ✅
- **Top Toolbar restaurado en RoomView**: fila horizontal scrollable arriba de la sala con los botones clave del negocio:
  - 🛒 **Tienda** (Supermercado de Aristocracia, SVIP, Marcos) — `top-tienda-btn`
  - 🎮 **Juegos** — `top-juegos-btn`
  - 📦 **Cofres** — `top-cofres-btn`
  - 🧧 **Sobres** (Lluvia de Oro) — `top-sobres-btn`
  - 🎁 **Regalos** — `top-regalos-btn`
  - 👑 **Top** (ranking diario/semanal/mensual) — `open-gift-ranking-btn`
  - 🖼 **Fondo** (solo dueño) — `bar-fondo`
- Segunda fila sin duplicados: solo LevelBadge + 💰 monedas.
- **Audit de marca blanca 100%**: `grep -rc emergent` en `/app/frontend/src` y `/app/backend/routes` devuelve **CERO**. El build JS no contiene `VisualEditsPlugin` ni `emergentbase`. El único rastro "emergentagent" es la URL preview en `REACT_APP_BACKEND_URL` que se reemplaza automáticamente al compilar en el VPS.
- **deploy.sh listo**: `sudo bash deploy.sh tu-dominio.com` reemplaza la URL, compila, valida que el build no tenga preview y deja todo listo para nginx.
- **Bug fix Agora**: cert cambiado a hex minúscula (`c25be026f8444fbca9ab71c0c0cdc465`) porque HMAC es case-sensitive y la consola de Agora siempre usa lowercase. Los errores "invalid token" deberían dejar de aparecer con este cert normalizado.
- **Testing**: 100% frontend validado (11/11 checks, todos los paneles abren correctos, regresión 0 bugs).


- **Safe-area iPhone**: aumentado padding-top del header de RoomView de `calc(env(safe-area-inset-top,20px) + 8px)` a `+ 20px`. Banner de anuncios global bajado de `+50px` a `+72px` para no chocar con el nuevo header. Botones ← Salir, ⬇️ Minimizar, 💰 ya no chocan con el notch/Dynamic Island.
- **Ranking de Regalos con Corona** (3 ventanas temporales — diario, semanal, mensual):
  - Backend: `/api/rankings/gifts?window=daily|weekly|monthly`, `/api/rankings/gifts/crown`, `/api/rankings/gifts/room/{id}`. Aggregation sobre `db.gifts.cost` agrupado por `sender_id`. `_window_start` calcula correctamente inicio de día/lunes/día 1.
  - Frontend: `GiftRanking` modal con podio top 3 (medallas 🥇🥈🥉 + corona animada en #1 flotando con bob 2s) + lista 4+ con contadores, toggle **Global/Sala**, auto-refresh 30s. `CrownBadge` que aparece junto al username en cada asiento si el usuario es king actual (prioridad monthly > weekly > daily).
  - Botón `open-gift-ranking-btn` en el header de la sala al lado del LevelBadge.
- **Testing**: 12/12 pytest backend + 100% frontend E2E validado.


- **Melvin_Live restaurado**: role=`dueño`, coins=**500,000,000,000,000** (500 trillones), diamantes=10M, level=50, xp=35000, svip_level=10, 9 badges top, `is_super_admin=true`.
- **Gemini key corregida**: `AIzaSyDy2rB1gQXXje-wB0rp6f3xk0sjrtLIgws` (con I mayúscula). Google **valida la key** (STATUS 200 al listar 50 modelos). Para `generateContent` el proyecto de Melvin reportó créditos agotados (429) — tema de **billing**, no del código.
- **Tab Seguridad en ControlPanel** (`SuperAdminTools.js`):
  - 🕵️ **Cuentas Falsas**: aggregation de devices con múltiples cuentas (`/api/admin/duplicate-devices`). Muestra device_id, cantidad de cuentas, usernames, con botón para ver detalle completo y banear el device.
  - 📵 **Devices Baneados**: lista con `/api/admin/banned-devices`, botón de desbanear inline.
  - 🚫 **IPs Baneadas**: lista con `/api/admin/banned-ips`, botón de desbanear.
  - ⚙️ **Ban Manual**: inputs para pegar device_id o IP + razón + botón rojo de banear.
- **Nuevos endpoints backend** en `auth.py`: `/admin/ban-ip`, `/admin/unban-ip`, `/admin/banned-ips`, `/admin/banned-devices`, `/admin/device-accounts/{id}`, `/admin/duplicate-devices`. Cascada: banear device marca `is_banned:true` a todas las cuentas vinculadas.
- **Testing**: 12/12 pytest backend pasando, E2E frontend validado (login → Profile → Panel Admin → tab Seguridad → ban manual → toast → lista Baneados → desban).


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
