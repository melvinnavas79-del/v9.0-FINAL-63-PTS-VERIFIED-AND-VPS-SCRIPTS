"""tools.integrations — Twilio (WhatsApp/SMS) + Stripe Checkout."""
import os


async def send_whatsapp(args, ctx):
    to = args.get("to", "")
    body = args.get("body", "")
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_num = os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

    if not sid or not token:
        return {"error": "TWILIO_ACCOUNT_SID/AUTH_TOKEN no configurados en .env"}
    try:
        from twilio.rest import Client
    except ImportError:
        return {"error": "twilio no instalado (pip install twilio)"}

    if not to.startswith("whatsapp:"):
        to = "whatsapp:" + to
    if not from_num.startswith("whatsapp:"):
        from_num = "whatsapp:" + from_num

    try:
        msg = Client(sid, token).messages.create(from_=from_num, to=to, body=body[:1600])
        return {"ok": True, "sid": msg.sid, "status": msg.status}
    except Exception as e:
        return {"error": str(e)[:300]}


async def send_sms(args, ctx):
    to = args.get("to", "")
    body = args.get("body", "")
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_num = os.environ.get("TWILIO_SMS_FROM", "")

    if not all([sid, token, from_num]):
        return {"error": "TWILIO_ACCOUNT_SID / AUTH_TOKEN / SMS_FROM faltan en .env"}
    try:
        from twilio.rest import Client
        msg = Client(sid, token).messages.create(from_=from_num, to=to, body=body[:1500])
        return {"ok": True, "sid": msg.sid, "status": msg.status}
    except ImportError:
        return {"error": "twilio no instalado (pip install twilio)"}
    except Exception as e:
        return {"error": str(e)[:300]}


async def create_stripe_checkout(args, ctx):
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        return {"error": "STRIPE_SECRET_KEY no configurado en .env"}
    try:
        import stripe
    except ImportError:
        return {"error": "stripe no instalado (pip install stripe)"}

    amt = int(args.get("amount_cents", 0))
    if amt < 50:
        return {"error": "amount_cents debe ser >= 50 (mínimo $0.50)"}

    try:
        stripe.api_key = key
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": args.get("currency", "usd"),
                    "product_data": {"name": args.get("description", "Pago")[:120]},
                    "unit_amount": amt,
                },
                "quantity": 1,
            }],
            success_url=args.get("success_url"),
            cancel_url=args.get("cancel_url"),
        )
        return {"ok": True, "session_id": session.id, "checkout_url": session.url}
    except Exception as e:
        return {"error": str(e)[:300]}


TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "send_whatsapp",
        "description": "Envía mensaje WhatsApp via Twilio Business API.",
        "parameters": {"type": "object", "properties": {
            "to": {"type": "string", "description": "Número E.164, ej: +5491112345678"},
            "body": {"type": "string", "description": "Texto del mensaje (max 1600 chars)"}},
            "required": ["to", "body"]}}},
    {"type": "function", "function": {"name": "send_sms",
        "description": "Envía SMS via Twilio. Requiere TWILIO_SMS_FROM en .env.",
        "parameters": {"type": "object", "properties": {
            "to": {"type": "string"}, "body": {"type": "string"}},
            "required": ["to", "body"]}}},
    {"type": "function", "function": {"name": "create_stripe_checkout",
        "description": "Crea una Stripe Checkout Session. Devuelve checkout_url para el cliente.",
        "parameters": {"type": "object", "properties": {
            "amount_cents": {"type": "integer", "description": "Monto en centavos (min 50)"},
            "currency": {"type": "string", "description": "USD, EUR, etc. (default: usd)"},
            "description": {"type": "string"},
            "success_url": {"type": "string"},
            "cancel_url": {"type": "string"}},
            "required": ["amount_cents", "description", "success_url", "cancel_url"]}}},
]

HANDLERS = {
    "send_whatsapp": send_whatsapp,
    "send_sms": send_sms,
    "create_stripe_checkout": create_stripe_checkout,
}
