"""tools/ — registro modular de tools v12.30."""
from . import workspace_ops, vps_ops, app_builder_ops, integrations, dev_ops

ALL_MODULES = [workspace_ops, vps_ops, app_builder_ops, integrations, dev_ops]


def all_definitions(is_admin: bool = False) -> list:
    defs = []
    for mod in ALL_MODULES:
        if mod is dev_ops and not is_admin:
            continue
        defs.extend(getattr(mod, "TOOL_DEFINITIONS", []))
    return defs


def all_handlers(is_admin: bool = False) -> dict:
    out = {}
    for mod in ALL_MODULES:
        if mod is dev_ops and not is_admin:
            continue
        out.update(getattr(mod, "HANDLERS", {}))
    return out


async def dispatch(tool_name: str, args: dict, ctx: dict) -> dict:
    handlers = all_handlers(is_admin=ctx.get("is_admin", False))
    fn = handlers.get(tool_name)
    if not fn:
        return {"error": f"Tool '{tool_name}' no registrada o sin permisos"}
    try:
        return await fn(args or {}, ctx)
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}
