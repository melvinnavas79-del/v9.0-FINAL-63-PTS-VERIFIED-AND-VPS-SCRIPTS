# Lluvia Live

Plataforma social de audio en vivo con salas, juegos, regalos y sistema de
monetización. Diseñada para alto tráfico, baja latencia y operación
completamente marca blanca.

---

## Estructura del Proyecto

```
lluvia-live/
├── LICENSE                  # Licencia propietaria (Melvin H. Navas Hernández)
├── SECURITY.md              # Política de divulgación responsable
├── README.md                # Este documento
│
├── brand/                   # Identidad visual oficial
│   ├── BRAND-GUIDELINES.md  # Guía de marca (paleta, tipografía, usos)
│   ├── logo-full-color.svg  # Logo oficial (SVG con raster embebido)
│   ├── logo-wordmark.svg    # Logo vectorial puro para impresión
│   ├── source/              # Master 1024×1024 oficial
│   ├── favicon/             # Favicons y PWA icons (14 tamaños)
│   ├── icons/               # App icons (Android mipmap + iOS Asset Catalog)
│   └── videos/              # Splash 3s + Promo 20s (vertical + horizontal)
│
├── backend/                 # API (FastAPI + MongoDB)
│   ├── server.py            # Punto de entrada
│   ├── database.py          # Conexión MongoDB y modelos
│   ├── routes/              # Módulos de rutas REST
│   │   ├── auth.py          # Login, registro, perfiles, ghost mode
│   │   ├── rooms.py         # Salas de audio, asientos, chat, privacidad
│   │   ├── webrtc.py        # Signaling WebSocket (audio self-hosted)
│   │   ├── games.py         # Mini-juegos y PK Battles
│   │   ├── social.py        # Regalos, clanes, parejas, cofres
│   │   ├── friends.py       # Follow, amigos activos, búsqueda por ID
│   │   ├── reels.py         # Feed de videos/imágenes cortos
│   │   ├── store.py         # Tienda con PayPal Live
│   │   ├── badges.py        # Medallas automáticas
│   │   ├── bot.py           # Bot IA con Google Gemini
│   │   ├── bot_super.py     # Bot Super Admin (moderación + auditoría)
│   │   ├── script_runner.py # Consola técnica con Master Key
│   │   ├── economy.py       # Regla 70/30, canjes, agentes regionales
│   │   ├── diagnostics.py   # Diagnóstico operacional (solo Dueño)
│   │   ├── events.py        # Eventos King/CP
│   │   ├── admin.py         # Panel de administración
│   │   └── notifications.py
│   ├── uploads/             # Archivos subidos (fotos, música, assets)
│   ├── tests/               # Pruebas de regresión
│   ├── requirements.txt     # Dependencias Python
│   ├── pyproject.toml       # Configuración de linters
│   └── .env.example         # Plantilla de variables de entorno
│
├── frontend/                # UI (React + TailwindCSS)
│   ├── src/
│   │   ├── pages/           # Vistas principales (Dashboard, RoomView, etc.)
│   │   ├── components/      # Componentes reutilizables
│   │   ├── contexts/        # Estado global (UserContext, AudioContext)
│   │   └── lib/             # Utilidades
│   ├── public/              # Assets estáticos
│   ├── package.json
│   └── .env.example
│
├── android-build/           # Proyecto Android Studio (WebView)
├── ios-project/             # Proyecto Xcode (WKWebView)
│
├── docs/                    # Documentación técnica
│   ├── DEPLOY.md            # Guía rápida de despliegue
│   └── GUIA-INSTALACION.md  # Guía completa paso a paso
│
└── scripts/
    └── deploy.sh            # Script de despliegue automatizado
```

---

## Instalación Rápida

```bash
# ─── Backend ──────────────────────────────────────
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # Edita con tus claves reales
uvicorn server:app --host 0.0.0.0 --port 8001

# ─── Frontend ─────────────────────────────────────
cd frontend
yarn install
cp .env.example .env          # Edita con tu dominio
yarn build                    # Compilación de producción
```

Para el despliegue completo en VPS consulta **[docs/GUIA-INSTALACION.md](docs/GUIA-INSTALACION.md)**.

---

## Tecnologías

- **Backend**: FastAPI, Motor (MongoDB async), Pydantic v2
- **Frontend**: React.js 18, TailwindCSS, shadcn/ui
- **Audio**: WebRTC nativo self-hosted con señalización por WebSocket
  (sin servicios externos, sin costos variables)
- **Pagos**: PayPal LIVE (SDK oficial)
- **IA**: Google Gemini para moderación automática
- **Base de datos**: MongoDB con réplicas opcionales
- **Autenticación**: Firebase Auth + usuario/contraseña

---

## Arquitectura de Audio

El audio viaja peer-to-peer entre navegadores usando WebRTC nativo. El
servidor solo relaya `offers`, `answers` e `ICE candidates` (<1 KB por
handshake). Cero costos de ancho de banda de audio. Para escalar más allá
de 10 hablantes simultáneos por sala se recomienda un SFU propio
(mediasoup) manteniendo el mismo protocolo de señalización.

---

## Módulos Destacados

- **🏦 Economía 70/30** — Regla configurable: la casa retiene el 30% de
  cada regalo y el creador recibe el 70% restante como diamantes. Canje
  diamantes → oros 1:1 sin pérdida.
- **🧑‍💼 Agentes de Recarga** — Red de vendedores regionales con comisión
  individual y ledger automático.
- **⚡ Consola Técnica** — Ejecución de Python y shell desde el panel del
  Dueño, protegida por Master Key, con snapshot automático y botón
  Deshacer (mongorestore).
- **👻 Modo Fantasma** — Privilegio exclusivo del Dueño para entrar a
  cualquier sala sin ser visible en listas, rankings ni conteos.
- **🔒 Llave Maestra** — Bypass automático de contraseñas en salas
  privadas para el Dueño y el Bot Administrador.
- **⛈️ Entrada Épica "La Tormenta"** — Animación con sonido de trueno
  sintético y vibración para todos los usuarios presentes cuando entra
  el Dueño.

---

## Licencia

Software propietario, propiedad exclusiva de **Melvin H. Navas Hernández**.
Consulta [LICENSE](LICENSE) para los términos completos.
Para reportar vulnerabilidades de seguridad, lee [SECURITY.md](SECURITY.md).
