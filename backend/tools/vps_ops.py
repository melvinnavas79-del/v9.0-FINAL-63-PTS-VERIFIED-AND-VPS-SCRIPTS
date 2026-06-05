"""tools.vps_ops — SSH ops sobre VPS conectados."""
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BLOCKED = [
    "rm -rf /", ":(){:|:&};:", "mkfs", "shutdown", "reboot", "halt",
    "> /etc/passwd", "dd if=/dev/zero of=/dev/",
]


async def _get_vps(ctx, vps_id):
    db = ctx.get("db")
    if not db:
        return None
    return await db.vps_servers.find_one({"id": vps_id, "user_id": ctx["user_id"]})


async def list_my_vps(args, ctx):
    db = ctx.get("db")
    if not db:
        return {"vps": []}
    cur = db.vps_servers.find(
        {"user_id": ctx["user_id"]},
        {"_id": 0, "ssh_key_encrypted": 0, "password_encrypted": 0},
    )
    return {"vps": [v async for v in cur]}


async def run_vps_command(args, ctx):
    import vps_manager as vm
    vps = await _get_vps(ctx, args.get("vps_id", ""))
    if not vps:
        return {"error": "VPS no encontrado"}
    cmd = args.get("command", "")
    if any(b in cmd for b in BLOCKED):
        return {"error": "Comando bloqueado por política de seguridad"}
    return await vm._ssh_run(vps, cmd, timeout=int(args.get("timeout_sec", 60)))


async def deploy_app_to_vps(args, ctx):
    import vps_manager as vm
    vps = await _get_vps(ctx, args.get("vps_id", ""))
    if not vps:
        return {"error": "VPS no encontrado"}
    payload = vm.DeployIn(**{k: v for k, v in args.items() if k != "vps_id"})
    user = ctx.get("user") or {}
    data = await vm.deploy_app_to_vps(args["vps_id"], payload, user)
    data["card_type"] = "vps_deploy"
    return data


async def tail_vps_logs(args, ctx):
    import vps_manager as vm
    vps = await _get_vps(ctx, args.get("vps_id", ""))
    if not vps:
        return {"error": "VPS no encontrado"}
    svc = re.sub(r"[^a-z0-9._-]", "", args.get("service", ""))
    n = max(10, min(int(args.get("lines", 100)), 1000))
    return await vm._ssh_run(vps, f"sudo journalctl -u {svc} -n {n} --no-pager", timeout=15)


async def restart_vps_service(args, ctx):
    import vps_manager as vm
    vps = await _get_vps(ctx, args.get("vps_id", ""))
    if not vps:
        return {"error": "VPS no encontrado"}
    svc = re.sub(r"[^a-z0-9._-]", "", args.get("service", ""))
    if not svc.startswith("lluvia-"):
        return {"error": "Solo servicios con prefijo 'lluvia-'"}
    return await vm._ssh_run(
        vps,
        f"sudo systemctl restart {svc} && sudo systemctl is-active {svc}",
        timeout=30,
    )


TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "list_my_vps",
        "description": "Lista VPS conectados del usuario.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "run_vps_command",
        "description": "Ejecuta shell en VPS. Bloquea comandos destructivos.",
        "parameters": {"type": "object", "properties": {
            "vps_id": {"type": "string"}, "command": {"type": "string"},
            "timeout_sec": {"type": "integer"}},
            "required": ["vps_id", "command"]}}},
    {"type": "function", "function": {"name": "deploy_app_to_vps",
        "description": "Deploy end-to-end: clone repo, pip install, systemd, nginx.",
        "parameters": {"type": "object", "properties": {
            "vps_id": {"type": "string"}, "app_slug": {"type": "string"},
            "repo_url": {"type": "string"}, "domain": {"type": "string"},
            "branch": {"type": "string"}},
            "required": ["vps_id", "app_slug", "repo_url"]}}},
    {"type": "function", "function": {"name": "tail_vps_logs",
        "description": "Muestra últimas N líneas de journalctl de un servicio.",
        "parameters": {"type": "object", "properties": {
            "vps_id": {"type": "string"}, "service": {"type": "string"},
            "lines": {"type": "integer"}},
            "required": ["vps_id", "service"]}}},
    {"type": "function", "function": {"name": "restart_vps_service",
        "description": "systemctl restart (solo servicios con prefijo 'lluvia-').",
        "parameters": {"type": "object", "properties": {
            "vps_id": {"type": "string"}, "service": {"type": "string"}},
            "required": ["vps_id", "service"]}}},
]

HANDLERS = {
    "list_my_vps": list_my_vps,
    "run_vps_command": run_vps_command,
    "deploy_app_to_vps": deploy_app_to_vps,
    "tail_vps_logs": tail_vps_logs,
    "restart_vps_service": restart_vps_service,
}
