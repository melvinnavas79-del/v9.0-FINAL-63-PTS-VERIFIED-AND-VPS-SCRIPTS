"""
console.py — Motor de agentes de Lluvia App Studio v12.30
=========================================================
Gestiona el loop agentico: recibe mensajes, llama a Gemini con function
calling, ejecuta tools y devuelve la respuesta final.

Arquitectura:
  - _exec_tool(name, args, ctx) → (data_dict, cost)
      Dispatcher central: built-ins + tools/ extendidas
  - run_agent_turn(agent_id, messages, user_id, is_admin, db)
      Loop agentico completo (hasta MAX_TOOL_ROUNDS rondas)
"""
import json
import os
import sys
import logging
from datetime import datetime, timezone

log = logging.getLogger("console")

# Referencia mutable a la DB (se setea en startup para evitar circular imports)
_db_ref: dict = {}

MAX_TOOL_ROUNDS = 8


# ==================== BUILT-IN TOOLS (sin deps extra) ====================

async def _builtin_get_platform_stats(args: dict, ctx: dict) -> dict:
    db = ctx.get("db")
    if not db:
        return {"error": "DB no disponible"}
    users = await db.users.count_documents({})
    rooms = await db.rooms.count_documents({})
    active_rooms = await db.rooms.count_documents({"active_users": {"$gt": 0}})
    return {"total_users": users, "total_rooms": rooms, "active_rooms": active_rooms}


async def _builtin_get_user_info(args: dict, ctx: dict) -> dict:
    db = ctx.get("db")
    uid = args.get("user_id") or ctx.get("user_id")
    if not db or not uid:
        return {"error": "user_id requerido"}
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    if not u:
        return {"error": "Usuario no encontrado"}
    return {k: v for k, v in u.items() if k != "password"}


async def _builtin_list_active_rooms(args: dict, ctx: dict) -> dict:
    db = ctx.get("db")
    if not db:
        return {"error": "DB no disponible"}
    limit = min(int(args.get("limit", 20)), 50)
    rooms = await db.rooms.find(
        {"active_users": {"$gt": 0}},
        {"_id": 0, "password": 0}
    ).sort("active_users", -1).limit(limit).to_list(limit)
    return {"rooms": rooms, "count": len(rooms)}


async def _builtin_send_notification(args: dict, ctx: dict) -> dict:
    db = ctx.get("db")
    target = args.get("user_id")
    msg = args.get("message", "")
    category = args.get("category", "system_alert")
    if not db or not target or not msg:
        return {"error": "user_id y message requeridos"}
    from database import create_notification
    await create_notification(target, category, msg, db=db)
    return {"ok": True, "sent_to": target}


_BUILTINS = {
    "get_platform_stats": _builtin_get_platform_stats,
    "get_user_info": _builtin_get_user_info,
    "list_active_rooms": _builtin_list_active_rooms,
    "send_notification": _builtin_send_notification,
}

_BUILTIN_DEFINITIONS = [
    {"name": "get_platform_stats",
     "description": "Estadísticas generales de la plataforma: usuarios, salas, activos.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "get_user_info",
     "description": "Perfil completo de un usuario por su ID.",
     "parameters": {"type": "object", "properties": {
         "user_id": {"type": "string", "description": "ID del usuario"}},
         "required": ["user_id"]}},
    {"name": "list_active_rooms",
     "description": "Lista salas con usuarios activos ahora.",
     "parameters": {"type": "object", "properties": {
         "limit": {"type": "integer", "description": "Máximo de salas a retornar (default 20)"}}}},
    {"name": "send_notification",
     "description": "Envía una notificación interna a un usuario.",
     "parameters": {"type": "object", "properties": {
         "user_id": {"type": "string"},
         "message": {"type": "string"},
         "category": {"type": "string", "description": "Categoría (default: system_alert)"}},
         "required": ["user_id", "message"]}},
]


# ==================== DISPATCHER CENTRAL ====================

async def _exec_tool(name: str, args: dict, ctx: dict) -> tuple[dict, int]:
    """
    Ejecuta una tool y retorna (data, coin_cost).
    Orden de búsqueda:
      1. Built-ins (stats, user info, rooms, notif)
      2. tools/ dispatcher extendido (workspace, vps, dev_ops, integrations...)
    """
    from agents_catalog import TOOL_NAMES

    fn = _BUILTINS.get(name)
    if fn:
        data = await fn(args or {}, ctx)
        return data, 0

    # LLUVIA_TOOLS_DISPATCH_V12_30
    try:
        _backend_dir = os.path.dirname(os.path.abspath(__file__))
        if _backend_dir not in sys.path:
            sys.path.insert(0, _backend_dir)
        from tools import dispatch as _td
        data = await _td(name, args or {}, ctx)
        if isinstance(data, dict) and "no registrada" in (data.get("error") or ""):
            return {"error": f"Tool desconocida: {name}"}, 0
    except Exception as _e:
        return {"error": f"tools dispatcher: {_e}"}, 0

    cost = TOOL_NAMES.get(name, 1)
    return data, cost


# ==================== LOOP AGÉNTICO ====================

def _detect_provider() -> str:
    """Detecta qué proveedor de LLM usar según las keys disponibles en .env.
    Prioridad: OPENAI_API_KEY > GEMINI_API_KEY.
    Se puede forzar con LLM_PROVIDER=openai|gemini.
    """
    forced = os.environ.get("LLM_PROVIDER", "").lower()
    if forced in ("openai", "gemini"):
        return forced
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    return "gemini"


async def run_agent_turn(
    agent_id: str,
    messages: list,
    user_id: str,
    is_admin: bool,
    db,
    provider: str = None,
) -> dict:
    """
    Ejecuta un turno completo del agente.
    Soporta OpenAI GPT y Google Gemini.
    Prioridad: parámetro provider > LLM_PROVIDER env > auto-detect por keys.
    """
    from agents_catalog import AGENTS
    import tools as tools_mod

    agent = AGENTS.get(agent_id)
    if not agent:
        return {"error": f"Agente '{agent_id}' no existe"}

    if agent.get("is_admin") and not is_admin:
        return {"error": "Este agente requiere permisos de administrador"}

    # Prioridad: parámetro explícito > env var > auto-detect
    if provider and provider in ("openai", "gemini"):
        resolved = provider
    else:
        resolved = _detect_provider()

    if resolved == "openai":
        return await _run_openai(agent, messages, user_id, is_admin, db, tools_mod)
    return await _run_gemini(agent, messages, user_id, is_admin, db, tools_mod)


async def _run_openai(agent, messages, user_id, is_admin, db, tools_mod) -> dict:
    """Loop agéntico usando OpenAI GPT-4o con function calling."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY no configurada en .env"}

    try:
        from openai import AsyncOpenAI
    except ImportError:
        return {"error": "openai no instalado (pip install openai)"}

    user = await db.users.find_one({"id": user_id}, {"_id": 0}) if db else None
    ctx = {"user_id": user_id, "user": user, "is_admin": is_admin, "db": db}

    allowed_tools = set(agent.get("tools", []))
    all_tool_defs = (
        _BUILTIN_DEFINITIONS
        + [d["function"] for d in tools_mod.all_definitions(is_admin=is_admin)]
    )
    fn_defs = [
        d for d in all_tool_defs
        if not allowed_tools or d["name"] in allowed_tools or d["name"] in _BUILTINS
    ]

    # Formato OpenAI tools
    oai_tools = [{"type": "function", "function": d} for d in fn_defs] if fn_defs else None

    client = AsyncOpenAI(api_key=api_key)
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    # Construir historial en formato OpenAI
    oai_messages = [{"role": "system", "content": agent["system"]}]
    for m in messages[:-1]:
        role = m.get("role", "user")
        if role == "assistant":
            oai_messages.append({"role": "assistant", "content": m.get("content", "")})
        elif role == "user":
            oai_messages.append({"role": "user", "content": m.get("content", "")})
    oai_messages.append({"role": "user", "content": messages[-1].get("content", "")})

    tool_calls_log = []
    total_cost = 0
    from agents_catalog import TOOL_NAMES

    for _round in range(MAX_TOOL_ROUNDS):
        kwargs = {"model": model, "messages": oai_messages, "max_tokens": 2048}
        if oai_tools:
            kwargs["tools"] = oai_tools

        try:
            response = await client.chat.completions.create(**kwargs)
        except Exception as e:
            return {"error": f"OpenAI error: {e}"}

        choice = response.choices[0]
        msg = choice.message

        if not msg.tool_calls:
            return {
                "text": msg.content or "",
                "tool_calls": tool_calls_log,
                "total_cost": total_cost,
                "rounds": _round + 1,
                "agent_id": agent["id"],
                "provider": "openai",
                "model": model,
            }

        oai_messages.append(msg.model_dump())

        for tc in msg.tool_calls:
            import json as _json
            tool_name = tc.function.name
            try:
                tool_args = _json.loads(tc.function.arguments or "{}")
            except Exception:
                tool_args = {}

            data, cost = await _exec_tool(tool_name, tool_args, ctx)
            total_cost += cost
            tool_calls_log.append({
                "tool": tool_name, "args": tool_args,
                "result": data, "cost": cost,
                "at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            })

            if db:
                await db.agent_tool_calls.insert_one({
                    "user_id": user_id, "agent_id": agent["id"],
                    "tool": tool_name, "args": str(tool_args)[:400],
                    "result_preview": str(data)[:600], "cost": cost,
                    "at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                })

            oai_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": _json.dumps(data, ensure_ascii=False)[:8000],
            })

    return {
        "text": "Se alcanzó el límite de rondas.",
        "tool_calls": tool_calls_log, "total_cost": total_cost,
        "rounds": MAX_TOOL_ROUNDS, "agent_id": agent["id"],
        "provider": "openai", "model": model,
    }


async def _run_gemini(agent, messages, user_id, is_admin, db, tools_mod) -> dict:
    """Loop agéntico usando Google Gemini con function calling."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY no configurada en .env"}

    try:
        from google import genai
        from google.genai import types as gtypes
    except ImportError:
        return {"error": "google-genai no instalado (pip install google-genai)"}

    user = await db.users.find_one({"id": user_id}, {"_id": 0}) if db else None

    ctx = {
        "user_id": user_id,
        "user": user,
        "is_admin": is_admin,
        "db": db,
    }

    # Construir definiciones de tools disponibles para este agente
    allowed_tools = set(agent.get("tools", []))
    all_tool_defs = (
        _BUILTIN_DEFINITIONS
        + [d["function"] for d in tools_mod.all_definitions(is_admin=is_admin)]
    )
    fn_declarations = [
        d for d in all_tool_defs
        if not allowed_tools or d["name"] in allowed_tools or d["name"] in _BUILTINS
    ]

    gemini_tools = None
    if fn_declarations:
        try:
            gemini_tools = [gtypes.Tool(function_declarations=fn_declarations)]
        except Exception as e:
            log.warning(f"No se pudieron cargar tools para Gemini: {e}")

    client = genai.Client(api_key=api_key)
    model = "gemini-2.0-flash"

    # Convertir historial de mensajes al formato Gemini
    history = _messages_to_gemini(messages[:-1])  # todo menos el último
    last_user_msg = messages[-1].get("content", "") if messages else ""

    conversation = history + [{"role": "user", "parts": [{"text": last_user_msg}]}]

    tool_calls_log = []
    total_cost = 0

    config_kwargs = {
        "system_instruction": agent["system"],
        "max_output_tokens": 2048,
    }
    if gemini_tools:
        config_kwargs["tools"] = gemini_tools

    for _round in range(MAX_TOOL_ROUNDS):
        try:
            response = client.models.generate_content(
                model=model,
                contents=conversation,
                config=gtypes.GenerateContentConfig(**config_kwargs),
            )
        except Exception as e:
            return {"error": f"Gemini error: {e}"}

        candidate = response.candidates[0] if response.candidates else None
        if not candidate:
            return {"error": "Gemini no retornó candidatos"}

        # Verificar si hay function calls
        fc_parts = []
        text_parts = []
        for part in (candidate.content.parts or []):
            if hasattr(part, "function_call") and part.function_call:
                fc_parts.append(part.function_call)
            elif hasattr(part, "text") and part.text:
                text_parts.append(part.text)

        if not fc_parts:
            final_text = " ".join(text_parts).strip()
            return {
                "text": final_text,
                "tool_calls": tool_calls_log,
                "total_cost": total_cost,
                "rounds": _round + 1,
                "agent_id": agent["id"],
                "provider": "gemini",
            }

        conversation.append({"role": "model", "parts": candidate.content.parts})

        fn_response_parts = []
        for fc in fc_parts:
            tool_name = fc.name
            tool_args = dict(fc.args) if fc.args else {}

            data, cost = await _exec_tool(tool_name, tool_args, ctx)
            total_cost += cost

            tool_calls_log.append({
                "tool": tool_name,
                "args": tool_args,
                "result": data,
                "cost": cost,
                "at": datetime.now(timezone.utc).isoformat(),
            })

            if db:
                await db.agent_tool_calls.insert_one({
                    "user_id": user_id, "agent_id": agent["id"],
                    "tool": tool_name, "args": str(tool_args)[:400],
                    "result_preview": str(data)[:600],
                    "cost": cost, "at": datetime.now(timezone.utc).isoformat(),
                })

            try:
                fn_response_parts.append(
                    gtypes.Part.from_function_response(
                        name=tool_name, response={"result": data}
                    )
                )
            except Exception:
                fn_response_parts.append({"function_response": {
                    "name": tool_name, "response": {"result": data}
                }})

        conversation.append({"role": "user", "parts": fn_response_parts})

    return {
        "text": "Se alcanzó el límite de rondas de herramientas.",
        "tool_calls": tool_calls_log,
        "total_cost": total_cost,
        "rounds": MAX_TOOL_ROUNDS,
        "agent_id": agent["id"],
        "provider": "gemini",
    }


# ==================== HELPERS ====================

def _messages_to_gemini(messages: list) -> list:
    """Convierte formato [{role, content}] al formato de Gemini."""
    result = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "assistant":
            role = "model"
        elif role not in ("user", "model"):
            continue
        result.append({"role": role, "parts": [{"text": str(content)}]})
    return result
