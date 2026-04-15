"""
Event routes: King/CP events, cashback, weekly rewards, event requests.
"""
from fastapi import APIRouter, HTTPException
from database import db, EventRequest, uuid, datetime, timezone, create_notification
import random

router = APIRouter()

KING_LEVELS = {
    "king":   {"goal": 200000000, "reward": 3000000, "label": "King"},
    "king_1": {"goal": 300000000, "reward": 4000000, "label": "King 1"},
    "king_3": {"goal": 500000000, "reward": 5000000, "label": "King 3"},
}

CP_LEVELS = {
    6: {"reward": 5000000, "label": "CP Nivel 6"},
    7: {"reward": 7000000, "label": "CP Nivel 7"},
}

@router.post("/events/weekly-rewards")
async def distribute_weekly_rewards(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño puede distribuir premios")
    top_users = await db.users.find().sort("coins", -1).limit(3).to_list(3)
    rewards = [45000000, 35000000, 25000000]
    aristocracies = [8, 7, 6]
    results = []
    for i, u in enumerate(top_users):
        if i < len(rewards):
            new_badges = list(u.get('badges', []))
            new_badges.append(f"🏆 Top {i+1} Semanal")
            if i == 0:
                new_badges.append("🏆 Campeón Semanal")
                new_badges.append("💍 Anillo de Campeón")
                new_badges.append("🎖️ Placa de Oro")
            
            await db.users.update_one({"id": u['id']}, {
                "$inc": {"coins": rewards[i]},
                "$set": {
                    "badges": new_badges,
                    "aristocracy": max(u.get('aristocracy', 0), aristocracies[i])
                }
            })
            results.append({
                "username": u['username'], "place": i+1, "reward": rewards[i],
                "aristocracy": aristocracies[i],
                "flash_fame": i == 0
            })
    
    # Save flash fame (Top 1)
    if top_users:
        await db.system.update_one(
            {"key": "flash_fame"},
            {"$set": {
                "key": "flash_fame",
                "user_id": top_users[0]['id'],
                "username": top_users[0]['username'],
                "avatar": top_users[0]['avatar'],
                "coins": top_users[0]['coins'],
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": "weekly", "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "results": results}

@router.get("/flash-fame")
async def get_flash_fame():
    fame = await db.system.find_one({"key": "flash_fame"})
    if fame:
        fame.pop('_id', None)
    return fame or {}

@router.post("/events/baby-robot")
async def baby_robot_prize(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    total = 0
    async for u in db.users.find():
        total += u.get('coins', 0)
    if total >= 25000000:
        users = await db.users.find().to_list(500)
        bonus_per_user = 15000000 // max(len(users), 1)
        for u in users:
            await db.users.update_one({"id": u['id']}, {"$inc": {"coins": bonus_per_user}})
        return {"success": True, "total_global": total, "bonus_per_user": bonus_per_user, "users_rewarded": len(users)}
    return {"success": False, "total_global": total, "needed": 25000000, "message": "Meta no alcanzada"}

@router.post("/events/king-level")
async def king_level_reward(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    new_level = user.get('level', 1) + 1
    bonus = 3000000
    await db.users.update_one({"id": user_id}, {"$inc": {"coins": bonus, "level": 1}})
    updated = await db.users.find_one({"id": user_id})
    return {"success": True, "new_level": new_level, "bonus": bonus, "new_coins": updated['coins']}

@router.post("/events/clan-rewards")
async def clan_rewards(admin_id: str, body: dict = None):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    top_clans = await db.clanes.find().sort("weekly_coins", -1).limit(3).to_list(3)
    default_rewards = [25000000, 20000000, 15000000]
    rewards = (body or {}).get('prizes', default_rewards) if body else default_rewards
    aristocracies = [6, 5, 4]
    results = []
    for i, clan in enumerate(top_clans):
        if i < len(rewards):
            per_member = rewards[i] // max(len(clan.get('members', [])), 1)
            for mid in clan.get('members', []):
                await db.users.update_one({"id": mid}, {"$inc": {"coins": per_member}})
            # Give owner aristocracy
            await db.users.update_one(
                {"id": clan['owner_id']},
                {"$set": {"aristocracy": max(aristocracies[i], 0)},
                 "$inc": {"coins": rewards[i]}}
            )
            results.append({"clan": clan['name'], "place": i+1, "total_reward": rewards[i], "aristocracy": aristocracies[i]})
    
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": "clan_weekly", "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "results": results}

@router.get("/events/history")
async def get_events():
    events = await db.events.find().sort("created_at", -1).to_list(50)
    return [{k: v for k, v in e.items() if k != "_id"} for e in events]

@router.post("/events/cashback")
async def distribute_cashback(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    tiers = [(600000000, 45000000), (500000000, 25000000), (100000000, 10000000)]
    users = await db.users.find({"total_spent": {"$gte": 100000000}}).to_list(500)
    results = []
    for u in users:
        spent = u.get('total_spent', 0)
        cashback = 0
        for threshold, reward in tiers:
            if spent >= threshold:
                cashback = reward
                break
        if cashback > 0:
            await db.users.update_one({"id": u['id']}, {"$inc": {"coins": cashback}})
            results.append({"username": u['username'], "spent": spent, "cashback": cashback})
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": "cashback_weekly",
        "results": results, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "results": results, "total_users": len(results)}

# ==================== SISTEMA DE EVENTOS CON APROBACION ====================

KING_LEVELS = {
    "king":   {"goal": 200000000, "reward": 3000000, "label": "King"},
    "king_1": {"goal": 300000000, "reward": 4000000, "label": "King 1"},
    "king_3": {"goal": 500000000, "reward": 5000000, "label": "King 3"},
}

CP_LEVELS = {
    6: {"reward": 5000000, "label": "CP Nivel 6"},
    7: {"reward": 7000000, "label": "CP Nivel 7"},
}

# EventRequest imported from database

@router.post("/events/request")
async def request_event(req: EventRequest):
    """User requests an event. Admin must approve. Max 1 per month per user."""
    user = await db.users.find_one({"id": req.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Check monthly limit
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    existing = await db.event_requests.find_one({
        "user_id": req.user_id,
        "created_at": {"$gte": month_start.isoformat()},
        "status": {"$in": ["pending", "approved", "completed"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Solo puedes solicitar 1 evento al mes")
    
    # Validate event type
    if req.event_type.startswith("king"):
        if req.event_type not in KING_LEVELS:
            raise HTTPException(status_code=400, detail="Nivel King invalido")
        info = KING_LEVELS[req.event_type]
    elif req.event_type.startswith("cp_"):
        cp_lvl = int(req.event_type.split("_")[1])
        if cp_lvl not in CP_LEVELS:
            raise HTTPException(status_code=400, detail="Nivel CP invalido")
        # Check user has a CP partner
        cp = await db.parejas.find_one({"$or": [{"user1_id": req.user_id}, {"user2_id": req.user_id}]})
        if not cp:
            raise HTTPException(status_code=400, detail="No tienes pareja CP")
        info = CP_LEVELS[cp_lvl]
    else:
        raise HTTPException(status_code=400, detail="Tipo de evento invalido")
    
    request_doc = {
        "id": str(uuid.uuid4()),
        "user_id": req.user_id,
        "username": user['username'],
        "avatar": user.get('avatar', ''),
        "event_type": req.event_type,
        "status": "pending",  # pending -> approved -> in_progress -> completed / rejected
        "game_progress": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.event_requests.insert_one(request_doc)
    request_doc.pop('_id', None)
    
    # Notify admin (dueño)
    admins = await db.users.find({"role": "dueño"}).to_list(10)
    for admin in admins:
        await create_notification(
            "evento_solicitud",
            "Nueva Solicitud de Evento",
            f"{user['username']} solicita evento {info.get('label', req.event_type)}",
            target_user_id=admin['id'],
            data={"request_id": request_doc['id'], "event_type": req.event_type}
        )
    
    return {"success": True, "request": request_doc}

@router.get("/events/requests")
async def get_event_requests(admin_id: str, status: str = None):
    """Admin gets all event requests"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    query = {}
    if status:
        query["status"] = status
    requests = await db.event_requests.find(query).sort("created_at", -1).to_list(100)
    return [{k: v for k, v in r.items() if k != "_id"} for r in requests]

@router.post("/events/approve/{request_id}")
async def approve_event(request_id: str, admin_id: str):
    """Admin approves an event request. User can now start playing toward their goal."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    
    req = await db.event_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if req['status'] != 'pending':
        raise HTTPException(status_code=400, detail=f"Solicitud ya esta en estado: {req['status']}")
    
    await db.event_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify user
    event_type = req['event_type']
    if event_type.startswith("king"):
        info = KING_LEVELS.get(event_type, {})
        goal_text = f"Meta: {info.get('goal', 0) // 1000000}M en juegos"
    else:
        cp_lvl = int(event_type.split("_")[1])
        info = CP_LEVELS.get(cp_lvl, {})
        goal_text = f"Sube tu pareja a nivel {cp_lvl}"
    
    await create_notification(
        "evento_aprobado",
        "Evento Aprobado!",
        f"Tu evento {info.get('label', event_type)} fue aprobado. {goal_text}",
        target_user_id=req['user_id']
    )
    
    return {"success": True, "request_id": request_id}

@router.post("/events/reject/{request_id}")
async def reject_event(request_id: str, admin_id: str):
    """Admin rejects an event request."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    
    req = await db.event_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    await db.event_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_notification(
        "evento_rechazado",
        "Evento Rechazado",
        "Tu solicitud de evento fue rechazada.",
        target_user_id=req['user_id']
    )
    
    return {"success": True}

@router.get("/events/my-events/{user_id}")
async def get_my_events(user_id: str):
    """User sees their event requests and progress."""
    requests = await db.event_requests.find({"user_id": user_id}).sort("created_at", -1).to_list(20)
    result = []
    for r in requests:
        r.pop('_id', None)
        et = r['event_type']
        if et.startswith("king"):
            info = KING_LEVELS.get(et, {})
            r['goal'] = info.get('goal', 0)
            r['reward'] = info.get('reward', 0)
            r['label'] = info.get('label', et)
        else:
            cp_lvl = int(et.split("_")[1])
            info = CP_LEVELS.get(cp_lvl, {})
            r['reward'] = info.get('reward', 0)
            r['label'] = info.get('label', et)
            r['goal'] = 0  # CP events don't have a game goal
        result.append(r)
    return result

@router.post("/events/update-progress")
async def update_event_progress(user_id: str, amount: int):
    """Called when user plays games. Updates their approved King event progress."""
    req = await db.event_requests.find_one({
        "user_id": user_id,
        "status": "approved",
        "event_type": {"$regex": "^king"}
    })
    if not req:
        return {"updated": False}
    
    new_progress = req.get('game_progress', 0) + amount
    info = KING_LEVELS.get(req['event_type'], {})
    goal = info.get('goal', 0)
    
    if new_progress >= goal:
        # Goal reached! Pay the reward
        reward = info.get('reward', 0)
        await db.users.update_one({"id": user_id}, {"$inc": {"coins": reward}})
        await db.event_requests.update_one(
            {"id": req['id']},
            {"$set": {"status": "completed", "game_progress": new_progress, "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
        await create_notification(
            "evento_completado",
            "Evento Completado!",
            f"Cumpliste la meta de {info.get('label', '')}! +{reward // 1000000}M monedas",
            target_user_id=user_id
        )
        await db.events.insert_one({
            "id": str(uuid.uuid4()), "type": "king_completed",
            "user_id": user_id, "event_type": req['event_type'],
            "reward": reward, "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"updated": True, "completed": True, "reward": reward}
    else:
        await db.event_requests.update_one(
            {"id": req['id']},
            {"$set": {"game_progress": new_progress}}
        )
        return {"updated": True, "completed": False, "progress": new_progress, "goal": goal}

@router.post("/events/cp-levelup")
async def cp_event_levelup(user_id: str, target_level: int):
    """Triggered when CP reaches level 6 or 7. Pays both partners."""
    if target_level not in CP_LEVELS:
        raise HTTPException(status_code=400, detail="Nivel CP invalido (6 o 7)")
    
    # Find the user's CP
    cp = await db.parejas.find_one({"$or": [{"user1_id": user_id}, {"user2_id": user_id}]})
    if not cp:
        raise HTTPException(status_code=404, detail="No tienes pareja CP")
    
    current_level = cp.get('level', 1)
    if current_level >= target_level:
        raise HTTPException(status_code=400, detail=f"La pareja ya alcanzo nivel {current_level}")
    
    # Check there's an approved CP event request
    req = await db.event_requests.find_one({
        "user_id": user_id,
        "event_type": f"cp_{target_level}",
        "status": "approved"
    })
    if not req:
        raise HTTPException(status_code=400, detail="No tienes evento CP aprobado para este nivel")
    
    reward = CP_LEVELS[target_level]['reward']
    user1_id = cp['user1_id']
    user2_id = cp['user2_id']
    
    await db.users.update_one({"id": user1_id}, {"$inc": {"coins": reward}})
    await db.users.update_one({"id": user2_id}, {"$inc": {"coins": reward}})
    await db.parejas.update_one({"id": cp['id']}, {"$set": {"level": target_level}})
    
    await db.event_requests.update_one(
        {"id": req['id']},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    for uid in [user1_id, user2_id]:
        await create_notification(
            "evento_cp",
            f"CP Nivel {target_level}!",
            f"Tu pareja llego a nivel {target_level}! +{reward // 1000000}M monedas",
            target_user_id=uid
        )
    
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": f"cp_level_{target_level}",
        "cp_id": cp['id'], "reward_each": reward,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "level": target_level, "reward_each": reward}
