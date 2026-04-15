"""
Store routes: Packages, Stripe checkout, payment verification.
"""
from fastapi import APIRouter, HTTPException, Request
from database import db, uuid, datetime, timezone
import os

router = APIRouter()

@router.get("/store/packages")
async def get_packages():
    return COIN_PACKAGES

@router.post("/store/checkout")
async def create_checkout(package_id: str, user_id: str, request: Request):
    if package_id not in COIN_PACKAGES:
        raise HTTPException(status_code=400, detail="Paquete inválido")
    
    pkg = COIN_PACKAGES[package_id]
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    api_key = os.environ.get('STRIPE_API_KEY')
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    origin_url = request.headers.get('origin', host_url)
    success_url = f"{origin_url}?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}?payment=cancelled"
    
    checkout_req = CheckoutSessionRequest(
        amount=pkg['price'],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user_id, "package_id": package_id, "username": user['username']}
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_req)
    
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user_id,
        "username": user['username'],
        "package_id": package_id,
        "package_name": pkg['name'],
        "amount": pkg['price'],
        "currency": "usd",
        "coins": pkg['coins'],
        "diamonds": pkg['diamonds'],
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"url": session.url, "session_id": session.session_id}

@router.get("/store/status/{session_id}")
async def check_payment(session_id: str, request: Request):
    api_key = os.environ.get('STRIPE_API_KEY')
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if tx and status.payment_status == 'paid' and tx.get('payment_status') != 'completed':
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "completed"}}
        )
        pkg = COIN_PACKAGES.get(tx['package_id'], {})
        await db.users.update_one(
            {"id": tx['user_id']},
            {"$inc": {"coins": pkg.get('coins', 0), "diamonds": pkg.get('diamonds', 0)}}
        )
    
    return {"status": status.status, "payment_status": status.payment_status}

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    api_key = os.environ.get('STRIPE_API_KEY')
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
        if event.payment_status == 'paid':
            tx = await db.payment_transactions.find_one({"session_id": event.session_id})
            if tx and tx.get('payment_status') != 'completed':
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
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

# ==================== AI ADMIN BOT ====================

from emergentintegrations.llm.chat import LlmChat, UserMessage

