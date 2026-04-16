"""
Store routes: Packages, Stripe checkout, payment verification.
Uses the official 'stripe' Python SDK directly. No third-party wrappers.
"""
from fastapi import APIRouter, HTTPException, Request
from database import db, uuid, datetime, timezone
import os
import stripe

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


@router.get("/store/packages")
async def get_packages():
    """Get available coin packages."""
    return COIN_PACKAGES


@router.post("/store/checkout")
async def create_checkout(package_id: str, user_id: str, request: Request):
    """Create Stripe checkout session using the official stripe SDK."""
    if package_id not in COIN_PACKAGES:
        raise HTTPException(status_code=400, detail="Paquete invalido")

    pkg = COIN_PACKAGES[package_id]
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe no configurado. Contacta a Soporte de Lluvia Live.")

    stripe.api_key = api_key
    origin_url = request.headers.get('origin', str(request.base_url).rstrip('/'))
    success_url = f"{origin_url}?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}?payment=cancelled"

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": int(pkg['price'] * 100),
                "product_data": {"name": pkg['name']},
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user_id, "package_id": package_id, "username": user['username']},
    )

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.id,
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

    return {"url": session.url, "session_id": session.id}


@router.get("/store/status/{session_id}")
async def check_payment(session_id: str):
    """Check payment status using Stripe SDK."""
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe no configurado")

    stripe.api_key = api_key
    session = stripe.checkout.Session.retrieve(session_id)

    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if tx and session.payment_status == 'paid' and tx.get('payment_status') != 'completed':
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "completed"}}
        )
        pkg = COIN_PACKAGES.get(tx['package_id'], {})
        await db.users.update_one(
            {"id": tx['user_id']},
            {"$inc": {"coins": pkg.get('coins', 0), "diamonds": pkg.get('diamonds', 0)}}
        )

    return {"status": session.status, "payment_status": session.payment_status}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    api_key = os.environ.get('STRIPE_API_KEY')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET', '')

    if not api_key:
        return {"status": "error", "message": "Stripe no configurado"}

    stripe.api_key = api_key

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(body, sig, webhook_secret)
        else:
            import json
            event = stripe.Event.construct_from(json.loads(body), stripe.api_key)

        if event.type == 'checkout.session.completed':
            session = event.data.object
            if session.payment_status == 'paid':
                tx = await db.payment_transactions.find_one({"session_id": session.id})
                if tx and tx.get('payment_status') != 'completed':
                    await db.payment_transactions.update_one(
                        {"session_id": session.id},
                        {"$set": {"payment_status": "completed"}}
                    )
                    pkg = COIN_PACKAGES.get(tx['package_id'], {})
                    await db.users.update_one(
                        {"id": tx['user_id']},
                        {"$inc": {"coins": pkg.get('coins', 0), "diamonds": pkg.get('diamonds', 0)}}
                    )

        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
