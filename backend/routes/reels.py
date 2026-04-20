"""
Reels — Feed de videos cortos y fotos.
========================================
Herramienta de marketing y publicidad principal de Lluvia Live.

Endpoints:
  GET    /api/reels                         — feed paginado, más recientes primero
  POST   /api/reels                         — publicar reel (video_url o image_url)
  POST   /api/reels/upload                  — upload de archivo de video/imagen (hasta 100MB)
  POST   /api/reels/{reel_id}/like          — toggle like
  POST   /api/reels/{reel_id}/comment       — agregar comentario
  GET    /api/reels/{reel_id}/comments      — listar comentarios
  DELETE /api/reels/{reel_id}               — eliminar (autor o dueño de plataforma)

Almacenamiento: archivos se guardan en UPLOAD_DIR/reels/.
Formato soportado: video/mp4, video/quicktime, video/webm, video/x-msvideo, image/jpeg, image/png, image/webp.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from database import db, UPLOAD_DIR, datetime, timezone, uuid
import os

router = APIRouter()

REELS_DIR = UPLOAD_DIR / "reels"
REELS_DIR.mkdir(exist_ok=True)

ALLOWED_CONTENT_TYPES = {
    "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/x-matroska",
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic",
}
ALLOWED_EXTS = {".mp4", ".mov", ".webm", ".avi", ".mkv", ".jpg", ".jpeg", ".png", ".webp", ".heic"}
MAX_BYTES = 100 * 1024 * 1024  # 100MB


class ReelCreate(BaseModel):
    user_id: str
    title: str
    description: str = ""
    video_url: str = ""
    image_url: str = ""


class CommentCreate(BaseModel):
    user_id: str
    text: str


# ==================== UPLOAD ====================

@router.post("/reels/upload")
async def upload_reel_media(file: UploadFile = File(...)):
    """
    Sube video o imagen para un reel. Retorna {url, content_type, size}.
    Valida extensión, content-type y tamaño máximo 100MB.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"Extensión no permitida: {ext}. Permitidas: {', '.join(sorted(ALLOWED_EXTS))}")
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no permitido: {file.content_type}")

    filename = f"reel_{uuid.uuid4().hex}{ext}"
    dest = REELS_DIR / filename

    size = 0
    try:
        with open(dest, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_BYTES:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="Archivo demasiado grande (máximo 100MB)")
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Error guardando archivo: {str(e)[:200]}")
    finally:
        await file.close()

    return {
        "url": f"/api/uploads/reels/{filename}",
        "content_type": file.content_type,
        "size": size,
        "is_video": (file.content_type or "").startswith("video/") or ext in {".mp4", ".mov", ".webm", ".avi", ".mkv"},
    }


# ==================== CRUD ====================

@router.get("/reels")
async def list_reels(limit: int = 50, skip: int = 0):
    """Feed de reels. Más recientes primero."""
    reels = await db.reels.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Enriquecer con conteo de comentarios
    for r in reels:
        comment_count = await db.reel_comments.count_documents({"reel_id": r["id"]})
        r["comments_count"] = comment_count
        r["comments"] = []  # lista vacía para compat con frontend que hace .comments.length

    return reels


@router.post("/reels")
async def create_reel(body: ReelCreate):
    """Publica un reel. Requiere al menos video_url o image_url."""
    user = await db.users.find_one({"id": body.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="El título es obligatorio")
    if not body.video_url and not body.image_url:
        raise HTTPException(status_code=400, detail="Se requiere al menos un video o imagen")

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": body.user_id,
        "username": user.get("username", ""),
        "avatar": user.get("avatar", ""),
        "title": body.title.strip()[:200],
        "description": body.description.strip()[:1000],
        "video_url": body.video_url,
        "image_url": body.image_url,
        "likes": 0,
        "liked_by": [],
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reels.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/reels/{reel_id}/like")
async def like_reel(reel_id: str, user_id: str):
    """Toggle like en un reel."""
    reel = await db.reels.find_one({"id": reel_id})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel no encontrado")
    liked_by = list(reel.get("liked_by", []))
    if user_id in liked_by:
        liked_by.remove(user_id)
        action = "unliked"
    else:
        liked_by.append(user_id)
        action = "liked"
    await db.reels.update_one(
        {"id": reel_id},
        {"$set": {"liked_by": liked_by, "likes": len(liked_by)}},
    )
    return {"success": True, "action": action, "likes": len(liked_by)}


@router.get("/reels/{reel_id}/comments")
async def list_comments(reel_id: str, limit: int = 50):
    comments = await db.reel_comments.find(
        {"reel_id": reel_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    return comments


@router.post("/reels/{reel_id}/comment")
async def add_comment(reel_id: str, body: CommentCreate):
    reel = await db.reels.find_one({"id": reel_id})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel no encontrado")
    user = await db.users.find_one({"id": body.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comentario vacío")
    # Scan inyección (bot super admin)
    try:
        from routes.bot_super import log_suspicious_input
        blocked = await log_suspicious_input(source="routes/reels.py:add_comment", text=text, user_id=body.user_id)
        if blocked:
            text = "[comentario bloqueado por el sistema de seguridad]"
    except Exception:
        pass
    doc = {
        "id": str(uuid.uuid4()),
        "reel_id": reel_id,
        "user_id": body.user_id,
        "username": user.get("username", ""),
        "avatar": user.get("avatar", ""),
        "text": text[:500],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reel_comments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/reels/{reel_id}")
async def delete_reel(reel_id: str, user_id: str):
    """Elimina un reel. Solo el autor o role=dueño."""
    reel = await db.reels.find_one({"id": reel_id})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel no encontrado")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    is_owner = reel.get("user_id") == user_id
    is_super = user.get("role") == "dueño" or user.get("is_super_admin")
    if not (is_owner or is_super):
        raise HTTPException(status_code=403, detail="Solo el autor o el dueño puede eliminar este reel")

    # Borrar archivo del disco si es local
    for url_field in ("video_url", "image_url"):
        url = reel.get(url_field, "")
        if "/api/uploads/reels/" in url:
            filename = url.split("/api/uploads/reels/")[-1]
            path = REELS_DIR / filename
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass

    await db.reels.delete_one({"id": reel_id})
    await db.reel_comments.delete_many({"reel_id": reel_id})
    return {"success": True}


# ==================== STATIC FILE SERVING ====================

@router.get("/uploads/reels/{filename}")
async def serve_reel_file(filename: str):
    """Sirve archivos de reels. Los videos se sirven con streaming para reproducción progresiva."""
    from fastapi.responses import FileResponse
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    path = REELS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    ext = os.path.splitext(filename)[1].lower()
    media_type_map = {
        ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
        ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp",
    }
    media_type = media_type_map.get(ext, "application/octet-stream")
    return FileResponse(str(path), media_type=media_type, filename=filename)
