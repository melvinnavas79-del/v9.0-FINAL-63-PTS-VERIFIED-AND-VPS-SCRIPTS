"""tools.workspace_ops — file ops sobre user_apps/{user_id}/{slug}/"""
import os
import re
import uuid
import difflib
from datetime import datetime, timezone
from pathlib import Path

SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".next", "dist", "build"}


def _user_apps_dir(user_id):
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from user_workspace import _user_apps_dir as _u
    return _u(user_id)


def _safe_slug(s):
    return re.sub(r"[^a-zA-Z0-9_.-]", "", s or "")[:80]


def _safe_path(app_dir, rel):
    rel = (rel or "").lstrip("/").replace("\\", "/")
    if ".." in rel.split("/"):
        raise ValueError("path con .. no permitido")
    p = (app_dir / rel).resolve()
    if not str(p).startswith(str(app_dir.resolve())):
        raise ValueError("path fuera del workspace")
    return p


def _build_tree(root):
    if not root.exists():
        return {"name": root.name, "type": "dir", "children": []}

    def _walk(p):
        if p.is_file():
            return {"name": p.name, "type": "file",
                    "path": str(p.relative_to(root)).replace("\\", "/"),
                    "size": p.stat().st_size, "ext": p.suffix.lower()}
        children = []
        try:
            for c in sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
                if c.name in SKIP_DIRS:
                    continue
                children.append(_walk(c))
        except PermissionError:
            pass
        return {"name": p.name, "type": "dir",
                "path": str(p.relative_to(root)).replace("\\", "/") if p != root else "",
                "children": children}

    return _walk(root)


async def list_workspace_files(args, ctx):
    slug = _safe_slug(args.get("app_slug", ""))
    base = _user_apps_dir(ctx["user_id"]) / slug
    if not base.exists():
        return {"error": f"App '{slug}' no existe"}
    return {"app_slug": slug, "tree": _build_tree(base)}


async def read_workspace_file(args, ctx):
    slug = _safe_slug(args.get("app_slug", ""))
    base = _user_apps_dir(ctx["user_id"]) / slug
    try:
        f = _safe_path(base, args.get("path", ""))
    except ValueError as e:
        return {"error": str(e)}
    if not f.exists() or not f.is_file():
        return {"error": "Archivo no encontrado"}
    if f.stat().st_size > 2_000_000:
        return {"error": "Archivo >2MB"}
    try:
        return {"path": args.get("path"), "content": f.read_text(encoding="utf-8"),
                "size": f.stat().st_size}
    except UnicodeDecodeError:
        return {"path": args.get("path"), "is_binary": True}


async def write_workspace_file(args, ctx):
    slug = _safe_slug(args.get("app_slug", ""))
    base = _user_apps_dir(ctx["user_id"]) / slug
    base.mkdir(parents=True, exist_ok=True)
    try:
        f = _safe_path(base, args.get("path", ""))
    except ValueError as e:
        return {"error": str(e)}
    f.parent.mkdir(parents=True, exist_ok=True)
    new_content = args.get("content", "")
    old = f.read_text(encoding="utf-8") if f.exists() else ""
    f.write_text(new_content, encoding="utf-8")
    diff = "\n".join(difflib.unified_diff(
        old.splitlines(), new_content.splitlines(),
        fromfile=f"a/{args.get('path')}", tofile=f"b/{args.get('path')}", lineterm="",
    ))
    edit_id = str(uuid.uuid4())
    db = ctx.get("db")
    if db:
        await db.file_edits.insert_one({
            "id": edit_id, "user_id": ctx["user_id"], "app_slug": slug,
            "file_path": args.get("path"), "diff": diff[:50000],
            "previous_content": old[:500_000], "applied_by": "agent",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"ok": True, "edit_id": edit_id, "size": len(new_content)}


async def search_replace_workspace(args, ctx):
    slug = _safe_slug(args.get("app_slug", ""))
    base = _user_apps_dir(ctx["user_id"]) / slug
    try:
        f = _safe_path(base, args.get("path", ""))
    except ValueError as e:
        return {"error": str(e)}
    if not f.exists():
        return {"error": "Archivo no encontrado"}
    old = f.read_text(encoding="utf-8")
    old_str = args.get("old_str", "")
    new_str = args.get("new_str", "")
    if old_str not in old:
        return {"error": "old_str no encontrado"}
    if old.count(old_str) > 1:
        return {"error": f"old_str aparece {old.count(old_str)} veces, debe ser único"}
    f.write_text(old.replace(old_str, new_str), encoding="utf-8")
    return {"ok": True, "replaced": True}


TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "list_workspace_files",
        "description": "Lista árbol de archivos de una app del workspace.",
        "parameters": {"type": "object", "properties": {
            "app_slug": {"type": "string"}}, "required": ["app_slug"]}}},
    {"type": "function", "function": {"name": "read_workspace_file",
        "description": "Lee archivo del workspace (max 2MB).",
        "parameters": {"type": "object", "properties": {
            "app_slug": {"type": "string"}, "path": {"type": "string"}},
            "required": ["app_slug", "path"]}}},
    {"type": "function", "function": {"name": "write_workspace_file",
        "description": "Reescribe archivo. Guarda diff para rollback.",
        "parameters": {"type": "object", "properties": {
            "app_slug": {"type": "string"}, "path": {"type": "string"},
            "content": {"type": "string"}}, "required": ["app_slug", "path", "content"]}}},
    {"type": "function", "function": {"name": "search_replace_workspace",
        "description": "Reemplaza cadena exacta ÚNICA en archivo.",
        "parameters": {"type": "object", "properties": {
            "app_slug": {"type": "string"}, "path": {"type": "string"},
            "old_str": {"type": "string"}, "new_str": {"type": "string"}},
            "required": ["app_slug", "path", "old_str", "new_str"]}}},
]

HANDLERS = {
    "list_workspace_files": list_workspace_files,
    "read_workspace_file": read_workspace_file,
    "write_workspace_file": write_workspace_file,
    "search_replace_workspace": search_replace_workspace,
}
