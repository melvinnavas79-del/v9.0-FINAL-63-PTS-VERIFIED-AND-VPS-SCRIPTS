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
import shutil
import traceback
import contextlib
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel

from database import db, datetime, timezone, uuid

router = APIRouter()

MIN_KEY_LEN = 20
PYTHON_TIMEOUT = 15.0
SHELL_TIMEOUT = 30.0
MAX_OUTPUT_CHARS = 20_000
SNAPSHOT_DIR = Path("/tmp/ll_snapshots")
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
SNAPSHOT_TIMEOUT = 60.0
RESTORE_TIMEOUT = 120.0
MAX_SNAPSHOTS = 10  # mantenemos las últimas 10 snapshots, el resto se borra


class ScriptPayload(BaseModel):
    mode: str  # "python" | "shell"
    code: str
    snapshot: bool = True  # crea snapshot de la DB antes de ejecutar


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


def _db_name_and_url() -> tuple[str, str]:
    return os.environ.get("DB_NAME", ""), os.environ.get("MONGO_URL", "")


async def _create_snapshot() -> dict:
    """Crea un mongodump en /tmp/ll_snapshots/<id>/. Retorna metadatos."""
    db_name, mongo_url = _db_name_and_url()
    if not db_name or not mongo_url:
        return {"ok": False, "error": "MONGO_URL/DB_NAME no disponibles"}
    snap_id = uuid.uuid4().hex[:12]
    out_dir = SNAPSHOT_DIR / snap_id
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = f"mongodump --uri='{mongo_url}' --db='{db_name}' --out='{out_dir}' --quiet"
    proc = await asyncio.create_subprocess_shell(
        cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, err = await asyncio.wait_for(proc.communicate(), timeout=SNAPSHOT_TIMEOUT)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        shutil.rmtree(out_dir, ignore_errors=True)
        return {"ok": False, "error": "mongodump excedió el tiempo"}
    if proc.returncode != 0:
        shutil.rmtree(out_dir, ignore_errors=True)
        return {"ok": False, "error": err.decode("utf-8", errors="replace")[:500]}
    # Rotar: dejar solo las últimas MAX_SNAPSHOTS
    snaps = sorted(SNAPSHOT_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in snaps[MAX_SNAPSHOTS:]:
        shutil.rmtree(old, ignore_errors=True)
    return {"ok": True, "snapshot_id": snap_id, "path": str(out_dir), "created_at": datetime.now(timezone.utc).isoformat()}


async def _restore_snapshot(snapshot_id: str) -> dict:
    """Restaura un snapshot previo con mongorestore --drop."""
    db_name, mongo_url = _db_name_and_url()
    snap_path = SNAPSHOT_DIR / snapshot_id / db_name
    if not snap_path.exists():
        return {"ok": False, "error": f"Snapshot {snapshot_id} no existe o ya fue purgado"}
    cmd = f"mongorestore --uri='{mongo_url}' --db='{db_name}' --drop --quiet '{snap_path}'"
    proc = await asyncio.create_subprocess_shell(
        cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, err = await asyncio.wait_for(proc.communicate(), timeout=RESTORE_TIMEOUT)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        return {"ok": False, "error": "mongorestore excedió el tiempo"}
    if proc.returncode != 0:
        return {"ok": False, "error": err.decode("utf-8", errors="replace")[:500]}
    return {"ok": True}


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
    # Snapshot automático ANTES de ejecutar (opt-out vía payload.snapshot=false)
    snapshot_info = {"ok": False, "skipped": True}
    if payload.snapshot:
        snapshot_info = await _create_snapshot()
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
        "snapshot_id": snapshot_info.get("snapshot_id", ""),
        "snapshot_ok": snapshot_info.get("ok", False),
        "snapshot_error": snapshot_info.get("error", "") if not snapshot_info.get("ok") else "",
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
        "snapshot_id": snapshot_info.get("snapshot_id", ""),
        "snapshot_ok": snapshot_info.get("ok", False),
        "snapshot_error": snapshot_info.get("error", "") if not snapshot_info.get("ok") else "",
        "duration_ms": log_doc["duration_ms"],
    }


@router.post("/admin/script-runner/undo")
async def script_runner_undo(
    admin_id: str,
    snapshot_id: str = "",
    x_master_key: str = Header(default="", alias="X-Master-Key"),
):
    """Deshacer: restaura el snapshot indicado (o el último disponible) con mongorestore --drop.
    Requiere Master Key + rol dueño. Registra la operación en la colección de auditoría."""
    master = os.environ.get("MASTER_KEY", "")
    if not master or len(master) < MIN_KEY_LEN:
        raise HTTPException(status_code=503, detail="MASTER_KEY no configurada")
    if not x_master_key or x_master_key != master:
        raise HTTPException(status_code=403, detail="Master Key inválida")
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")

    # Si no se indica snapshot_id, usar el último con snapshot_ok=True del log
    if not snapshot_id:
        last = await db.script_runner_log.find_one(
            {"snapshot_ok": True, "snapshot_id": {"$ne": ""}},
            sort=[("started_at", -1)],
        )
        if not last:
            raise HTTPException(status_code=404, detail="No hay snapshot disponible para deshacer")
        snapshot_id = last["snapshot_id"]

    started = datetime.now(timezone.utc)
    result = await _restore_snapshot(snapshot_id)
    ended = datetime.now(timezone.utc)

    # NO registramos la restauración con insert_one en script_runner_log porque mongorestore --drop
    # justo recrea la colección; guardamos en una colección separada de auditoría de undo.
    await db.script_runner_undo_log.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "admin_username": admin.get("username", ""),
        "snapshot_id": snapshot_id,
        "ok": result.get("ok", False),
        "error": result.get("error", ""),
        "started_at": started.isoformat(),
        "ended_at": ended.isoformat(),
        "duration_ms": int((ended - started).total_seconds() * 1000),
    })

    if not result.get("ok"):
        raise HTTPException(status_code=500, detail=f"Error al restaurar: {result.get('error', '')}")
    return {
        "success": True,
        "snapshot_id": snapshot_id,
        "duration_ms": int((ended - started).total_seconds() * 1000),
    }


@router.get("/admin/script-runner/snapshots")
async def script_runner_snapshots(admin_id: str):
    """Lista snapshots disponibles en disco, ordenados del más nuevo al más viejo."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")
    if not SNAPSHOT_DIR.exists():
        return []
    snaps = sorted(SNAPSHOT_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    result = []
    for p in snaps:
        if not p.is_dir():
            continue
        # Buscar fecha en log asociado
        log_entry = await db.script_runner_log.find_one({"snapshot_id": p.name})
        result.append({
            "snapshot_id": p.name,
            "created_at": datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
            "size_bytes": sum(f.stat().st_size for f in p.rglob("*") if f.is_file()),
            "linked_code": (log_entry or {}).get("code", "")[:200],
            "linked_mode": (log_entry or {}).get("mode", ""),
        })
    return result


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
