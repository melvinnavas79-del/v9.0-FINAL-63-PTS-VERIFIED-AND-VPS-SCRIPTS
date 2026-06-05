"""tools.dev_ops — SUPER-AGENT TOOLS (admin only).
13 tools tipo E1: bash, grep, glob, file view/edit, lint, supervisorctl, git, screenshot, pip/yarn.
"""
import os
import re
import asyncio
import glob as _glob
import uuid
from datetime import datetime, timezone
from pathlib import Path

ALLOWED_PREFIXES = [
    "/opt/lluvia", "/app/backend", "/app/frontend", "/app/tools",
    "/app/templates", "/app/user_apps", "/app/memory", "/tmp/lluvia",
    "/root/lluvia-v9",  # dev local
]
BLOCKED_SUBSTR = [
    ".env", ".ssh", "/etc/passwd", "/etc/shadow", "id_rsa", "id_ed25519", "credentials",
]
BLOCKED_CMD = [
    r"\brm\s+-rf\s+/(?:\s|$)",
    r"\brm\s+-rf\s+/(?:home|etc|var|usr|root|app|opt)(?:\s|/|$)",
    r"\bmkfs\b",
    r"\bdd\s+.*of=/dev/",
    r"\bshutdown\b",
    r"\breboot\b",
    r"\bhalt\b",
    r":\(\)\s*{\s*:\|",
    r">\s*/dev/sda",
]


def _path_ok(p):
    if not p:
        return False
    ap = os.path.abspath(p)
    if any(b in ap for b in BLOCKED_SUBSTR):
        return False
    return any(ap == pre or ap.startswith(pre + "/") for pre in ALLOWED_PREFIXES)


def _cmd_blocked(cmd):
    for pat in BLOCKED_CMD:
        if re.search(pat, cmd):
            return pat
    return None


async def _audit(ctx, tool, args, summary):
    try:
        db = ctx.get("db")
        if db:
            await db.agent_audit.insert_one({
                "user_id": ctx.get("user_id"),
                "is_admin": ctx.get("is_admin", False),
                "tool": tool,
                "args_preview": str(args)[:400],
                "result": summary[:600],
                "at": datetime.now(timezone.utc).isoformat(),
            })
    except Exception:
        pass


async def exec_bash(args, ctx):
    cmd = args.get("command", "")
    cwd = args.get("cwd") or "/opt/lluvia"
    timeout = max(1, min(int(args.get("timeout_sec", 60)), 600))

    if not cmd.strip():
        return {"error": "command vacío"}
    blocked = _cmd_blocked(cmd)
    if blocked:
        await _audit(ctx, "exec_bash", args, f"BLOCKED: {blocked}")
        return {"error": f"Comando bloqueado: {blocked}"}
    if cwd and not _path_ok(cwd):
        return {"error": f"cwd '{cwd}' no permitido"}

    try:
        proc = await asyncio.create_subprocess_shell(
            cmd, cwd=cwd if os.path.isdir(cwd) else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        result = {
            "exit_code": proc.returncode,
            "stdout": stdout.decode("utf-8", "ignore")[:30000],
            "stderr": stderr.decode("utf-8", "ignore")[:10000],
        }
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        result = {"error": f"timeout {timeout}s", "exit_code": -124}

    await _audit(ctx, "exec_bash", args, f"exit={result.get('exit_code')}")
    return result


async def glob_files(args, ctx):
    pattern = args.get("pattern", "")
    path = args.get("path") or "/opt/lluvia"
    if not _path_ok(path):
        return {"error": f"path '{path}' no permitido"}
    full = os.path.join(path, "**", pattern) if not pattern.startswith("/") else pattern
    matches = [
        m for m in _glob.glob(full, recursive=True)
        if not any(b in m for b in BLOCKED_SUBSTR)
    ]
    return {"matches": matches[:200], "total": len(matches)}


async def grep_code(args, ctx):
    pattern = args.get("pattern", "")
    path = args.get("path") or "/opt/lluvia"
    file_glob = args.get("file_glob") or "*"
    max_r = int(args.get("max_results", 100))
    if not _path_ok(path):
        return {"error": "path no permitido"}
    if not pattern:
        return {"error": "pattern requerido"}
    cmd = ["grep", "-rn", "--include", file_glob, "-E", pattern, path]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        lines = stdout.decode("utf-8", "ignore").splitlines()[:max_r]
        return {"matches": lines, "total": len(lines), "truncated": len(lines) >= max_r}
    except asyncio.TimeoutError:
        return {"error": "grep timeout"}


async def view_file_range(args, ctx):
    path = args.get("path", "")
    if not _path_ok(path):
        return {"error": "path no permitido"}
    p = Path(path)
    if not p.exists() or not p.is_file():
        return {"error": "no encontrado"}
    if p.stat().st_size > 3_000_000:
        return {"error": "archivo >3MB"}
    try:
        lines = p.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return {"error": "archivo binario"}
    start = max(1, int(args.get("start_line", 1)))
    end = min(int(args.get("end_line", min(len(lines), start + 200))), len(lines))
    out = "\n".join(f"{i + 1:6d}\t{lines[i]}" for i in range(start - 1, end))
    return {"path": path, "start": start, "end": end, "total_lines": len(lines), "content": out}


async def create_file(args, ctx):
    path = args.get("path", "")
    if not _path_ok(path):
        return {"error": "path no permitido"}
    content = args.get("content", "")
    overwrite = bool(args.get("overwrite", False))
    p = Path(path)
    if p.exists() and not overwrite:
        return {"error": "ya existe (usar overwrite:true para sobreescribir)"}
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    await _audit(ctx, "create_file", args, f"created {path}")
    return {"ok": True, "path": path, "size": len(content)}


async def search_replace(args, ctx):
    path = args.get("path", "")
    if not _path_ok(path):
        return {"error": "path no permitido"}
    p = Path(path)
    if not p.exists():
        return {"error": "no encontrado"}
    old = p.read_text(encoding="utf-8")
    old_str = args.get("old_str", "")
    new_str = args.get("new_str", "")
    if old_str not in old:
        return {"error": "old_str no encontrado"}
    occ = old.count(old_str)
    if occ > 1 and not args.get("replace_all"):
        return {"error": f"old_str aparece {occ} veces (usar replace_all:true o dar más contexto)"}
    bak = p.with_suffix(p.suffix + ".bak")
    bak.write_text(old, encoding="utf-8")
    p.write_text(old.replace(old_str, new_str), encoding="utf-8")
    await _audit(ctx, "search_replace", args, f"replaced {occ} ocurrencias en {path}")
    return {"ok": True, "replacements": occ, "backup": str(bak)}


async def lint_python(args, ctx):
    path = args.get("path", "")
    if not _path_ok(path):
        return {"error": "path no permitido"}
    cmd = ["ruff", "check", path]
    if args.get("fix"):
        cmd.append("--fix")
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        return {
            "exit_code": proc.returncode,
            "stdout": stdout.decode()[:10000],
            "stderr": stderr.decode()[:5000],
        }
    except FileNotFoundError:
        return {"error": "ruff no instalado (pip install ruff)"}


async def lint_javascript(args, ctx):
    path = args.get("path", "")
    if not _path_ok(path):
        return {"error": "path no permitido"}
    # Buscar eslint en posibles ubicaciones
    for cwd in ["/opt/lluvia/frontend", "/app/frontend", "/root/lluvia-v9/frontend"]:
        eslint = f"{cwd}/node_modules/.bin/eslint"
        if os.path.exists(eslint) and os.path.isdir(cwd):
            break
    else:
        return {"error": "eslint no instalado (yarn add eslint en frontend/)"}

    cmd = [eslint, path]
    if args.get("fix"):
        cmd.append("--fix")
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, cwd=cwd,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        return {
            "exit_code": proc.returncode,
            "stdout": stdout.decode()[:10000],
            "stderr": stderr.decode()[:5000],
        }
    except asyncio.TimeoutError:
        return {"error": "lint timeout"}


async def supervisorctl_action(args, ctx):
    action = args.get("action", "status")
    service = args.get("service", "")
    if action not in {"restart", "start", "stop", "status", "tail"}:
        return {"error": "action inválida (restart|start|stop|status|tail)"}
    if service and not re.match(r"^[a-zA-Z0-9_-]+$", service):
        return {"error": "service inválido"}

    if action == "tail":
        lines = int(args.get("lines", 50))
        for log_path in [
            f"/var/log/supervisor/{service}.err.log",
            f"/var/log/supervisor/{service}.out.log",
        ]:
            if os.path.exists(log_path):
                proc = await asyncio.create_subprocess_exec(
                    "tail", "-n", str(lines), log_path,
                    stdout=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                return {"log": stdout.decode()[:15000]}
        return {"error": f"log no existe para servicio '{service}'"}

    cmd = ["sudo", "supervisorctl", action]
    if service:
        cmd.append(service)
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    await _audit(ctx, "supervisorctl", args, f"{action} {service}")
    return {
        "exit_code": proc.returncode,
        "stdout": stdout.decode()[:5000],
        "stderr": stderr.decode()[:2000],
    }


async def git_log_diff(args, ctx):
    action = args.get("action", "log")
    n = int(args.get("limit", 10))
    cwd = args.get("cwd", "/opt/lluvia")
    if not _path_ok(cwd):
        return {"error": "cwd no permitido"}
    if not os.path.isdir(cwd):
        cwd = "/root/lluvia-v9"

    if action == "log":
        cmd = ["git", "log", f"-n{n}", "--oneline", "--decorate"]
    elif action == "diff":
        ref = args.get("ref", "HEAD~1")
        if not re.match(r"^[a-zA-Z0-9_./-]+$", ref):
            return {"error": "ref inválida"}
        cmd = ["git", "diff", ref, "--stat"]
    elif action == "status":
        cmd = ["git", "status", "--short"]
    else:
        return {"error": "action: log|diff|status"}

    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=cwd,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return {
        "exit_code": proc.returncode,
        "stdout": stdout.decode()[:15000],
        "stderr": stderr.decode()[:2000],
    }


async def screenshot_url(args, ctx):
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"error": "playwright no instalado (pip install playwright && playwright install chromium)"}

    url = args.get("url", "")
    if not url.startswith(("http://", "https://")):
        return {"error": "url inválida (debe empezar con http:// o https://)"}

    shots = Path(os.environ.get("SCREENSHOTS_DIR", "/tmp/lluvia_screenshots"))
    shots.mkdir(parents=True, exist_ok=True)
    sid = uuid.uuid4().hex[:12]
    out = shots / f"agent_{sid}.png"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            c = await browser.new_context(viewport={
                "width": int(args.get("viewport_width", 1280)),
                "height": int(args.get("viewport_height", 800)),
            })
            page = await c.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(int(args.get("wait_ms", 1500)))
            await page.screenshot(path=str(out), full_page=bool(args.get("full_page", False)))
            await browser.close()
    except Exception as e:
        return {"error": f"playwright: {e}"}

    db = ctx.get("db")
    if db:
        await db.screenshots.insert_one({
            "id": sid, "user_id": ctx["user_id"], "app_slug": "_agent",
            "url": url, "filename": out.name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "ok": True, "screenshot_id": sid,
        "image_url": f"/api/me/apps/_/screenshots/{sid}.png",
        "size_bytes": out.stat().st_size,
    }


async def install_pip(args, ctx):
    pkg = args.get("package", "").strip()
    if not re.match(r"^[a-zA-Z0-9_.\-=<>~!\[\]]+$", pkg):
        return {"error": "nombre de paquete inválido"}
    proc = await asyncio.create_subprocess_exec(
        "pip", "install", pkg,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=180)
    await _audit(ctx, "install_pip", args, f"pip install {pkg}")
    return {
        "exit_code": proc.returncode,
        "stdout": stdout.decode()[:5000],
        "stderr": stderr.decode()[:3000],
    }


async def install_yarn(args, ctx):
    pkg = args.get("package", "").strip()
    if not re.match(r"^[@a-zA-Z0-9_./\-^~=]+$", pkg):
        return {"error": "nombre de paquete inválido"}
    for cwd in ["/opt/lluvia/frontend", "/app/frontend", "/root/lluvia-v9/frontend"]:
        if os.path.isdir(cwd):
            break
    else:
        return {"error": "directorio frontend no encontrado"}
    proc = await asyncio.create_subprocess_exec(
        "yarn", "add", pkg, cwd=cwd,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=240)
    await _audit(ctx, "install_yarn", args, f"yarn add {pkg}")
    return {
        "exit_code": proc.returncode,
        "stdout": stdout.decode()[:5000],
        "stderr": stderr.decode()[:3000],
    }


TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "exec_bash",
        "description": "[ADMIN] Ejecuta bash. Bloquea destructivos. Timeout configurable.",
        "parameters": {"type": "object", "properties": {
            "command": {"type": "string"}, "cwd": {"type": "string"},
            "timeout_sec": {"type": "integer"}},
            "required": ["command"]}}},
    {"type": "function", "function": {"name": "glob_files",
        "description": "[ADMIN] Busca archivos por glob pattern.",
        "parameters": {"type": "object", "properties": {
            "pattern": {"type": "string"}, "path": {"type": "string"}},
            "required": ["pattern"]}}},
    {"type": "function", "function": {"name": "grep_code",
        "description": "[ADMIN] grep -rn recursivo con regex.",
        "parameters": {"type": "object", "properties": {
            "pattern": {"type": "string"}, "path": {"type": "string"},
            "file_glob": {"type": "string"}, "max_results": {"type": "integer"}},
            "required": ["pattern"]}}},
    {"type": "function", "function": {"name": "view_file_range",
        "description": "[ADMIN] Lee archivo con números de línea.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"}, "start_line": {"type": "integer"},
            "end_line": {"type": "integer"}},
            "required": ["path"]}}},
    {"type": "function", "function": {"name": "create_file",
        "description": "[ADMIN] Crea archivo. Falla si ya existe (overwrite:true para forzar).",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"}, "content": {"type": "string"},
            "overwrite": {"type": "boolean"}},
            "required": ["path", "content"]}}},
    {"type": "function", "function": {"name": "search_replace",
        "description": "[ADMIN] Reemplaza cadena ÚNICA en archivo. Backup .bak automático.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"}, "old_str": {"type": "string"},
            "new_str": {"type": "string"}, "replace_all": {"type": "boolean"}},
            "required": ["path", "old_str", "new_str"]}}},
    {"type": "function", "function": {"name": "lint_python",
        "description": "[ADMIN] ruff check. fix:true para autofix.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"}, "fix": {"type": "boolean"}},
            "required": ["path"]}}},
    {"type": "function", "function": {"name": "lint_javascript",
        "description": "[ADMIN] eslint sobre archivo JS/JSX.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"}, "fix": {"type": "boolean"}},
            "required": ["path"]}}},
    {"type": "function", "function": {"name": "supervisorctl_action",
        "description": "[ADMIN] supervisorctl restart|start|stop|status|tail.",
        "parameters": {"type": "object", "properties": {
            "action": {"type": "string"}, "service": {"type": "string"},
            "lines": {"type": "integer"}},
            "required": ["action"]}}},
    {"type": "function", "function": {"name": "git_log_diff",
        "description": "[ADMIN] git log|diff|status del repositorio.",
        "parameters": {"type": "object", "properties": {
            "action": {"type": "string"}, "limit": {"type": "integer"},
            "ref": {"type": "string"}, "cwd": {"type": "string"}},
            "required": ["action"]}}},
    {"type": "function", "function": {"name": "screenshot_url",
        "description": "[ADMIN] Screenshot Playwright de una URL. Devuelve imagen PNG.",
        "parameters": {"type": "object", "properties": {
            "url": {"type": "string"}, "viewport_width": {"type": "integer"},
            "viewport_height": {"type": "integer"}, "wait_ms": {"type": "integer"},
            "full_page": {"type": "boolean"}},
            "required": ["url"]}}},
    {"type": "function", "function": {"name": "install_pip",
        "description": "[ADMIN] pip install package (con versión opcional).",
        "parameters": {"type": "object", "properties": {
            "package": {"type": "string"}},
            "required": ["package"]}}},
    {"type": "function", "function": {"name": "install_yarn",
        "description": "[ADMIN] yarn add package en el directorio frontend.",
        "parameters": {"type": "object", "properties": {
            "package": {"type": "string"}},
            "required": ["package"]}}},
]

HANDLERS = {
    "exec_bash": exec_bash,
    "glob_files": glob_files,
    "grep_code": grep_code,
    "view_file_range": view_file_range,
    "create_file": create_file,
    "search_replace": search_replace,
    "lint_python": lint_python,
    "lint_javascript": lint_javascript,
    "supervisorctl_action": supervisorctl_action,
    "git_log_diff": git_log_diff,
    "screenshot_url": screenshot_url,
    "install_pip": install_pip,
    "install_yarn": install_yarn,
}
