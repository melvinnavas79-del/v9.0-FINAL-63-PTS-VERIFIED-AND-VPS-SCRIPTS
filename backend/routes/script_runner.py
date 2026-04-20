"""
Consola Técnica (Script Runner) — Acceso de mantenimiento profundo.
===================================================================
Permite al DUEÑO ejecutar código Python o comandos shell directamente
desde el panel de administración para mantenimiento del servidor y la DB.

SEGURIDAD (capas obligatorias):
  1. El usuario debe tener rol "dueño".
  2. Se debe enviar el header  X-Master-Key  igual a la variable de entorno
     MASTER_KEY (mínimo 20 caracteres). La clave NO se guarda en la DB.
  3. Cada ejecución queda registrada en la colección  script_runner_log
     para auditoría.
  4. Tiempo de ejecución limitado (30s shell, 15s python).

Endpoints:
  POST /api/admin/script-runner/execute
        body: {"mode": "python" | "shell", "code": "..."}
        headers: X-Master-Key
  GET  /api/admin/script-runner/history?admin_id=...  (últimas 20 ejecuciones)
"""
from __future__ import annotations

import asyncio
import io
import os
import traceback
import contextlib
from typing import Any

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel

from database import db, datetime, timezone, uuid

router = APIRouter()

MIN_KEY_LEN = 20
PYTHON_TIMEOUT = 15.0
SHELL_TIMEOUT = 30.0
MAX_OUTPUT_CHARS = 20_000


class ScriptPayload(BaseModel):
    mode: str  # "python" | "shell"
    code: str


def _truncate(text: str) -> str:
    if len(text) > MAX_OUTPUT_CHARS:
        return text[:MAX_OUTPUT_CHARS] + f"\n...[truncado {len(text) - MAX_OUTPUT_CHARS} caracteres]"
    return text


async def _run_python(code: str) -> dict:
    """Ejecuta Python en un hilo con timeout. Captura stdout/stderr y la última expresión."""
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    def _exec_sync() -> Any:
        glb: dict = {"__name__": "__runner__", "db": db, "os": os}
        try:
            with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
                exec(compile(code, "<script-runner>", "exec"), glb)  # noqa: S102
            return {"ok": True}
        except BaseException:  # noqa: BLE001
            return {"ok": False, "trace": traceback.format_exc()}

    try:
        result = await asyncio.wait_for(asyncio.to_thread(_exec_sync), timeout=PYTHON_TIMEOUT)
    except asyncio.TimeoutError:
        return {
            "ok": False,
            "stdout": _truncate(stdout_buf.getvalue()),
            "stderr": _truncate(stderr_buf.getvalue()),
            "error": f"Tiempo de ejecución excedido ({PYTHON_TIMEOUT}s)",
        }

    response = {
        "ok": result.get("ok", False),
        "stdout": _truncate(stdout_buf.getvalue()),
        "stderr": _truncate(stderr_buf.getvalue()),
    }
    if not result.get("ok"):
        response["error"] = _truncate(result.get("trace", ""))
    return response


async def _run_shell(code: str) -> dict:
    """Ejecuta un comando shell con timeout."""
    proc = await asyncio.create_subprocess_shell(
        code,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=SHELL_TIMEOUT)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        return {"ok": False, "stdout": "", "stderr": "", "error": f"Tiempo excedido ({SHELL_TIMEOUT}s)"}
    stdout = _truncate(out.decode("utf-8", errors="replace"))
    stderr = _truncate(err.decode("utf-8", errors="replace"))
    return {
        "ok": proc.returncode == 0,
        "exit_code": proc.returncode,
        "stdout": stdout,
        "stderr": stderr,
    }


@router.post("/admin/script-runner/execute")
async def script_runner_execute(
    payload: ScriptPayload,
    request: Request,
    x_master_key: str = Header(default="", alias="X-Master-Key"),
    admin_id: str = "",
):
    """Ejecuta código con doble verificación: rol dueño + Master Key del .env."""
    master = os.environ.get("MASTER_KEY", "")
    if not master or len(master) < MIN_KEY_LEN:
        raise HTTPException(
            status_code=503,
            detail=f"MASTER_KEY no configurada en .env (mínimo {MIN_KEY_LEN} caracteres).",
        )
    if not x_master_key or x_master_key != master:
        raise HTTPException(status_code=403, detail="Master Key inválida")
    if not admin_id:
        raise HTTPException(status_code=400, detail="admin_id requerido")
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño puede ejecutar la consola técnica")

    mode = (payload.mode or "").lower()
    code = payload.code or ""
    if not code.strip():
        raise HTTPException(status_code=400, detail="Código vacío")
    if mode not in ("python", "shell"):
        raise HTTPException(status_code=400, detail="mode debe ser 'python' o 'shell'")

    started = datetime.now(timezone.utc)
    if mode == "python":
        result = await _run_python(code)
    else:
        result = await _run_shell(code)
    ended = datetime.now(timezone.utc)

    log_doc = {
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "admin_username": admin.get("username", ""),
        "mode": mode,
        "code": code[:5000],
        "ok": result.get("ok", False),
        "stdout": result.get("stdout", ""),
        "stderr": result.get("stderr", ""),
        "error": result.get("error", ""),
        "exit_code": result.get("exit_code"),
        "started_at": started.isoformat(),
        "ended_at": ended.isoformat(),
        "duration_ms": int((ended - started).total_seconds() * 1000),
        "ip": request.client.host if request.client else "",
    }
    await db.script_runner_log.insert_one(log_doc)
    log_doc.pop("_id", None)
    return {
        "success": True,
        "ok": result.get("ok", False),
        "mode": mode,
        "stdout": result.get("stdout", ""),
        "stderr": result.get("stderr", ""),
        "error": result.get("error", ""),
        "exit_code": result.get("exit_code"),
        "duration_ms": log_doc["duration_ms"],
    }


@router.get("/admin/script-runner/history")
async def script_runner_history(admin_id: str):
    """Últimas 20 ejecuciones para auditoría. Solo dueño."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")
    logs = await db.script_runner_log.find().sort("started_at", -1).limit(20).to_list(20)
    for log in logs:
        log.pop("_id", None)
    return logs


@router.get("/admin/script-runner/status")
async def script_runner_status(admin_id: str):
    """Indica si la Master Key está configurada (sin revelar el valor)."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")
    master = os.environ.get("MASTER_KEY", "")
    return {
        "configured": bool(master) and len(master) >= MIN_KEY_LEN,
        "min_length": MIN_KEY_LEN,
        "current_length": len(master) if master else 0,
    }
