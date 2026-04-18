"""
Store routes: Coin packages, PayPal checkout, payment verification.
Uses the official 'paypalrestsdk' Python SDK directly.
"""
from fastapi import APIRouter, HTTPException, Request
from database import db, uuid, datetime, timezone
import os
import paypalrestsdk

router = APIRouter()

COIN_PACKAGES = {
    "pack_1000": {"coins": 1000, "diamonds": 0, "price": 1.00, "name": "1,000 Monedas", "label": "1,000 Monedas"},
    "pack_5000": {"coins": 5000, "diamonds": 50, "price": 4.50, "name": "5,000 Monedas", "label": "5,000 Monedas"},
    "pack_10000": {"coins": 10000, "diamonds": 150, "price": 8.00, "name": "10,000 Monedas", "label": "10,000 Monedas"},
    "pack_50000": {"coins": 50000, "diamonds": 500, "price": 35.00, "name": "50,000 Monedas", "label": "50,000 Monedas"},
    "pack_100000": {"coins": 100000, "diamonds": 1500, "price": 60.00, "name": "100,000 Monedas", "label": "100,000 Monedas"},
    "pack_500000": {"coins": 500000, "diamonds": 10000, "price": 250.00, "name": "500,000 Monedas", "label": "500,000 Monedas"},
    "pack_1000000": {"coins": 1000000, "diamonds": 50000, "price": 450.00, "name": "1,000,000 Monedas", "label": "1,000,000 Monedas"},
}


def get_paypal_api():
    """Configure PayPal SDK with env credentials."""
    mode = os.environ.get('PAYPAL_MODE', 'sandbox')
    client_id = os.environ.get('PAYPAL_CLIENT_ID', '')
    client_secret = os.environ.get('PAYPAL_CLIENT_SECRET', '')
    if not client_id or not client_secret:
        return None
    paypalrestsdk.configure({
        "mode": mode,
        "client_id": client_id,
        "client_secret": client_secret,
    })
    return True


@router.get("/store/packages")
async def get_packages():
    """Get available coin packages."""
    return COIN_PACKAGES


@router.get("/store/paypal/config")
async def paypal_config():
    """Public PayPal configuration for frontend SDK init (client_id + mode only)."""
    mode = os.environ.get('PAYPAL_MODE', 'sandbox')
    client_id = os.environ.get('PAYPAL_CLIENT_ID', '')
    return {
        "mode": mode,
        "client_id": client_id,
        "configured": bool(client_id and os.environ.get('PAYPAL_CLIENT_SECRET')),
        "currency": "USD",
    }


@router.get("/store/paypal/status")
async def paypal_status():
    """Live status check: verifies PayPal credentials by requesting an OAuth token.
    Returns authenticated=True if PayPal accepts our keys."""
    import requests
    mode = os.environ.get('PAYPAL_MODE', 'sandbox')
    client_id = os.environ.get('PAYPAL_CLIENT_ID', '')
    client_secret = os.environ.get('PAYPAL_CLIENT_SECRET', '')
    if not client_id or not client_secret:
        return {"authenticated": False, "mode": mode, "error": "credentials_missing"}
    base = "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"
    try:
        r = requests.post(
            f"{base}/v1/oauth2/token",
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json"},
            timeout=10,
        )
        if r.status_code == 200:
            j = r.json()
            return {
                "authenticated": True,
                "mode": mode,
                "app_id": j.get("app_id"),
                "scope_count": len((j.get("scope") or "").split()),
                "token_type": j.get("token_type"),
                "expires_in": j.get("expires_in"),
            }
        return {"authenticated": False, "mode": mode, "error": f"http_{r.status_code}", "detail": r.text[:200]}
    except Exception as e:
        return {"authenticated": False, "mode": mode, "error": "connection_error", "detail": str(e)[:200]}


@router.post("/store/checkout")
async def create_checkout(package_id: str, user_id: str, request: Request):
    """Create PayPal payment for a coin package."""
    if package_id not in COIN_PACKAGES:
        raise HTTPException(status_code=400, detail="Paquete invalido")

    pkg = COIN_PACKAGES[package_id]
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not get_paypal_api():
        raise HTTPException(status_code=500, detail="PayPal no configurado. Contacta a Soporte de Lluvia Live.")

    origin_url = request.headers.get('origin', str(request.base_url).rstrip('/'))
    tx_id = str(uuid.uuid4())

    payment = paypalrestsdk.Payment({
        "intent": "sale",
        "payer": {"payment_method": "paypal"},
        "redirect_urls": {
            "return_url": f"{origin_url}?payment=success&tx_id={tx_id}",
            "cancel_url": f"{origin_url}?payment=cancelled",
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": pkg['name'],
                    "sku": package_id,
                    "price": f"{pkg['price']:.2f}",
                    "currency": "USD",
                    "quantity": 1,
                }]
            },
            "amount": {
                "total": f"{pkg['price']:.2f}",
                "currency": "USD",
            },
            "description": f"Lluvia Live - {pkg['name']}",
        }],
    })

    if payment.create():
        # Find approval URL
        approval_url = None
        for link in payment.links:
            if link.rel == "approval_url":
                approval_url = link.href
                break

        await db.payment_transactions.insert_one({
            "id": tx_id,
            "paypal_payment_id": payment.id,
            "user_id": user_id,
            "username": user['username'],
            "package_id": package_id,
            "package_name": pkg['name'],
            "amount": pkg['price'],
            "currency": "usd",
            "coins": pkg['coins'],
            "diamonds": pkg.get('diamonds', 0),
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        return {"url": approval_url, "payment_id": payment.id, "tx_id": tx_id}
    else:
        raise HTTPException(status_code=500, detail=f"Error de PayPal: {payment.error}")


@router.post("/store/execute-payment")
async def execute_payment(payment_id: str, payer_id: str):
    """Execute PayPal payment after user approval."""
    if not get_paypal_api():
        raise HTTPException(status_code=500, detail="PayPal no configurado")

    payment = paypalrestsdk.Payment.find(payment_id)

    if payment.execute({"payer_id": payer_id}):
        # Payment successful - deliver coins
        tx = await db.payment_transactions.find_one({"paypal_payment_id": payment_id})
        if tx and tx.get('payment_status') != 'completed':
            await db.payment_transactions.update_one(
                {"paypal_payment_id": payment_id},
                {"$set": {"payment_status": "completed", "payer_id": payer_id}}
            )
            pkg = COIN_PACKAGES.get(tx['package_id'], {})
            await db.users.update_one(
                {"id": tx['user_id']},
                {"$inc": {"coins": pkg.get('coins', 0), "diamonds": pkg.get('diamonds', 0)}}
            )
            return {"success": True, "coins_added": pkg.get('coins', 0), "diamonds_added": pkg.get('diamonds', 0)}
        return {"success": True, "message": "Pago ya procesado"}
    else:
        raise HTTPException(status_code=500, detail=f"Error al ejecutar pago: {payment.error}")


@router.get("/store/status/{tx_id}")
async def check_payment(tx_id: str):
    """Check payment status by transaction ID."""
    tx = await db.payment_transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")

    # If pending, try to check PayPal status
    if tx.get('payment_status') == 'pending' and tx.get('paypal_payment_id'):
        if get_paypal_api():
            try:
                payment = paypalrestsdk.Payment.find(tx['paypal_payment_id'])
                if payment.state == 'approved':
                    await db.payment_transactions.update_one(
                        {"id": tx_id}, {"$set": {"payment_status": "completed"}}
                    )
                    pkg = COIN_PACKAGES.get(tx['package_id'], {})
                    await db.users.update_one(
                        {"id": tx['user_id']},
                        {"$inc": {"coins": pkg.get('coins', 0), "diamonds": pkg.get('diamonds', 0)}}
                    )
                    return {"status": "completed", "payment_status": "paid"}
            except Exception:
                pass

    return {"status": tx.get('payment_status', 'unknown'), "payment_status": tx.get('payment_status', 'unknown')}


@router.get("/store/paypal-client-id")
async def get_paypal_client_id():
    """Return the PayPal Client ID for frontend SDK."""
    client_id = os.environ.get('PAYPAL_CLIENT_ID', '')
    if not client_id:
        raise HTTPException(status_code=500, detail="PayPal no configurado")
    return {"client_id": client_id}
