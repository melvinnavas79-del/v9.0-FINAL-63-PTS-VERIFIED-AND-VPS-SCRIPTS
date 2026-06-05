"""
routes/console_api.py — HTTP API para el sistema de agentes v12.31
===================================================================
GET  /api/console/agents                    — lista agentes
POST /api/console/chat                      — envía mensaje (thread-based o legacy)
GET  /api/console/threads                   — hilos del usuario
GET  /api/console/threads/{id}/messages     — mensajes de un hilo
DELETE /api/console/threads/{id}            — eliminar hilo
GET  /api/console/history                   — historial legacy
POST /api/vps/register                      — registra VPS
GET  /api/vps/list                          — lista VPS
DELETE /api/vps/{id}                        — elimina VPS
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
from database import db
import uuid
from datetime import datetime, timezone

router = APIRouter()


# ==================== MODELS ====================

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    # Formato v12.31 (thread-based)
    thread_id: Optional[str] = None
    agent_id: str
    message: Optional[str] = None        # nuevo formato (un solo mensaje)
    # Formato legacy v12.30
    user_id: Optional[str] = None
    messages: Optional[List[ChatMessage]] = None
    session_id: Optional[str] = None
    # Proveedor LLM opcional (anula configuración de .env)
    provider: Optional[str] = None       # "openai" | "gemini" | None (auto)


class VPSRegister(BaseModel):
    user_id: str
    name: str
    host: str
    port: int = 22
    ssh_user: str = "root"
    key_path: Optional[str] = None
    notes: str = ""


# ==================== HELPERS ====================

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _resolve_user(user_id: Optional[str], thread_id: Optional[str]):
    """Obtiene el usuario desde user_id directo o desde el thread."""
    if user_id:
        u = await db.users.find_one({"id": user_id})
        if u:
            return u
    if thread_id:
        t = await db.console_threads.find_one({"id": thread_id})
        if t:
            return await db.users.find_one({"id": t.get("user_id")})
    return None


# ==================== AGENTS ====================

@router.get("/console/agents")
async def list_agents(user_id: str = "", is_admin: bool = False):
    """Lista agentes disponibles. Los admin ven también super_lluvia."""
    from agents_catalog import AGENTS

    if user_id:
        u = await db.users.find_one({"id": user_id})
        if u and (u.get("role") == "dueño" or u.get("is_super_admin")):
            is_admin = True

    result = []
    for agent in AGENTS.values():
        if agent.get("is_admin") and not is_admin:
            continue
        result.append({
            "id": agent["id"],
            "name": agent["name"],
            "emoji": agent.get("emoji", "🤖"),
            "color": agent.get("color", "#5fb4ff"),
            "tagline": agent.get("tagline", ""),
            "tools_count": len(agent.get("tools", [])),
            "requires_admin": agent.get("is_admin", False),
        })
    return {"agents": result}


# ==================== THREADS ====================

@router.get("/console/threads")
async def list_threads(user_id: str, limit: int = 30):
    """Lista hilos de conversación del usuario."""
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id requerido")
    limit = max(1, min(limit, 100))
    threads = await db.console_threads.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("updated_at", -1).limit(limit).to_list(limit)
    return {"threads": threads, "count": len(threads)}


@router.get("/console/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: str, user_id: str = ""):
    """Retorna todos los mensajes de un hilo."""
    thread = await db.console_threads.find_one({"id": thread_id})
    if not thread:
        raise HTTPException(status_code=404, detail="Hilo no encontrado")
    if user_id and thread.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este hilo")

    msgs = await db.console_messages.find(
        {"thread_id": thread_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return {"messages": msgs, "thread": {k: v for k, v in thread.items() if k != "_id"}}


@router.delete("/console/threads/{thread_id}")
async def delete_thread(thread_id: str, user_id: str):
    """Elimina un hilo y sus mensajes."""
    thread = await db.console_threads.find_one({"id": thread_id, "user_id": user_id})
    if not thread:
        raise HTTPException(status_code=404, detail="Hilo no encontrado")
    await db.console_threads.delete_one({"id": thread_id})
    await db.console_messages.delete_many({"thread_id": thread_id})
    return {"ok": True}


# ==================== CHAT ====================

@router.post("/console/chat")
async def agent_chat(req: ChatRequest):
    """
    Ejecuta un turno del agente. Soporta dos formatos:
    - Nuevo (v12.31): {thread_id?, agent_id, message, user_id?}
    - Legacy (v12.30): {user_id, agent_id, messages: [...], session_id?}
    """
    from console import run_agent_turn
    from agents_catalog import AGENTS

    # ---- Resolver user_id y mensajes ----
    thread_id = req.thread_id
    user_id = req.user_id

    # Si hay thread_id, recuperar user_id desde el thread
    if thread_id and not user_id:
        t = await db.console_threads.find_one({"id": thread_id})
        if t:
            user_id = t.get("user_id")

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id requerido")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    is_admin = user.get("role") == "dueño" or bool(user.get("is_super_admin"))

    agent = AGENTS.get(req.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agente '{req.agent_id}' no existe")
    if agent.get("is_admin") and not is_admin:
        raise HTTPException(status_code=403, detail="Este agente requiere permisos de administrador")

    # ---- Construir lista de mensajes ----
    if req.message is not None:
        # Formato nuevo: cargar historial del thread + nuevo mensaje
        if thread_id:
            stored = await db.console_messages.find(
                {"thread_id": thread_id},
                {"_id": 0}
            ).sort("created_at", 1).to_list(100)
            messages = [{"role": m["role"], "content": m["content"]} for m in stored]
        else:
            messages = []
        messages.append({"role": "user", "content": req.message})
    elif req.messages:
        # Formato legacy
        messages = [{"role": m.role, "content": m.content} for m in req.messages]
    else:
        raise HTTPException(status_code=400, detail="Proporciona 'message' o 'messages'")

    if not messages:
        raise HTTPException(status_code=400, detail="Sin mensajes")

    # ---- Ejecutar agente ----
    result = await run_agent_turn(
        agent_id=req.agent_id,
        messages=messages,
        user_id=user_id,
        is_admin=is_admin,
        db=db,
        provider=req.provider,
    )

    if "error" in result and not result.get("text"):
        raise HTTPException(status_code=500, detail=result["error"])

    # ---- Descontar monedas ----
    total_cost = result.get("total_cost", 0)
    if total_cost > 0:
        updated = await db.users.find_one_and_update(
            {"id": user_id, "coins": {"$gte": total_cost}},
            {"$inc": {"coins": -total_cost}},
            return_document=True,
        )
        if not updated:
            raise HTTPException(status_code=402, detail=f"Monedas insuficientes ({total_cost} requeridas)")

    # ---- Persistir thread y mensajes ----
    reply_text = result.get("text", "")
    tool_calls = result.get("tool_calls", [])
    now = _now()

    if req.message is not None:
        # Crear thread si es nuevo
        if not thread_id:
            thread_id = str(uuid.uuid4())
            title = req.message[:60] + ("…" if len(req.message) > 60 else "")
            await db.console_threads.insert_one({
                "id": thread_id, "user_id": user_id,
                "agent_id": req.agent_id, "title": title,
                "created_at": now, "updated_at": now,
            })

        # Guardar mensaje del usuario
        user_msg_id = str(uuid.uuid4())
        await db.console_messages.insert_one({
            "id": user_msg_id, "thread_id": thread_id,
            "role": "user", "content": req.message,
            "created_at": now,
        })

        # Guardar respuesta del agente
        asst_msg_id = str(uuid.uuid4())
        await db.console_messages.insert_one({
            "id": asst_msg_id, "thread_id": thread_id,
            "role": "assistant", "content": reply_text,
            "tool_calls": [
                {
                    "name": tc.get("tool"),
                    "args": tc.get("args"),
                    "result": tc.get("result"),
                    "cost": tc.get("cost", 0),
                    "error": bool(tc.get("result", {}).get("error") if isinstance(tc.get("result"), dict) else False),
                }
                for tc in tool_calls
            ],
            "agent_name": agent.get("name"),
            "agent_emoji": agent.get("emoji"),
            "total_cost": total_cost,
            "rounds": result.get("rounds", 1),
            "provider": result.get("provider", "gemini"),
            "created_at": now,
        })

        # Actualizar timestamp del thread
        await db.console_threads.update_one(
            {"id": thread_id},
            {"$set": {"updated_at": now, "last_message": req.message[:80]}},
        )

    else:
        # Formato legacy: guardar en console_history
        session_id = req.session_id or str(uuid.uuid4())
        await db.console_history.insert_one({
            "session_id": session_id, "user_id": user_id,
            "agent_id": req.agent_id,
            "user_message": messages[-1]["content"][:1000] if messages else "",
            "assistant_reply": reply_text[:2000],
            "tool_calls_count": len(tool_calls),
            "total_cost": total_cost,
            "rounds": result.get("rounds", 1),
            "created_at": now,
        })

    # Coins restantes
    fresh_user = await db.users.find_one({"id": user_id}, {"_id": 0, "coins": 1})
    balance = (fresh_user or {}).get("coins", 0)

    return {
        "thread_id": thread_id,
        "agent_id": req.agent_id,
        "text": reply_text,
        "tool_calls": tool_calls,
        "total_cost": total_cost,
        "rounds": result.get("rounds", 1),
        "provider": result.get("provider", "gemini"),
        "balance": balance,
    }


@router.get("/console/history")
async def get_console_history(user_id: str, limit: int = 50):
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id requerido")
    limit = max(1, min(limit, 200))
    history = await db.console_history.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"history": history, "count": len(history)}


# ==================== VPS ====================

@router.post("/vps/register")
async def register_vps(vps: VPSRegister):
    user = await db.users.find_one({"id": vps.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    existing = await db.vps_servers.find_one({"user_id": vps.user_id, "host": vps.host})
    if existing:
        raise HTTPException(status_code=409, detail="Ya tienes un VPS con ese host")
    vps_id = str(uuid.uuid4())[:12]
    doc = {
        "id": vps_id, "user_id": vps.user_id, "name": vps.name,
        "host": vps.host, "port": vps.port, "ssh_user": vps.ssh_user,
        "key_path": vps.key_path or "", "notes": vps.notes,
        "registered_at": _now(), "status": "registered",
    }
    await db.vps_servers.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "vps": doc}


@router.get("/vps/list")
async def list_user_vps(user_id: str):
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id requerido")
    vps_list = await db.vps_servers.find(
        {"user_id": user_id}, {"_id": 0, "ssh_key_encrypted": 0}
    ).to_list(50)
    return {"vps": vps_list, "count": len(vps_list)}


@router.delete("/vps/{vps_id}")
async def delete_vps(vps_id: str, user_id: str):
    result = await db.vps_servers.delete_one({"id": vps_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="VPS no encontrado")
    return {"ok": True}
