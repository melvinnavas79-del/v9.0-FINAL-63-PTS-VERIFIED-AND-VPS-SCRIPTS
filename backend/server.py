"""
Lluvia Live - Main Server (Modular Architecture v2.0)
=====================================================
Clean entry point that imports all route modules.
Each module is self-contained with its own routes and logic.

Architecture:
  server.py          - App setup, CORS, mounting
  database.py        - MongoDB connection, models, helpers
  routes/
    auth.py          - Register, Login, User profile, Ghost mode, Rankings
    rooms.py         - Room CRUD, Seats, Chat, Music, Photos, Agora
    games.py         - All games, PK battles
    bot.py           - AI Bot command, auto-reply, missions, monitoring
    events.py        - King/CP events, cashback, weekly rewards
    admin.py         - Console, roles, config, staff management
    social.py        - Clanes, Parejas, Gifts, Sobres, Cofres
    store.py         - Store packages, Stripe checkout
    notifications.py - Notification CRUD, preferences
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from database import ROOT_DIR, UPLOAD_DIR, client

# ==================== APP ====================
app = FastAPI(title="Lluvia Live API", version="2.0.0", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# ==================== ROUTE REGISTRATION ====================
from routes.auth import router as auth_router
from routes.rooms import router as rooms_router
from routes.games import router as games_router
from routes.bot import router as bot_router
from routes.events import router as events_router
from routes.admin import router as admin_router
from routes.social import router as social_router
from routes.store import router as store_router
from routes.notifications import router as notif_router
from routes.badges import router as badges_router
from routes.levels import router as levels_router
from routes.webrtc import router as webrtc_router
from routes.diagnostics import router as diagnostics_router
from routes.friends import router as friends_router
from routes.bot_super import router as bot_super_router

for r in [auth_router, rooms_router, games_router, bot_router, events_router, admin_router, social_router, store_router, notif_router, badges_router, levels_router, webrtc_router, diagnostics_router, friends_router, bot_super_router]:
    app.include_router(r, prefix="/api")

# ==================== STATIC FILES ====================
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.on_event("startup")
async def startup_ensure_bot():
    """Garantiza que el usuario del Bot Super Admin exista al arrancar."""
    try:
        from routes.bot_super import _ensure_bot_user
        await _ensure_bot_user()
    except Exception as e:
        logging.getLogger("bot").warning(f"No se pudo inicializar el bot super admin: {e}")


# ==================== GLOBAL ERROR HANDLER (Ojo Técnico del Bot) ====================

@app.exception_handler(Exception)
async def _global_exception_handler(request: Request, exc: Exception):
    """
    Captura TODA excepción no controlada, la registra en system_errors vía
    el Bot Super Admin y devuelve 500 al cliente. HTTPException y errores de
    validación tienen su handler dedicado (abajo) para no inflar el log.
    """
    try:
        from routes.bot_super import log_system_error
        await log_system_error(exc, context={
            "method": request.method,
            "path": str(request.url.path),
            "query": str(request.url.query)[:300],
        })
    except Exception:
        pass
    logging.getLogger("uvicorn.error").exception(f"Unhandled error in {request.method} {request.url.path}")
    return JSONResponse(status_code=500, content={"detail": "Error interno. El bot ya notificó al administrador."})


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError):
    """Registra errores de validación del cliente (no spam: solo si son repetitivos podría ser ataque)."""
    try:
        from routes.bot_super import log_system_error
        await log_system_error(exc, context={
            "method": request.method,
            "path": str(request.url.path),
            "kind": "validation",
        })
    except Exception:
        pass
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(StarletteHTTPException)
async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
    """HTTPException: NO se registran 403/404 (normales), sí 500+."""
    if exc.status_code >= 500:
        try:
            from routes.bot_super import log_system_error
            await log_system_error(exc, context={
                "method": request.method,
                "path": str(request.url.path),
                "status_code": exc.status_code,
            })
        except Exception:
            pass
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
