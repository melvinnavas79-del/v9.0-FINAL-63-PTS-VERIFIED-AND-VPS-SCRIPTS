"""
Economy & Treasury
==================
Modelo económico 70/30 de Lluvia Live:

  • La app SOLO vende ORO (monedas). Los diamantes NO están a la venta.
  • Cuando un usuario recibe regalos (oros), el sistema toma el % de comisión
    de la casa y entrega el resto como DIAMANTES (ganancias netas) al receptor.
    Por defecto: 30% casa, 70% creador.
  • El creador canjea sus DIAMANTES 1 a 1 a ORO cuando quiera retirar o gastar.
    1 000 diamantes = 1 000 oros. Exacto. Sin pérdida.
  • El Dueño (role='dueño') ajusta la comisión, la tasa de canje y los precios
    desde el panel de seguridad (esta ruta).

Colecciones:
  economy_config    → singleton con {commission_rate, diamond_to_coin_rate, coin_price_usd, ...}
  house_revenue     → ledger de comisiones cobradas (audit trail)
  coin_packages     → paquetes de recarga vendibles (precio / cantidad)
  recharge_agents   → agentes regionales con su comisión individual
  wallet_exchanges  → historial de canjes diamantes→oros
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import db, datetime, timezone, uuid

router = APIRouter()

DEFAULT_CONFIG = {
    "commission_rate": 0.30,            # 30% casa, 70% creador
    "diamond_to_coin_rate": 1.0,        # 1 diamante = 1 oro (canje creador)
    "coin_price_usd_per_1000": 1.0,     # $1 USD = 1 000 oros (vendible)
    "min_diamond_exchange": 1,          # mínimo de canje
    "updated_at": "",
    "updated_by": "",
}


async def _get_cfg() -> dict:
    cfg = await db.economy_config.find_one({"_id": "singleton"})
    if not cfg:
        cfg = {"_id": "singleton", **DEFAULT_CONFIG}
        await db.economy_config.insert_one(cfg)
    cfg.pop("_id", None)
    # Cast numerics safely
    cfg["commission_rate"] = float(cfg.get("commission_rate", 0.30))
    cfg["diamond_to_coin_rate"] = float(cfg.get("diamond_to_coin_rate", 1.0))
    cfg["coin_price_usd_per_1000"] = float(cfg.get("coin_price_usd_per_1000", 1.0))
    cfg["min_diamond_exchange"] = int(cfg.get("min_diamond_exchange", 1))
    return cfg


async def _require_dueno(user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id})
    if not user or user.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el Dueño")
    return user


# ==================== PUBLIC ====================

@router.get("/economy/config")
async def get_economy_config():
    """Configuración pública visible por la UI (comisión, tasa, precios)."""
    return await _get_cfg()


# ==================== ADMIN ====================

class EconomyUpdate(BaseModel):
    commission_rate: float | None = None      # 0.0 .. 0.6
    diamond_to_coin_rate: float | None = None  # recomendado 1.0
    coin_price_usd_per_1000: float | None = None
    min_diamond_exchange: int | None = None


@router.put("/admin/economy/config")
async def update_economy_config(payload: EconomyUpdate, admin_id: str):
    admin = await _require_dueno(admin_id)
    cfg = await _get_cfg()
    if payload.commission_rate is not None:
        if payload.commission_rate < 0 or payload.commission_rate > 0.6:
            raise HTTPException(status_code=400, detail="commission_rate debe estar entre 0.0 y 0.6")
        cfg["commission_rate"] = float(payload.commission_rate)
    if payload.diamond_to_coin_rate is not None:
        if payload.diamond_to_coin_rate <= 0:
            raise HTTPException(status_code=400, detail="diamond_to_coin_rate debe ser positivo")
        cfg["diamond_to_coin_rate"] = float(payload.diamond_to_coin_rate)
    if payload.coin_price_usd_per_1000 is not None:
        if payload.coin_price_usd_per_1000 <= 0:
            raise HTTPException(status_code=400, detail="coin_price_usd_per_1000 debe ser positivo")
        cfg["coin_price_usd_per_1000"] = float(payload.coin_price_usd_per_1000)
    if payload.min_diamond_exchange is not None:
        cfg["min_diamond_exchange"] = max(1, int(payload.min_diamond_exchange))
    cfg["updated_at"] = datetime.now(timezone.utc).isoformat()
    cfg["updated_by"] = admin.get("username", admin_id)
    await db.economy_config.update_one(
        {"_id": "singleton"}, {"$set": cfg}, upsert=True
    )
    return cfg


@router.get("/admin/economy/house-revenue")
async def get_house_revenue(admin_id: str, limit: int = 100):
    """Últimos registros del ledger + totales."""
    await _require_dueno(admin_id)
    rows = await db.house_revenue.find().sort("created_at", -1).limit(limit).to_list(limit)
    for r in rows:
        r.pop("_id", None)
    agg = await db.house_revenue.aggregate([
        {"$group": {"_id": None, "total_commission": {"$sum": "$commission_coins"}, "total_gross": {"$sum": "$gross_coins"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    summary = agg[0] if agg else {"total_commission": 0, "total_gross": 0, "count": 0}
    summary.pop("_id", None)
    return {"summary": summary, "entries": rows}


# ==================== COIN PACKAGES (sólo oros a la venta) ====================

class CoinPackage(BaseModel):
    id: str | None = None
    name: str
    coins: int
    price_usd: float
    bonus_coins: int = 0
    active: bool = True
    order: int = 0


@router.get("/economy/coin-packages")
async def list_coin_packages():
    rows = await db.coin_packages.find({"active": True}).sort("order", 1).to_list(100)
    for r in rows:
        r.pop("_id", None)
    return rows


@router.get("/admin/economy/coin-packages")
async def admin_list_coin_packages(admin_id: str):
    await _require_dueno(admin_id)
    rows = await db.coin_packages.find().sort("order", 1).to_list(100)
    for r in rows:
        r.pop("_id", None)
    return rows


@router.post("/admin/economy/coin-packages")
async def admin_upsert_coin_package(payload: CoinPackage, admin_id: str):
    await _require_dueno(admin_id)
    doc = payload.dict()
    if not doc.get("id"):
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.coin_packages.insert_one(doc)
    else:
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.coin_packages.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    doc.pop("_id", None)
    return doc


@router.delete("/admin/economy/coin-packages/{pkg_id}")
async def admin_delete_coin_package(pkg_id: str, admin_id: str):
    await _require_dueno(admin_id)
    r = await db.coin_packages.delete_one({"id": pkg_id})
    return {"deleted": r.deleted_count}


# ==================== DIAMONDS → COINS (canje 1:1 exacto) ====================

class DiamondExchange(BaseModel):
    user_id: str
    diamonds: int


@router.post("/wallet/redeem-diamonds")
async def redeem_diamonds(payload: DiamondExchange):
    """Canje DIAMANTES → OROS. Tasa configurable (default 1:1). Ni un gramo menos."""
    cfg = await _get_cfg()
    rate = cfg["diamond_to_coin_rate"]
    min_d = cfg["min_diamond_exchange"]
    if payload.diamonds < min_d:
        raise HTTPException(status_code=400, detail=f"Mínimo {min_d} diamantes por canje")
    user = await db.users.find_one({"id": payload.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    current_d = int(user.get("diamonds", 0))
    if current_d < payload.diamonds:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente. Tienes {current_d:,} 💎")
    coins_to_add = int(round(payload.diamonds * rate))
    result = await db.users.update_one(
        {"id": payload.user_id, "diamonds": {"$gte": payload.diamonds}},
        {"$inc": {"diamonds": -payload.diamonds, "coins": coins_to_add}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Operación rechazada (saldo cambió)")
    await db.wallet_exchanges.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "username": user.get("username", ""),
        "direction": "diamonds_to_coins",
        "diamonds_spent": payload.diamonds,
        "coins_received": coins_to_add,
        "rate": rate,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    updated = await db.users.find_one({"id": payload.user_id})
    return {
        "success": True,
        "diamonds_spent": payload.diamonds,
        "coins_received": coins_to_add,
        "new_coins": int(updated.get("coins", 0)),
        "new_diamonds": int(updated.get("diamonds", 0)),
    }


# ==================== RECHARGE AGENTS (agentes regionales) ====================

class Agent(BaseModel):
    id: str | None = None
    username: str
    numeric_id: str = ""
    region: str
    commission_rate: float = 0.10       # 10% comisión regional del agente
    status: str = "active"              # active / paused
    contact: str = ""
    notes: str = ""


@router.get("/admin/agents")
async def list_agents(admin_id: str):
    await _require_dueno(admin_id)
    rows = await db.recharge_agents.find().sort("region", 1).to_list(500)
    for r in rows:
        r.pop("_id", None)
    return rows


@router.post("/admin/agents")
async def upsert_agent(payload: Agent, admin_id: str):
    await _require_dueno(admin_id)
    if payload.commission_rate < 0 or payload.commission_rate > 0.5:
        raise HTTPException(status_code=400, detail="commission_rate entre 0.0 y 0.5")
    doc = payload.dict()
    if not doc.get("id"):
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        doc["coins_sold_total"] = 0
        doc["revenue_generated"] = 0
        await db.recharge_agents.insert_one(doc)
    else:
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.recharge_agents.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    doc.pop("_id", None)
    return doc


@router.delete("/admin/agents/{agent_id}")
async def delete_agent(agent_id: str, admin_id: str):
    await _require_dueno(admin_id)
    r = await db.recharge_agents.delete_one({"id": agent_id})
    return {"deleted": r.deleted_count}


class AgentSale(BaseModel):
    agent_id: str
    buyer_user_id: str
    coins_sold: int
    payment_ref: str = ""


@router.post("/admin/agents/record-sale")
async def record_agent_sale(payload: AgentSale, admin_id: str):
    """Registra una venta de oros hecha por un agente regional. Suma la comisión al ledger."""
    await _require_dueno(admin_id)
    if payload.coins_sold <= 0:
        raise HTTPException(status_code=400, detail="coins_sold debe ser positivo")
    agent = await db.recharge_agents.find_one({"id": payload.agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agente no encontrado")
    buyer = await db.users.find_one({"id": payload.buyer_user_id})
    if not buyer:
        raise HTTPException(status_code=404, detail="Comprador no encontrado")
    agent_commission_coins = int(payload.coins_sold * float(agent.get("commission_rate", 0.10)))
    house_revenue_coins = payload.coins_sold - agent_commission_coins
    # Acreditar oros al comprador
    await db.users.update_one(
        {"id": payload.buyer_user_id},
        {"$inc": {"coins": payload.coins_sold, "total_recharged": payload.coins_sold}},
    )
    # Auditoría + actualizar totales del agente
    sale_id = str(uuid.uuid4())
    await db.agent_sales.insert_one({
        "id": sale_id,
        "agent_id": payload.agent_id,
        "agent_username": agent.get("username", ""),
        "region": agent.get("region", ""),
        "buyer_user_id": payload.buyer_user_id,
        "buyer_username": buyer.get("username", ""),
        "coins_sold": payload.coins_sold,
        "agent_commission": agent_commission_coins,
        "house_revenue": house_revenue_coins,
        "payment_ref": payload.payment_ref,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.recharge_agents.update_one(
        {"id": payload.agent_id},
        {"$inc": {"coins_sold_total": payload.coins_sold, "revenue_generated": house_revenue_coins}},
    )
    await db.house_revenue.insert_one({
        "id": str(uuid.uuid4()),
        "source": "agent_sale",
        "reference": sale_id,
        "agent_id": payload.agent_id,
        "gross_coins": payload.coins_sold,
        "commission_coins": house_revenue_coins,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "sale_id": sale_id, "agent_commission": agent_commission_coins, "house_revenue": house_revenue_coins}
