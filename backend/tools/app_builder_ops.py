"""tools.app_builder_ops — materializa templates pre-built."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def _materialize(template_id, args, ctx):
    import app_builder
    from user_workspace import _user_apps_dir
    app_name = (args.get("app_name") or "Mi App").strip()
    brand = (args.get("brand_color") or "#5B8DEF").strip()
    target = (args.get("deploy_target") or "render").lower()
    if target not in {"render", "railway", "heroku", "fly", "vps", "docker", "local"}:
        target = "render"
    slug = app_builder._slugify(args.get("app_slug") or app_name)
    target_dir = str(_user_apps_dir(ctx["user_id"]) / slug)
    result = app_builder.materialize_template(
        template_id=template_id,
        target_dir=target_dir,
        app_name=app_name,
        brand_color=brand,
    )
    result["deploy_target"] = target
    result["card_type"] = "app_built"
    return result


async def generate_audio_room_app(args, ctx):
    return await _materialize("audio_room", args, ctx)


async def generate_tiktok_app(args, ctx):
    return await _materialize("tiktok_clone", args, ctx)


async def _maybe(tid, args, ctx):
    try:
        import app_builder
        if tid in app_builder.TEMPLATES:
            return await _materialize(tid, args, ctx)
    except Exception:
        pass
    return {"error": f"Template '{tid}' aún no implementado (backlog)."}


async def generate_radio_app(args, ctx):     return await _maybe("radio_online", args, ctx)
async def generate_salon_app(args, ctx):     return await _maybe("salon", args, ctx)
async def generate_ecommerce_app(args, ctx): return await _maybe("ecommerce", args, ctx)


TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "generate_audio_room_app",
        "description": "Materializa Audio Room (Clubhouse clone). 40 monedas.",
        "parameters": {"type": "object", "properties": {
            "app_name": {"type": "string"}, "brand_color": {"type": "string"},
            "deploy_target": {"type": "string"}, "app_slug": {"type": "string"}},
            "required": ["app_name"]}}},
    {"type": "function", "function": {"name": "generate_tiktok_app",
        "description": "Materializa TikTok/Bigo Live clone. 50 monedas.",
        "parameters": {"type": "object", "properties": {
            "app_name": {"type": "string"}, "brand_color": {"type": "string"},
            "deploy_target": {"type": "string"}, "app_slug": {"type": "string"}},
            "required": ["app_name"]}}},
    {"type": "function", "function": {"name": "generate_radio_app",
        "description": "Radio Online (HLS + DJ-AI). [BACKLOG]",
        "parameters": {"type": "object", "properties": {
            "app_name": {"type": "string"}, "brand_color": {"type": "string"}},
            "required": ["app_name"]}}},
    {"type": "function", "function": {"name": "generate_salon_app",
        "description": "Peluquería/Salón (booking + WhatsApp). [BACKLOG]",
        "parameters": {"type": "object", "properties": {
            "app_name": {"type": "string"}, "brand_color": {"type": "string"}},
            "required": ["app_name"]}}},
    {"type": "function", "function": {"name": "generate_ecommerce_app",
        "description": "E-commerce (catálogo + Stripe). [BACKLOG]",
        "parameters": {"type": "object", "properties": {
            "app_name": {"type": "string"}, "brand_color": {"type": "string"}},
            "required": ["app_name"]}}},
]

HANDLERS = {
    "generate_audio_room_app": generate_audio_room_app,
    "generate_tiktok_app": generate_tiktok_app,
    "generate_radio_app": generate_radio_app,
    "generate_salon_app": generate_salon_app,
    "generate_ecommerce_app": generate_ecommerce_app,
}
