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
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
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

for r in [auth_router, rooms_router, games_router, bot_router, events_router, admin_router, social_router, store_router, notif_router, badges_router, levels_router, webrtc_router, diagnostics_router, friends_router]:
    app.include_router(r, prefix="/api")

# ==================== STATIC FILES ====================
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
