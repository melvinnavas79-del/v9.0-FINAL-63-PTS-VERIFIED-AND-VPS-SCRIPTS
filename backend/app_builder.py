"""App template builder — v12.30.
Materializa templates pre-built en el workspace del usuario.
"""
import re
import json
from pathlib import Path

TEMPLATES: dict = {}

# ==================== AUDIO ROOM TEMPLATE ====================
TEMPLATES["audio_room"] = {
    "name": "Audio Room (Clubhouse clone)",
    "price": 40,
    "stack": "FastAPI + React + WebRTC",
    "files": {
        "README.md": lambda cfg: f"# {cfg['app_name']}\nAudio room app generada por Lluvia App Studio.\n\n## Stack\n- Backend: FastAPI\n- Frontend: React + TailwindCSS\n- Audio: WebRTC self-hosted\n\n## Brand color\n`{cfg['brand_color']}`\n",
        "backend/main.py": lambda cfg: f'''"""
{cfg["app_name"]} — Backend (FastAPI)
Generado por Lluvia App Studio v12.30
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="{cfg["app_name"]} API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
async def health():
    return {{"status": "ok", "app": "{cfg["app_name"]}"}}

@app.get("/api/rooms")
async def list_rooms():
    return []
''',
        "backend/requirements.txt": lambda _: "fastapi==0.110.1\nuvicorn==0.25.0\nmotor==3.3.1\nwebsockets==16.0\n",
        "frontend/src/App.jsx": lambda cfg: f'''import React from "react";

export default function App() {{
  return (
    <div style={{{{ background: "{cfg["brand_color"]}", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}}}>
      <h1 style={{{{ color: "#fff", fontFamily: "sans-serif" }}}}>{cfg["app_name"]}</h1>
    </div>
  );
}}
''',
        "frontend/package.json": lambda cfg: json.dumps({"name": _slugify(cfg["app_name"]), "version": "0.1.0", "dependencies": {"react": "^18.2.0", "react-dom": "^18.2.0"}}, indent=2) + "\n",
    }
}

# ==================== TIKTOK CLONE TEMPLATE ====================
TEMPLATES["tiktok_clone"] = {
    "name": "TikTok / Bigo Live clone",
    "price": 50,
    "stack": "FastAPI + React + WebRTC",
    "files": {
        "README.md": lambda cfg: f"# {cfg['app_name']}\nShort video + live audio app generada por Lluvia App Studio.\n\n## Brand\n`{cfg['brand_color']}`\n",
        "backend/main.py": lambda cfg: f'''"""
{cfg["app_name"]} — Backend (FastAPI)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="{cfg["app_name"]} API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
async def health():
    return {{"status": "ok"}}

@app.get("/api/reels")
async def list_reels():
    return []
''',
        "backend/requirements.txt": lambda _: "fastapi==0.110.1\nuvicorn==0.25.0\nmotor==3.3.1\npython-multipart==0.0.24\n",
        "frontend/src/App.jsx": lambda cfg: f'''import React from "react";

export default function App() {{
  return (
    <div style={{{{ background: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}}}>
      <h1 style={{{{ color: "{cfg["brand_color"]}", fontFamily: "sans-serif" }}}}>{cfg["app_name"]}</h1>
    </div>
  );
}}
''',
        "frontend/package.json": lambda cfg: json.dumps({"name": _slugify(cfg["app_name"]), "version": "0.1.0", "dependencies": {"react": "^18.2.0", "react-dom": "^18.2.0"}}, indent=2) + "\n",
    }
}


def _slugify(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "-", s.lower())[:40].strip("-") or "mi-app"


def materialize_template(template_id: str, target_dir: str, app_name: str, brand_color: str = "#5B8DEF") -> dict:
    tpl = TEMPLATES.get(template_id)
    if not tpl:
        return {"error": f"Template '{template_id}' no existe"}

    cfg = {"app_name": app_name, "brand_color": brand_color}
    root = Path(target_dir)
    written = []

    for rel_path, content_fn in tpl["files"].items():
        p = root / rel_path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content_fn(cfg), encoding="utf-8")
        written.append(rel_path)

    return {
        "ok": True,
        "template": template_id,
        "app_name": app_name,
        "target_dir": str(root),
        "files_written": written,
        "price_coins": tpl["price"],
        "stack": tpl["stack"],
    }
