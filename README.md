# Lluvia Live

Plataforma social de audio en vivo con salas, juegos, regalos y sistema de monetizacion.

## Estructura del Proyecto

```
lluvia-live/
├── backend/              # API (FastAPI + MongoDB)
│   ├── server.py         # Punto de entrada
│   ├── database.py       # Conexion MongoDB y modelos
│   ├── routes/           # Modulos de rutas
│   │   ├── auth.py       # Login, registro, perfiles
│   │   ├── rooms.py      # Salas de audio, asientos, chat, moderación
│   │   ├── webrtc.py     # Signaling WebSocket (audio self-hosted)
│   │   ├── games.py      # Mini-juegos y Lion vs Tiger
│   │   ├── social.py     # Regalos, clanes, parejas, cofres
│   │   ├── friends.py    # Follow / amigos activos / búsqueda por ID
│   │   ├── store.py      # Tienda con PayPal
│   │   ├── badges.py     # Sistema de medallas automaticas
│   │   ├── bot.py        # Bot AI con Google Gemini
│   │   ├── bot_super.py  # Bot Super Admin (moderación + Ojo Técnico)
│   │   ├── diagnostics.py# Diagnóstico operacional solo-dueño
│   │   ├── events.py     # Eventos King/CP
│   │   ├── admin.py      # Panel de administracion
│   │   └── notifications.py
│   ├── uploads/          # Archivos subidos (fotos, musica, assets)
│   ├── requirements.txt  # Dependencias Python
│   └── .env.example      # Plantilla de variables de entorno
│
├── frontend/             # UI (React + TailwindCSS)
│   ├── src/
│   │   ├── pages/        # Vistas principales
│   │   ├── components/   # Componentes reutilizables
│   │   ├── contexts/     # Estado global (UserContext)
│   │   └── lib/          # Utilidades
│   ├── public/           # Assets estaticos
│   ├── .env.example      # Plantilla de variables
│   └── package.json      # Dependencias Node
│
├── android-build/        # Proyecto Android Studio (WebView)
├── ios-project/          # Proyecto Xcode (WKWebView)
└── GUIA-INSTALACION.md   # Guia completa de despliegue en VPS
```

## Instalacion Rapida

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # Editar con tus claves
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend
cd frontend
yarn install
cp .env.example .env    # Editar con tu dominio
yarn build              # Para produccion
```

## Tecnologias
- **Backend**: FastAPI, Motor (MongoDB async)
- **Frontend**: React.js, TailwindCSS
- **Audio**: WebRTC nativo self-hosted (señalización por WebSocket en el mismo FastAPI — cero servicios externos, cero costos variables)
- **Pagos**: PayPal LIVE (SDK oficial)
- **Bot AI**: Google Gemini (SDK oficial)
- **Base de datos**: MongoDB

## Arquitectura de Audio (importante)
El audio viaja peer-to-peer entre navegadores usando WebRTC nativo. El servidor solo relaya offers/answers/ICE candidates (<1KB por handshake). Zero costos de bandwidth de audio. Para escalar más allá de 10 hablantes simultáneos por sala se recomienda un SFU propio (mediasoup) manteniendo el mismo protocolo de señalización.

## Licencia
Propiedad exclusiva de Lluvia Live. Todos los derechos reservados.
