"""
Diagnostics endpoint - operational health checks.
=================================================
Solo accesible por dueño / super_admin. Permite diagnosticar:
- Estado de credenciales PayPal LIVE (OAuth real contra api-m.paypal.com)
- Permisos del directorio de uploads
- Espacio en disco
- Variables de entorno críticas configuradas
- Conexión MongoDB

Usar abriendo: {REACT_APP_BACKEND_URL}/api/diagnostics?user_id=<tu_id>
"""
from fastapi import APIRouter, HTTPException
from database import db, UPLOAD_DIR
import os
import shutil
import requests
import time

router = APIRouter()


async def _require_owner(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get("role") != "dueño" and not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Solo el dueño puede acceder")
    return user


def _check_paypal() -> dict:
    """Ejecuta OAuth real contra PayPal con las credenciales del .env."""
    client_id = os.environ.get("PAYPAL_CLIENT_ID", "")
    client_secret = os.environ.get("PAYPAL_CLIENT_SECRET", "")
    mode = os.environ.get("PAYPAL_MODE", "sandbox").lower()
    base = "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"

    result = {
        "mode": mode,
        "client_id_prefix": client_id[:10] + "..." if client_id else "",
        "client_id_length": len(client_id),
        "secret_configured": bool(client_secret),
        "base_url": base,
    }

    if not client_id or not client_secret:
        result["status"] = "error"
        result["error"] = "PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET no configurados en .env"
        return result

    try:
        t0 = time.time()
        r = requests.post(
            f"{base}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
            headers={"Accept": "application/json"},
            timeout=10,
        )
        elapsed = int((time.time() - t0) * 1000)
        result["http_status"] = r.status_code
        result["latency_ms"] = elapsed
        if r.status_code == 200:
            data = r.json()
            result["status"] = "ok"
            result["app_id"] = data.get("app_id")
            result["scope_count"] = len((data.get("scope") or "").split())
            result["token_type"] = data.get("token_type")
            result["expires_in"] = data.get("expires_in")
        else:
            result["status"] = "error"
            result["error"] = r.text[:400]
    except requests.exceptions.RequestException as e:
        result["status"] = "error"
        result["error"] = f"Network error: {type(e).__name__}: {str(e)[:200]}"
    except Exception as e:
        result["status"] = "error"
        result["error"] = f"{type(e).__name__}: {str(e)[:200]}"
    return result


def _check_uploads() -> dict:
    """Verifica que el directorio de uploads es escribible."""
    result = {
        "upload_dir": str(UPLOAD_DIR),
        "exists": UPLOAD_DIR.exists(),
    }
    if not UPLOAD_DIR.exists():
        result["status"] = "error"
        result["error"] = "Directorio de uploads no existe"
        return result

    try:
        # Intentar escribir un archivo de prueba
        test_path = UPLOAD_DIR / ".diagnostics_test"
        with open(test_path, "w") as f:
            f.write("ok")
        content = test_path.read_text()
        test_path.unlink()
        result["writable"] = True

        # Listar muestra de archivos
        files = list(UPLOAD_DIR.iterdir())
        result["file_count"] = len(files)
        result["sample_files"] = [f.name for f in files[:5]]

        # Permisos
        stat = UPLOAD_DIR.stat()
        result["mode_octal"] = oct(stat.st_mode)[-3:]
        result["owner_uid"] = stat.st_uid

        result["status"] = "ok" if content == "ok" else "error"
    except PermissionError as e:
        result["status"] = "error"
        result["writable"] = False
        result["error"] = f"PermissionError: {str(e)}"
    except Exception as e:
        result["status"] = "error"
        result["error"] = f"{type(e).__name__}: {str(e)[:200]}"
    return result


def _check_disk() -> dict:
    """Espacio libre en disco."""
    try:
        total, used, free = shutil.disk_usage(str(UPLOAD_DIR.parent))
        return {
            "status": "ok",
            "total_gb": round(total / 1e9, 2),
            "used_gb": round(used / 1e9, 2),
            "free_gb": round(free / 1e9, 2),
            "used_pct": round(100 * used / total, 1),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _check_env() -> dict:
    """Variables críticas configuradas (sin exponer valores)."""
    required = [
        "MONGO_URL",
        "DB_NAME",
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET",
        "PAYPAL_MODE",
        "GEMINI_API_KEY",
        "FIREBASE_PROJECT_ID",
    ]
    out = {}
    for key in required:
        v = os.environ.get(key, "")
        out[key] = {"set": bool(v), "length": len(v)}
    return out


async def _check_mongo() -> dict:
    try:
        users = await db.users.count_documents({})
        rooms = await db.rooms.count_documents({})
        return {"status": "ok", "users": users, "rooms": rooms}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("/diagnostics")
async def diagnostics(user_id: str):
    """
    Diagnóstico completo del sistema en producción.
    Requiere user_id de dueño o super_admin.
    """
    user = await _require_owner(user_id)
    return {
        "timestamp": int(time.time()),
        "requested_by": user.get("username"),
        "version": "2.1.0",
        "paypal": _check_paypal(),
        "uploads": _check_uploads(),
        "disk": _check_disk(),
        "env": _check_env(),
        "mongo": await _check_mongo(),
        "server": {
            "hostname": os.uname().nodename,
            "python_version": os.popen("python --version").read().strip(),
            "backend_root": str(UPLOAD_DIR.parent),
        },
    }


@router.post("/diagnostics/paypal/test-order")
async def test_paypal_order(user_id: str, amount: float = 1.00):
    """
    Crea una orden PayPal de prueba (sin capturar) para verificar end-to-end
    que la API acepta crear órdenes con las credenciales configuradas.
    """
    await _require_owner(user_id)

    client_id = os.environ.get("PAYPAL_CLIENT_ID", "")
    client_secret = os.environ.get("PAYPAL_CLIENT_SECRET", "")
    mode = os.environ.get("PAYPAL_MODE", "sandbox").lower()
    base = "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="PayPal no configurado")

    try:
        # 1. Get token
        tr = requests.post(
            f"{base}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
            timeout=10,
        )
        if tr.status_code != 200:
            raise HTTPException(status_code=500, detail=f"OAuth failed: {tr.text[:200]}")
        token = tr.json()["access_token"]

        # 2. Create order
        orr = requests.post(
            f"{base}/v2/checkout/orders",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "amount": {"currency_code": "USD", "value": f"{amount:.2f}"},
                    "description": "Lluvia Live diagnostics test order",
                }],
            },
            timeout=10,
        )
        return {
            "status": "ok" if orr.status_code == 201 else "error",
            "http_status": orr.status_code,
            "response": orr.json() if orr.headers.get("content-type", "").startswith("application/json") else orr.text[:400],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)[:200]}")
