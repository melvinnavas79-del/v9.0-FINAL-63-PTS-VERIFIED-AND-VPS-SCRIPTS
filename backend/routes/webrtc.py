"""
WebRTC Signaling Server - 100% self-hosted, zero cost.
=======================================================
Reemplaza Agora con WebRTC nativo del navegador + señalización via WebSocket.

Arquitectura:
- Cada sala tiene un "room" de señalización en memoria
- Peers se conectan por WebSocket a /api/ws/audio/{room_id}?user_id=X
- Server relaya offers/answers/ICE candidates entre peers
- El audio NUNCA pasa por nuestro servidor (es P2P puro entre navegadores)
- Zero costo de ancho de banda de audio
- Zero dependencia externa

Topología: Full mesh (hasta ~10 hablantes simultáneos). Para más escalabilidad
a futuro se puede cambiar a SFU (mediasoup) sin tocar el frontend.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger("webrtc")

# room_id -> { user_id -> WebSocket }
ROOMS: Dict[str, Dict[str, WebSocket]] = {}
ROOMS_LOCK = asyncio.Lock()


async def _broadcast_peer_list(room_id: str):
    """Envía la lista actual de peers a todos los miembros de la sala."""
    room = ROOMS.get(room_id, {})
    peer_ids = list(room.keys())
    payload = json.dumps({"type": "peers", "peers": peer_ids})
    dead = []
    for uid, ws in room.items():
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(uid)
    for uid in dead:
        room.pop(uid, None)


async def _send_to_peer(room_id: str, target_user_id: str, payload: dict) -> bool:
    """Envía un mensaje de señalización a un peer específico."""
    room = ROOMS.get(room_id, {})
    target = room.get(target_user_id)
    if not target:
        return False
    try:
        await target.send_text(json.dumps(payload))
        return True
    except Exception:
        return False


@router.websocket("/ws/audio/{room_id}")
async def audio_signaling(websocket: WebSocket, room_id: str, user_id: str):
    """
    WebSocket signaling endpoint for WebRTC audio rooms.

    Query params:
      user_id: ID único del usuario

    Mensajes cliente -> server:
      { type: "offer", to: <user_id>, sdp: {...} }
      { type: "answer", to: <user_id>, sdp: {...} }
      { type: "ice", to: <user_id>, candidate: {...} }
      { type: "ping" }

    Mensajes server -> cliente:
      { type: "peers", peers: [user_id, ...] }         # lista actual al entrar / cambiar
      { type: "peer-joined", user_id }                  # alguien entró
      { type: "peer-left", user_id }                    # alguien salió
      { type: "offer|answer|ice", from: <user_id>, ... } # señal de otro peer
      { type: "pong" }
    """
    await websocket.accept()
    logger.info(f"[WS] user={user_id} joined room={room_id}")

    async with ROOMS_LOCK:
        room = ROOMS.setdefault(room_id, {})
        # Si ya existía una conexión previa de ese user_id, cerrarla
        old = room.get(user_id)
        if old is not None and old is not websocket:
            try:
                await old.close()
            except Exception:
                pass
        room[user_id] = websocket

    # Notificar a otros peers que alguien entró
    for uid, ws in list(ROOMS[room_id].items()):
        if uid == user_id:
            continue
        try:
            await ws.send_text(json.dumps({"type": "peer-joined", "user_id": user_id}))
        except Exception:
            pass

    # Enviar lista inicial de peers al recién llegado
    await _broadcast_peer_list(room_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            mtype = msg.get("type")

            if mtype == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            if mtype in ("offer", "answer", "ice"):
                target = msg.get("to")
                if not target:
                    continue
                forward = {"type": mtype, "from": user_id}
                if mtype in ("offer", "answer"):
                    forward["sdp"] = msg.get("sdp")
                else:
                    forward["candidate"] = msg.get("candidate")
                await _send_to_peer(room_id, target, forward)
                continue

            if mtype == "leave":
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"[WS] error user={user_id} room={room_id}: {e}")
    finally:
        async with ROOMS_LOCK:
            room = ROOMS.get(room_id, {})
            if room.get(user_id) is websocket:
                room.pop(user_id, None)
            if not room:
                ROOMS.pop(room_id, None)
        # Notificar a otros que salió
        for uid, ws in list(ROOMS.get(room_id, {}).items()):
            try:
                await ws.send_text(json.dumps({"type": "peer-left", "user_id": user_id}))
            except Exception:
                pass
        logger.info(f"[WS] user={user_id} left room={room_id}")


# ==================== HTTP Helpers ====================

@router.get("/webrtc/config")
async def webrtc_config():
    """
    Retorna la configuración ICE (STUN/TURN) para el frontend.
    Por defecto usa STUN público de Google (gratis, no identifica tu infra).
    Si tienes un TURN propio (coturn en tu VPS), agrégalo en .env como TURN_URL / TURN_USER / TURN_PASS.
    """
    import os
    servers = [
        {"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]},
    ]
    turn_url = os.environ.get("TURN_URL")
    if turn_url:
        s = {"urls": [turn_url]}
        if os.environ.get("TURN_USER"):
            s["username"] = os.environ.get("TURN_USER")
            s["credential"] = os.environ.get("TURN_PASS", "")
        servers.append(s)
    return {"iceServers": servers}


@router.get("/webrtc/rooms/{room_id}/peers")
async def room_peers(room_id: str):
    """Lista de user_ids actualmente conectados al signaling de la sala."""
    return {"room_id": room_id, "peers": list(ROOMS.get(room_id, {}).keys())}
