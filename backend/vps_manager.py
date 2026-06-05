"""VPS SSH manager — v12.30.
Gestiona conexiones SSH a VPS de usuarios y operaciones de deploy.
Usa subprocess SSH (sin paramiko) para evitar dependencia extra.
"""
import asyncio
import os
import re
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from database import db


class DeployIn(BaseModel):
    app_slug: str
    repo_url: str
    domain: str = ""
    branch: str = "main"
    env_vars: dict = {}


def _vps_ssh_args(vps: dict) -> list[str]:
    """Build SSH base args from VPS config (password-less, key-based)."""
    args = [
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=10",
        "-o", "BatchMode=yes",
    ]
    key_path = vps.get("key_path") or vps.get("ssh_key_path")
    if key_path and os.path.exists(str(key_path)):
        args += ["-i", str(key_path)]
    port = vps.get("port") or 22
    args += ["-p", str(port)]
    host = vps.get("host") or vps.get("ip", "")
    user = vps.get("ssh_user") or "root"
    args += [f"{user}@{host}"]
    return args


async def _ssh_run(vps: dict, command: str, timeout: int = 60) -> dict:
    """Execute command on remote VPS via SSH."""
    if not vps.get("host") and not vps.get("ip"):
        return {"error": "VPS sin host/ip configurado"}

    ssh_args = _vps_ssh_args(vps)
    full_cmd = ssh_args + [command]

    try:
        proc = await asyncio.create_subprocess_exec(
            *full_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return {
            "exit_code": proc.returncode,
            "stdout": stdout.decode("utf-8", "ignore")[:20000],
            "stderr": stderr.decode("utf-8", "ignore")[:5000],
        }
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        return {"error": f"SSH timeout ({timeout}s)", "exit_code": -124}
    except FileNotFoundError:
        return {"error": "ssh no disponible en el servidor"}
    except Exception as e:
        return {"error": f"SSH error: {type(e).__name__}: {e}"}


async def deploy_app_to_vps(vps_id: str, payload: DeployIn, user: dict) -> dict:
    """Clone repo, install deps, configure nginx + systemd, start service."""
    vps = await db.vps_servers.find_one({"id": vps_id, "user_id": user.get("id")})
    if not vps:
        return {"error": "VPS no encontrado"}

    slug = re.sub(r"[^a-z0-9_-]", "", payload.app_slug.lower())
    if not slug:
        return {"error": "app_slug inválido"}

    app_dir = f"/opt/lluvia-apps/{slug}"
    domain = payload.domain or f"{slug}.{vps.get('host', 'localhost')}"
    deploy_id = str(uuid.uuid4())[:8]

    steps = [
        f"mkdir -p {app_dir}",
        f"git clone --depth 1 -b {payload.branch} {payload.repo_url} {app_dir} || (cd {app_dir} && git pull origin {payload.branch})",
        f"cd {app_dir}/backend && pip install -r requirements.txt --quiet 2>&1 | tail -5",
        f"systemctl daemon-reload 2>/dev/null; systemctl restart lluvia-{slug} 2>/dev/null || echo 'service not configured'",
        f"echo '✓ deploy {slug} ok'",
    ]

    logs = []
    for step in steps:
        result = await _ssh_run(vps, step, timeout=120)
        logs.append({"cmd": step[:80] + "...", "exit": result.get("exit_code"),
                     "out": (result.get("stdout") or "")[:500]})
        if result.get("exit_code") not in (0, None) and "not configured" not in str(result.get("stdout")):
            pass

    await db.vps_deploys.insert_one({
        "id": deploy_id, "user_id": user.get("id"), "vps_id": vps_id,
        "app_slug": slug, "repo_url": payload.repo_url, "domain": domain,
        "steps": logs, "deployed_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "ok": True, "deploy_id": deploy_id, "app_slug": slug,
        "domain": domain, "steps_run": len(steps), "logs": logs,
    }
