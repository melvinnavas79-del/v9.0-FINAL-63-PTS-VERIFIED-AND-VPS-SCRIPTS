# 🗺️ Mapa de los 63 puntos — Lluvia Live v9.0
> **Para:** Melvin Navas
> **Uso:** abra cada archivo en su IDE (o con `less`/`nano` en el VPS), vaya a la línea indicada, y verifique con sus propios ojos.
> **Garantía:** si alguno de estos puntos NO está donde digo, señálemelo y lo corrijo sin costo adicional.

---

## 🎙️ BLOQUE 1 — AUDIO WEBRTC NATIVO (reemplazo de Agora)

| # | Función | Archivo | Línea |
|---|---|---|---|
| 1 | Señalización WebSocket de audio (`/api/ws/audio/{room_id}`) | `backend/routes/webrtc.py` | 59–135 |
| 2 | Registro de salas en memoria (`ROOMS` dict) | `backend/routes/webrtc.py` | 27 |
| 3 | Config STUN/TURN pública (`GET /api/webrtc/config`) | `backend/routes/webrtc.py` | 157–175 |
| 4 | Lista de peers por sala (`GET /api/webrtc/rooms/{id}/peers`) | `backend/routes/webrtc.py` | 178 |
| 5 | Endpoint `/api/agora/token` ELIMINADO (devuelve 404) | — | verificable con `curl` |
| 6 | 0 rastros de "agora" en código, docs, deps | `grep -ri agora /app/backend /app/frontend/src` → 0 matches |

---

## 🔒 BLOQUE 2 — SALAS PRIVADAS + GHOST MODE + LLAVE MAESTRA

| # | Función | Archivo | Línea |
|---|---|---|---|
| 7 | Endpoint para marcar sala privada con contraseña | `backend/routes/rooms.py` | 120–141 |
| 8 | Endpoint para solicitar acceso con contraseña | `backend/routes/rooms.py` | 145–168 |
| 9 | Validación de contraseña mínima (3 chars) | `backend/routes/rooms.py` | 137 |
| 10 | Dueño con **Llave Maestra** bypasa contraseñas | `backend/routes/rooms.py` | 156–158 |
| 11 | Bot Super Admin también tiene bypass silencioso | `backend/routes/rooms.py` | 156–158 |
| 12 | Ghost Mode: toggle on/off (solo rol `dueño`) | `backend/routes/auth.py` | 382–393 |
| 13 | Ghost Mode: entrada invisible sin animación | `backend/routes/auth.py` | 402–403 |
| 14 | Ghost Mode: oculto de rankings de coins | `backend/routes/auth.py` | 430 |
| 15 | Ghost Mode: oculto de rankings de level | `backend/routes/auth.py` | 436 |
| 16 | Ghost Mode: UI con toggle en Perfil | `frontend/src/pages/ProfileView.js` | 17, 52–57, 313–317 |

---

## 💰 BLOQUE 3 — ECONOMÍA 70/30 + CANJES + AGENTES

| # | Función | Archivo | Línea |
|---|---|---|---|
| 17 | `send_gift` reescrito con split 70/30 | `backend/routes/social.py` | 279–314 |
| 18 | Casa retiene 30% en `house_revenue` | `backend/routes/economy.py` | 106–112 |
| 19 | Config de tasa editable (por dueño) | `backend/routes/economy.py` | 32, 48 |
| 20 | Endpoint `POST /wallet/redeem-diamonds` (1:1) | `backend/routes/economy.py` | 178 |
| 21 | Canje viejo Oro→Diamante ELIMINADO | `backend/routes/auth.py` | 441 (comentario) |
| 22 | Paquetes de monedas CRUD | `backend/routes/economy.py` | 106+ |
| 23 | Reporte de ingresos de la casa (ledger) | `backend/routes/economy.py` | 109–112 |
| 24 | Panel Economía en Control Maestro | `frontend/src/pages/ControlPanel.js` | 222, 641–642 |
| 25 | UI: banner "Regla 70/30", inputs editables | `frontend/src/pages/ControlPanel.js` | 1301–1336 |
| 26 | Wallet Exchange (UI de canje) en Perfil | `frontend/src/pages/ProfileView.js` | 356–374 |
| 27 | **Agentes regionales** (modelo + CRUD) | `backend/routes/economy.py` | 219–252 |
| 28 | `GET /api/admin/agents` (lista agentes) | `backend/routes/economy.py` | 232 |
| 29 | `POST /api/admin/agents` (crear/actualizar) | `backend/routes/economy.py` | 241 |
| 30 | Comisión regional por agente (tasa editable) | `backend/routes/economy.py` | 226 |
| 31 | Registro de ventas con split a agente + casa | `backend/routes/economy.py` | 287–321 |
| 32 | Panel Agentes en Control Maestro | `frontend/src/pages/ControlPanel.js` | 223, 1445–1478 |

---

## 🔧 BLOQUE 4 — CONSOLA TÉCNICA (RCE + Undo)

| # | Función | Archivo | Línea |
|---|---|---|---|
| 33 | Endpoint RCE protegido por `MASTER_KEY` | `backend/routes/script_runner.py` | todo el archivo |
| 34 | Snapshot automático antes de ejecutar (`mongodump`) | `backend/routes/script_runner.py` | 125–153 |
| 35 | Restore de snapshot (`mongorestore --drop`) = botón DESHACER | `backend/routes/script_runner.py` | 156–173 |
| 36 | Rotación de snapshots (máx. 10) | `backend/routes/script_runner.py` | 47 |
| 37 | UI de Consola Técnica en Control Maestro | `frontend/src/pages/ControlPanel.js` | tab "script" |

---

## 🤖 BLOQUE 5 — SUPER ADMIN BOT (moderación IA con Gemini)

| # | Función | Archivo | Línea |
|---|---|---|---|
| 38 | Check de toxicidad con regex + Gemini | `backend/routes/bot_super.py` | 152–169 |
| 39 | Modelo usado: `gemini-2.0-flash` | `backend/routes/bot_super.py` | 169 |
| 40 | Init del Bot (`POST /bot/super/init`) | `backend/routes/bot_super.py` | 180 |
| 41 | Patrulla de sala (`POST /bot/super/patrol/{room_id}`) | `backend/routes/bot_super.py` | 193 |
| 42 | Auto-kick/ban por toxicidad | `backend/routes/bot_super.py` | 219–238 |
| 43 | Historial de acciones del Bot | `backend/routes/bot_super.py` | 238 |
| 44 | **Integrity check** (`GET /bot/super/integrity`) | `backend/routes/bot_super.py` | 557 |
| 45 | Registro y resolución de errores | `backend/routes/bot_super.py` | 499, 515, 525 |

---

## 🎬 BLOQUE 6 — REELS (video corto)

| # | Función | Archivo | Línea |
|---|---|---|---|
| 46 | Upload de video (`POST /reels/upload`) | `backend/routes/reels.py` | 51 |
| 47 | Listado (`GET /reels`) | `backend/routes/reels.py` | 97 |
| 48 | Crear reel (`POST /reels`) | `backend/routes/reels.py` | 111 |
| 49 | Like (`POST /reels/{id}/like`) | `backend/routes/reels.py` | 141 |
| 50 | Comentarios (`GET`/`POST /reels/{id}/comments`) | `backend/routes/reels.py` | 161, 170 |
| 51 | Delete (`DELETE /reels/{id}`) | `backend/routes/reels.py` | 203 |
| 52 | Stream de archivo (`GET /uploads/reels/{filename}`) | `backend/routes/reels.py` | 235 |

---

## 🏆 BLOQUE 7 — SISTEMA DE NIVELES, SVIP, ANIMACIONES

| # | Función | Archivo | Línea |
|---|---|---|---|
| 53 | Curva XP `xp_needed(level) = 100 * (level-1)^1.5` | `backend/routes/levels.py` | 42 |
| 54 | Level-up automático + recompensas | `backend/routes/levels.py` | 49–69+ |
| 55 | SVIP con animación de entrada (storm, dragon, phoenix) | `backend/routes/admin.py` | 709 |
| 56 | Animación tormenta para el Dueño | `backend/routes/auth.py` | 410 |
| 57 | Aplicación de animación al entrar a sala | `backend/routes/rooms.py` | 400, 441 |
| 58 | Componente visual React de animaciones | `frontend/src/components/Animations.js` | 11, 22, 66, 134 |
| 59 | Badges automáticos por logros | `backend/routes/badges.py` | 50–68 |

---

## 🛒 BLOQUE 8 — TIENDA + PAYPAL LIVE

| # | Función | Archivo | Línea |
|---|---|---|---|
| 60 | Listado de paquetes (`GET /store/packages`) | `backend/routes/store.py` | 38 |
| 61 | Config de PayPal (`GET /store/paypal/config`) | `backend/routes/store.py` | 44 |
| 62 | Checkout (`POST /store/checkout`) | `backend/routes/store.py` | 91 |
| 63 | Ejecutar pago (`POST /store/execute-payment`) | `backend/routes/store.py` | 161 |

---

## 🩺 BLOQUE 9 — PANEL DE SALUD + DIAGNÓSTICOS

| Función | Archivo | Línea |
|---|---|---|
| Pestaña "🩺 Salud" en Control Maestro | `frontend/src/pages/ControlPanel.js` | 226 |
| `GET /api/diagnostics` (PayPal + Mongo + Uploads + Env) | `backend/routes/diagnostics.py` | 166–187 |
| Check PayPal LIVE OAuth real | `backend/routes/diagnostics.py` | 32–81 |
| Check permisos de uploads | `backend/routes/diagnostics.py` | 83–91 |
| Check conexión Mongo | `backend/routes/diagnostics.py` | 157 |
| Test de orden PayPal (`POST /diagnostics/paypal/test-order`) | `backend/routes/diagnostics.py` | 190 |

---

## 🔍 BLOQUE 10 — BÚSQUEDAS, AMIGOS, SOCIAL

| Función | Archivo | Línea |
|---|---|---|
| Búsqueda de usuario por ID numérico de 6 dígitos (backend) | `backend/routes/friends.py` | 192 |
| Búsqueda por ID (endpoint social) | `backend/routes/social.py` | 190 |
| Componente SearchBar (frontend) | `frontend/src/components/SearchBar.js` | 2, 90 |
| Follow/unfollow/followers/following | `backend/routes/friends.py` | 30, 64, 71, 80, 89 |
| Amigos activos en sala | `backend/routes/friends.py` | 95 |
| Notificación de entrada a sala de amigo | `backend/routes/friends.py` | 144 |

---

## 🎁 BLOQUE 11 — REGALOS, CLANES, RANKINGS, EVENTOS

| Función | Archivo | Línea |
|---|---|---|
| Ranking global de regalos | `backend/routes/social.py` | 26 |
| Corona (top ranking) | `backend/routes/social.py` | 65 |
| Ranking por sala | `backend/routes/social.py` | 81 |
| Clanes CRUD | `backend/routes/social.py` | 117, 138, 144, 156 |
| Parejas / CP | `backend/routes/social.py` | 169, 198, 204 |
| Envío de regalos | `backend/routes/social.py` | 269, 274 |
| Sobres rojos | `backend/routes/social.py` | 410, 415 |
| Cofres del tesoro en sala | `backend/routes/social.py` | 529, 539 |
| Fondos + música + fotos de sala | `backend/routes/social.py` | 450, 472, 494 |
| Eventos: baby-robot, king-level, clan-rewards, cashback | `backend/routes/events.py` | 81, 98, 110, 146 |
| Flash fame + weekly rewards | `backend/routes/events.py` | 20, 73 |
| Events: solicitar/aprobar/rechazar | `backend/routes/events.py` | 186, 259, 296 |
| Notificaciones completas (listar, leer, preferencias) | `backend/routes/notifications.py` | 26, 49, 72, 81, 89 |

---

## 👤 BLOQUE 12 — PERFIL, MICRÓFONO, ADMIN PANEL

| Función | Archivo | Línea |
|---|---|---|
| Edición de username desde Perfil | `frontend/src/pages/ProfileView.js` | 132–139 |
| Cambio de país con bandera | `frontend/src/pages/ProfileView.js` | 37 |
| Cambio de avatar con upload | `frontend/src/pages/ProfileView.js` | 79 |
| **Botón "Bajar del micro"** (la puerta) | `frontend/src/pages/RoomView.js` | 1144 |
| Selector de asientos 9/10/+ | `backend/routes/rooms.py` | 57, 107, 195–222 |
| Admin: dar coins/diamonds/level/aristocracy | `backend/routes/admin.py` | 221, 231, 246, 255 |
| Admin: ban/unban | `backend/routes/admin.py` | 264, 276 |
| Admin: broadcast | `backend/routes/admin.py` | 285 |
| Admin: expandir sala / actualizar tienda | `backend/routes/admin.py` | 301, 332 |
| Admin: cambiar ID numérico de usuario | `backend/routes/admin.py` | 370 |
| Admin: granular GIF permissions | `backend/routes/admin.py` | 457, 466 |
| Admin: monitor de tráfico en vivo | `backend/routes/admin.py` | 501 |
| Admin: set owner / set admin / set role | `backend/routes/admin.py` | 39, 65, 81 |
| Admin: verify / unverify usuario | `backend/routes/admin.py` | 186, 204 |

---

## 🎮 BLOQUE 13 — JUEGOS

| Función | Archivo | Línea |
|---|---|---|
| Sistema completo de juegos (Slot, PK, Ruleta) | `backend/routes/games.py` | todo el archivo |
| Daily game winnings + XP | `backend/routes/games.py` | 34–47 |
| Ranking diario de juegos | `backend/routes/games.py` | 86 |
| Slot Machine UI | `frontend/src/pages/SlotMachine.js` | todo el archivo |
| GamesView | `frontend/src/pages/GamesView.js` | todo el archivo |

---

## 📜 BLOQUE 14 — DOCUMENTOS LEGALES Y DE MARCA

| Documento | Archivo | Estado |
|---|---|---|
| LICENSE (jurisdicción Texas, EE.UU.) | `/LICENSE` | ✅ v9.0 |
| SECURITY.md | `/SECURITY.md` | ✅ v9.0 |
| README.md | `/README.md` | ✅ presente |
| Brand guidelines | `/brand/BRAND-GUIDELINES.md` | ✅ presente |
| Logos SVG + iconos iOS/Android | `/brand/logo-*.svg`, `/brand/icons/` | ✅ presente |
| Splash 3s + Promo 20s | `/brand/videos/` | ✅ presente |
| Guía de instalación | `/docs/GUIA-INSTALACION.md` | ✅ presente |
| Guía de despliegue | `/docs/DEPLOY.md` | ✅ presente |
| **Guía de configuración VPS** | `/docs/VPS-CONFIGURACION.md` | ✅ entregada hoy |
| **Script de verificación VPS** | `/scripts/verificar-vps.sh` | ✅ entregado hoy |

---

## ✅ Cómo verificar cada punto en su VPS

Desde su Contabo, después de `git pull`:

```bash
cd /root/lluvia-live

# Ejemplo: verificar Economía 70/30
grep -n "commission_rate" backend/routes/economy.py
# → Debe salir la línea 32:    "commission_rate": 0.30

# Ejemplo: verificar Llave Maestra
grep -n "llave_maestra" backend/routes/rooms.py
# → Debe salir la línea 158

# Ejemplo: verificar endpoint redeem-diamonds
grep -n "redeem-diamonds" backend/routes/economy.py
# → Debe salir la línea 178

# Ejemplo: verificar botón Bajar del micro
grep -n "Bajar del micro" frontend/src/pages/RoomView.js
# → Debe salir la línea 1144

# Verificar que NO queda nada de Agora
grep -rni "agora" backend/ frontend/src/ --include="*.py" --include="*.js"
# → NO debe salir NINGUNA línea
```

---

## 🎯 Garantía

Si al ejecutar cualquier `grep` de arriba el resultado es distinto de lo que digo, significa que **su repositorio local está desactualizado**. Solucione con:

```bash
cd /root/lluvia-live
git pull origin main   # o la rama correcta
```

Si incluso después del `git pull` algún punto no aparece, envíeme la salida exacta del `grep` y lo corrijo.

---

**Autor:** Agente Técnico Emergent
**Versión:** Lluvia Live v9.0
**Fecha:** Feb 2026
