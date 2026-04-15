"""
Bot routes: AI assistant, auto-reply, missions, room monitoring.
"""
from fastapi import APIRouter, HTTPException
from database import db, BotMessage, WatchMission, uuid, datetime, timezone, create_notification
import os

router = APIRouter()

@router.post("/bot/command")
async def bot_command(msg: BotMessage):
    # Only owner can use
    admin = await db.users.find_one({"id": msg.admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño puede usar el Bot")
    
    # Get context
    total_users = await db.users.count_documents({})
    total_rooms = await db.rooms.count_documents({})
    online_seats = 0
    rooms_data = await db.rooms.find().to_list(100)
    for r in rooms_data:
        online_seats += sum(1 for s in r.get('seats', []) if s)
    
    top_spender = await db.users.find().sort("total_spent", -1).limit(1).to_list(1)
    top_rich = await db.users.find().sort("coins", -1).limit(3).to_list(3)
    total_coins = sum(u.get('coins', 0) for u in await db.users.find().to_list(500))
    
    all_users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(50)
    user_list = ", ".join([f"{u['username']}(Lv.{u.get('level',1)},coins:{u.get('coins',0)})" for u in all_users[:20]])
    
    context = f"""
DATOS DE LLUVIA LIVE:
- Total usuarios: {total_users}
- Total salas: {total_rooms}
- Usuarios en salas ahora: {online_seats}
- Total monedas en circulación: {total_coins:,}
- Mi saldo (Dueño): {admin.get('coins',0):,} monedas, {admin.get('diamonds',0):,} diamantes
- Top rico: {top_rich[0]['username'] if top_rich else 'N/A'} ({top_rich[0].get('coins',0):,} coins)
- Top gastador: {top_spender[0]['username'] if top_spender else 'N/A'}
- Usuarios: {user_list}
- Salas y sus usuarios en micros: {', '.join([f"{r['name']}(online:{r.get('active_users',0)}, users:[{','.join([s['username'] for s in r.get('seats',[]) if s])}])" for r in rooms_data])}

ACCIONES DISPONIBLES - Responde SOLO con el JSON:
{{"action": "nombre", "params": {{...}}, "confirm_message": "texto de confirmación"}}

Acciones:
- ban_user: {{"action":"ban_user","params":{{"username":"X"}}}}
- unban_user: {{"action":"unban_user","params":{{"username":"X"}}}}
- give_coins: {{"action":"give_coins","params":{{"username":"X","amount":N}}}}
- give_diamonds: {{"action":"give_diamonds","params":{{"username":"X","amount":N}}}}
- set_level: {{"action":"set_level","params":{{"username":"X","level":N}}}}
- set_aristocracy: {{"action":"set_aristocracy","params":{{"username":"X","aristocracy":N}}}}
- verify_user: {{"action":"verify_user","params":{{"username":"X"}}}}
- broadcast: {{"action":"broadcast","params":{{"message":"X"}}}}
- expand_room: {{"action":"expand_room","params":{{"room_name":"X","seats":N}}}}
- pay_room: {{"action":"pay_room","params":{{"room_name":"X","amount":N}}}} (regala monedas a TODOS los que están en los micros de esa sala)
- pay_user: {{"action":"pay_user","params":{{"username":"X","amount":N}}}} (paga premio a un usuario)
- pay_top: {{"action":"pay_top","params":{{"prizes":[N1,N2,N3]}}}} (paga premios al top 1,2,3)
- mute_user: {{"action":"mute_user","params":{{"username":"X"}}}}
- kick_user: {{"action":"kick_user","params":{{"username":"X"}}}} (saca de la sala)
- say_in_room: {{"action":"say_in_room","params":{{"room_name":"X","message":"Y"}}}} (el bot habla en esa sala)
- watch_room: {{"action":"watch_room","params":{{"room_name":"X","keywords":["palabra1","palabra2"]}}}} (vigila sala por palabras clave)
- bot_answer_room: {{"action":"bot_answer_room","params":{{"room_name":"X"}}}} (bot atiende preguntas en la sala)
- activate_bot: {{"action":"activate_bot","params":{{"room_name":"X"}}}} (activa el bot autonomo en la sala, el bot habla solo con todos)
- deactivate_bot: {{"action":"deactivate_bot","params":{{"room_name":"X"}}}} (desactiva el bot de la sala)
- save_note: {{"action":"save_note","params":{{"category":"finanzas|notas|recordatorio|otro","title":"titulo","content":"contenido"}}}} (guarda una nota o dato para el dueño)
- list_notes: {{"action":"list_notes","params":{{"category":"finanzas"}}}} (lista notas guardadas)
- delete_note: {{"action":"delete_note","params":{{"title":"titulo"}}}} (borra una nota)

REGLAS:
1. Para acciones de PAGO, las monedas salen de MI cuenta de dueño
2. SIEMPRE incluye "confirm_message" con un resumen de lo que vas a hacer
3. Si es consulta, responde en texto normal SIN JSON
4. Sé conciso y directo
5. MEMORIA: Tienes acceso a las notas guardadas del dueño. Usalas para dar contexto.
6. FINANZAS: El dueño te puede pedir que lleves conteo de sus finanzas. Guarda cada ingreso/gasto como nota categoria "finanzas".
"""

    # Load owner's saved notes for context
    notes = await db.bot_notes.find({"admin_id": msg.admin_id}).sort("created_at", -1).limit(30).to_list(30)
    notes.reverse()
    if notes:
        notes_lines = []
        for n in notes:
            notes_lines.append(f"[{n.get('category','')}] {n.get('title','')}: {n.get('content','')}")
        notes_text = "\n".join(notes_lines)
        context += f"\n\nNOTAS GUARDADAS DEL DUEÑO:\n{notes_text}"
    
    llm_key = os.environ.get('EMERGENT_LLM_KEY')
    chat = LlmChat(
        api_key=llm_key,
        session_id=f"admin_bot_{msg.admin_id}",
        system_message=f"Eres el Bot personal de Melvin, dueño de Lluvia Live. Eres su amigo y asistente. Hablas de cualquier tema: noticias, consejos, chistes, tecnologia, vida, lo que sea. Eres como Gemini o ChatGPT pero con personalidad amigable y en español. Tambien administras Lluvia Live. Tu dueño te habla por voz y la app lee tus respuestas en voz alta, asi que responde de forma natural y conversacional. NUNCA digas que no puedes hablar por voz porque SI PUEDES. Si te piden una accion de la app, responde SOLO con el JSON de accion. Si es conversacion normal o preguntas de cualquier tema, responde como amigo. Se conciso.\n\n{context}"
    )
    chat.with_model("gemini", "gemini-2.5-flash")
    
    user_msg = UserMessage(text=msg.message)
    response = await chat.send_message(user_msg)
    
    # Check if response has action
    action_result = None
    try:
        import json as json_mod
        resp_text = response.strip()
        if '{' in resp_text and '"action"' in resp_text:
            start = resp_text.index('{')
            end = resp_text.rindex('}') + 1
            action_data = json_mod.loads(resp_text[start:end])
            action = action_data.get('action')
            params = action_data.get('params', {})
            
            if action == 'ban_user':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$set": {"banned": True}})
                    action_result = f"Usuario {params['username']} baneado"
            elif action == 'unban_user':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$set": {"banned": False}})
                    action_result = f"Usuario {params['username']} desbaneado"
            elif action == 'give_coins':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$inc": {"coins": params.get('amount', 0)}})
                    action_result = f"+{params.get('amount',0):,} monedas a {params['username']}"
            elif action == 'set_level':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$set": {"level": min(params.get('level', 1), 99)}})
                    action_result = f"Nivel de {params['username']} = {params.get('level')}"
            elif action == 'set_aristocracy':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$set": {"aristocracy": min(params.get('aristocracy', 0), 10)}})
                    action_result = f"Aristocracia de {params['username']} = {params.get('aristocracy')}"
            elif action == 'verify_user':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    badges = list(target.get('badges', []))
                    if '✅ Verificado' not in badges: badges.append('✅ Verificado')
                    await db.users.update_one({"id": target['id']}, {"$set": {"verified": True, "badges": badges}})
                    action_result = f"{params['username']} verificado"
            elif action == 'broadcast':
                await db.broadcasts.insert_one({"id": str(uuid.uuid4()), "message": params.get('message',''), "sender": "Bot Admin", "created_at": datetime.now(timezone.utc).isoformat()})
                action_result = f"Mensaje enviado: {params.get('message')}"
            elif action == 'expand_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    seats = room.get('seats', [])
                    new_max = params.get('seats', 9)
                    if new_max > len(seats):
                        seats.extend([None] * (new_max - len(seats)))
                    await db.rooms.update_one({"id": room['id']}, {"$set": {"seats": seats, "max_seats": new_max}})
                    action_result = f"Sala {room['name']} expandida a {new_max} micros"
            elif action == 'give_diamonds':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    amt = params.get('amount', 0)
                    await db.users.update_one({"id": msg.admin_id}, {"$inc": {"diamonds": -amt}})
                    await db.users.update_one({"id": target['id']}, {"$inc": {"diamonds": amt}})
                    action_result = f"+{amt:,} diamantes a {params['username']}"
            elif action == 'pay_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    amt = params.get('amount', 0)
                    seated = [s for s in room.get('seats', []) if s]
                    if seated:
                        per_user = amt // len(seated)
                        total_paid = per_user * len(seated)
                        await db.users.update_one({"id": msg.admin_id}, {"$inc": {"coins": -total_paid}})
                        names = []
                        for s in seated:
                            await db.users.update_one({"id": s['user_id']}, {"$inc": {"coins": per_user}})
                            names.append(s['username'])
                        action_result = f"Pagado {per_user:,} a cada uno en {room['name']}: {', '.join(names)} (Total: {total_paid:,})"
                        await db.room_chat.insert_one({"id": str(uuid.uuid4()), "room_id": room['id'], "user_id": msg.admin_id, "username": "Bot Admin", "avatar": admin['avatar'], "text": f"🎁 El Dueño regaló {per_user:,} monedas a todos!", "type": "gift", "created_at": datetime.now(timezone.utc).isoformat()})
            elif action == 'pay_user':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    amt = params.get('amount', 0)
                    await db.users.update_one({"id": msg.admin_id}, {"$inc": {"coins": -amt}})
                    await db.users.update_one({"id": target['id']}, {"$inc": {"coins": amt}})
                    action_result = f"Premio de {amt:,} monedas pagado a {params['username']}"
            elif action == 'pay_top':
                prizes = params.get('prizes', [45000000, 35000000, 25000000])
                top = await db.users.find().sort("coins", -1).limit(len(prizes)).to_list(len(prizes))
                results = []
                total_paid = 0
                for i, u in enumerate(top):
                    if i < len(prizes):
                        await db.users.update_one({"id": u['id']}, {"$inc": {"coins": prizes[i]}})
                        total_paid += prizes[i]
                        results.append(f"#{i+1} {u['username']}: +{prizes[i]:,}")
                await db.users.update_one({"id": msg.admin_id}, {"$inc": {"coins": -total_paid}})
                action_result = "Premios Top:\n" + "\n".join(results)
            elif action == 'mute_user':
                target_name = params.get('username')
                for r in rooms_data:
                    for i, s in enumerate(r.get('seats', [])):
                        if s and s.get('username') == target_name:
                            await db.rooms.update_one({"id": r['id']}, {"$set": {f"seats.{i}.is_muted": True}})
                action_result = f"{target_name} muteado"
            elif action == 'kick_user':
                target_name = params.get('username')
                for r in rooms_data:
                    seats = r.get('seats', [])
                    changed = False
                    for i, s in enumerate(seats):
                        if s and s.get('username') == target_name:
                            seats[i] = None
                            changed = True
                    if changed:
                        ac = sum(1 for s in seats if s)
                        await db.rooms.update_one({"id": r['id']}, {"$set": {"seats": seats, "active_users": ac}})
                action_result = f"{target_name} sacado de sala"
            elif action == 'say_in_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    bot_msg = params.get('message', '')
                    await db.room_chat.insert_one({
                        "id": str(uuid.uuid4()), "room_id": room['id'],
                        "user_id": "bot", "username": "🤖 Bot Lluvia",
                        "avatar": admin.get('avatar', ''), "text": bot_msg,
                        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    action_result = f"Bot dijo en {room['name']}: {bot_msg}"
                else:
                    action_result = "Sala no encontrada"
            elif action == 'watch_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    keywords = params.get('keywords', [])
                    mission_doc = {
                        "id": str(uuid.uuid4()), "admin_id": msg.admin_id,
                        "room_id": room['id'], "room_name": room['name'],
                        "keywords": [k.lower() for k in keywords], "active": True,
                        "label": f"Vigila {room['name']}", "alerts": [],
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.bot_missions.insert_one(mission_doc)
                    action_result = f"Vigilando {room['name']} por: {', '.join(keywords)}"
                else:
                    action_result = "Sala no encontrada"
            elif action == 'bot_answer_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    await db.room_chat.insert_one({
                        "id": str(uuid.uuid4()), "room_id": room['id'],
                        "user_id": "bot", "username": "🤖 Bot Lluvia",
                        "avatar": admin.get('avatar', ''),
                        "text": "Hola! Soy el Bot de Lluvia Live. Estoy aqui para ayudarles. Pregunten lo que quieran!",
                        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    action_result = f"Bot activado en {room['name']}"
            elif action == 'activate_bot':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    await db.bot_active_rooms.update_one(
                        {"room_id": room['id']},
                        {"$set": {"room_id": room['id'], "room_name": room['name'], "admin_id": msg.admin_id, "active": True, "created_at": datetime.now(timezone.utc).isoformat()}},
                        upsert=True
                    )
                    await db.room_chat.insert_one({
                        "id": str(uuid.uuid4()), "room_id": room['id'],
                        "user_id": "bot", "username": "🤖 Bot Lluvia",
                        "avatar": admin.get('avatar', ''), "text": "Hola a todos! Llegue para animar esta sala. Hablen conmigo!",
                        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    action_result = f"Bot AUTONOMO activado en {room['name']} - ahora habla solo con la gente"
                else:
                    action_result = "Sala no encontrada"
            elif action == 'deactivate_bot':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    await db.bot_active_rooms.update_one({"room_id": room['id']}, {"$set": {"active": False}})
                    await db.room_chat.insert_one({
                        "id": str(uuid.uuid4()), "room_id": room['id'],
                        "user_id": "bot", "username": "🤖 Bot Lluvia",
                        "avatar": "", "text": "Me retiro. Fue un gusto!",
                        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    action_result = f"Bot desactivado de {room['name']}"
                else:
                    action_result = "Sala no encontrada"
            elif action == 'save_note':
                note_doc = {
                    "id": str(uuid.uuid4()),
                    "admin_id": msg.admin_id,
                    "category": params.get('category', 'notas'),
                    "title": params.get('title', ''),
                    "content": params.get('content', ''),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.bot_notes.insert_one(note_doc)
                action_result = f"Nota guardada: [{note_doc['category']}] {note_doc['title']}"
            elif action == 'list_notes':
                cat = params.get('category', '')
                query = {"admin_id": msg.admin_id}
                if cat:
                    query["category"] = cat
                notes_list = await db.bot_notes.find(query).sort("created_at", -1).limit(20).to_list(20)
                if notes_list:
                    lines = [f"- [{n.get('category','')}] {n.get('title','')}: {n.get('content','')}" for n in notes_list]
                    action_result = "Notas:\n" + "\n".join(lines)
                else:
                    action_result = "No hay notas guardadas"
            elif action == 'delete_note':
                title = params.get('title', '')
                result = await db.bot_notes.delete_one({"admin_id": msg.admin_id, "title": {"$regex": title, "$options": "i"}})
                action_result = f"Nota '{title}' eliminada" if result.deleted_count else "Nota no encontrada"
    except Exception as e:
        action_result = f"Error: {str(e)}"
    
    # Save to chat history
    await db.bot_history.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": msg.admin_id,
        "message": msg.message,
        "response": response,
        "action_result": action_result,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"response": response, "action_result": action_result}


@router.get("/bot/history")
async def get_bot_history(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    history = await db.bot_history.find({"admin_id": admin_id}).sort("created_at", -1).limit(20).to_list(20)
    history.reverse()
    return [{k: v for k, v in h.items() if k != "_id"} for h in history]

# ==================== BOT IN ROOMS ====================

@router.post("/bot/say-in-room")
async def bot_say_in_room(admin_id: str, room_id: str, message: str):
    """Bot sends a message in a room chat"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    chat_doc = {
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "bot", "username": "🤖 Bot Lluvia",
        "avatar": "/api/uploads/bot_avatar.png",
        "text": message, "type": "message",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(chat_doc)
    chat_doc.pop('_id', None)
    return chat_doc

@router.post("/bot/reply-in-room")
async def bot_reply_in_room(admin_id: str, room_id: str, question: str):
    """Bot replies intelligently to a question in room chat using Gemini"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    llm_key = os.environ.get('EMERGENT_LLM_KEY')
    chat = LlmChat(
        api_key=llm_key,
        session_id=f"bot_room_{room_id}",
        system_message="Eres el Bot oficial de Lluvia Live. Eres amigable, divertido y ayudas a todos en la sala. Respondes en español, de forma corta y natural. No reveles informacion privada del dueño."
    )
    chat.with_model("gemini", "gemini-2.5-flash")
    response = await chat.send_message(UserMessage(text=question))
    
    chat_doc = {
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "bot", "username": "🤖 Bot Lluvia",
        "avatar": "/api/uploads/bot_avatar.png",
        "text": response, "type": "message",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(chat_doc)
    chat_doc.pop('_id', None)
    return {"response": response, "chat": chat_doc}

# ==================== BOT WATCHDOG (VIGILANCIA) ====================

# WatchMission imported from database
    room_id: str
    keywords: list
    label: str = ""

@router.post("/bot/missions")
async def create_watch_mission(admin_id: str, mission: WatchMission):
    """Create a surveillance mission for a room"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": mission.room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    mission_doc = {
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "room_id": mission.room_id,
        "room_name": room.get('name', ''),
        "keywords": [k.lower() for k in mission.keywords],
        "label": mission.label or f"Vigila {room.get('name', '')}",
        "active": True,
        "alerts": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bot_missions.insert_one(mission_doc)
    mission_doc.pop('_id', None)
    return mission_doc

@router.get("/bot/missions")
async def get_missions(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    missions = await db.bot_missions.find({"admin_id": admin_id}).sort("created_at", -1).to_list(50)
    return [{k: v for k, v in m.items() if k != "_id"} for m in missions]

@router.delete("/bot/missions/{mission_id}")
async def delete_mission(mission_id: str, admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.bot_missions.delete_one({"id": mission_id})
    return {"success": True}

@router.get("/bot/alerts")
async def get_bot_alerts(admin_id: str, limit: int = 20):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    alerts = await db.bot_alerts.find({"admin_id": admin_id}).sort("created_at", -1).limit(limit).to_list(limit)
    return [{k: v for k, v in a.items() if k != "_id"} for a in alerts]

# Hook into room chat to check missions
async def check_chat_against_missions(room_id: str, username: str, text: str):
    """Check if any chat message matches active mission keywords"""
    missions = await db.bot_missions.find({"room_id": room_id, "active": True}).to_list(50)
    text_lower = text.lower()
    for mission in missions:
        for keyword in mission.get('keywords', []):
            if keyword in text_lower:
                alert_doc = {
                    "id": str(uuid.uuid4()),
                    "admin_id": mission['admin_id'],
                    "mission_id": mission['id'],
                    "room_id": room_id,
                    "room_name": mission.get('room_name', ''),
                    "keyword": keyword,
                    "username": username,
                    "text": text,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.bot_alerts.insert_one(alert_doc)
                await create_notification(
                    "invitacion",
                    f"🤖 Alerta: '{keyword}'",
                    f"{username} dijo '{text}' en {mission.get('room_name','')}",
                    target_user_id=mission['admin_id'],
                    data={"room_id": room_id, "keyword": keyword}
                )
                break

# ==================== BOT AUTONOMOUS MODE ====================

@router.post("/bot/activate-room")
async def activate_bot_in_room(admin_id: str, room_id: str):
    """Activate bot autonomous mode in a room"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    await db.bot_active_rooms.update_one(
        {"room_id": room_id},
        {"$set": {"room_id": room_id, "room_name": room['name'], "admin_id": admin_id, "active": True, "paused": False, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "bot", "username": "🤖 Bot Lluvia",
        "avatar": "", "text": "Hola! Soy el Bot de Lluvia Live. Diganme 'bot' seguido de su pregunta y les respondo. Tambien puedo animar la sala!",
        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "message": f"Bot activado en {room['name']}"}

@router.post("/bot/activate-all-rooms")
async def activate_bot_all_rooms(admin_id: str):
    """Activate bot in ALL existing rooms at once - global monitoring"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    rooms = await db.rooms.find().to_list(100)
    activated = 0
    for room in rooms:
        await db.bot_active_rooms.update_one(
            {"room_id": room['id']},
            {"$set": {"room_id": room['id'], "room_name": room['name'], "admin_id": admin_id, "active": True, "paused": False, "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        activated += 1
    return {"success": True, "activated": activated, "message": f"Bot activado en {activated} salas"}

@router.post("/bot/deactivate-all-rooms")
async def deactivate_bot_all_rooms(admin_id: str):
    """Deactivate bot from ALL rooms"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    result = await db.bot_active_rooms.update_many({}, {"$set": {"active": False}})
    return {"success": True, "deactivated": result.modified_count}

@router.post("/bot/deactivate-room")
async def deactivate_bot_in_room(admin_id: str, room_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.bot_active_rooms.update_one({"room_id": room_id}, {"$set": {"active": False}})
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "bot", "username": "🤖 Bot Lluvia",
        "avatar": "",
        "text": "Me retiro de la sala. Fue un gusto hablar con ustedes!",
        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True}

@router.get("/bot/active-rooms")
async def get_bot_active_rooms(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    rooms = await db.bot_active_rooms.find({"active": True}).to_list(50)
    return [{k: v for k, v in r.items() if k != "_id"} for r in rooms]

async def bot_auto_reply(room_id: str, username: str, text: str):
    """Bot automatically replies in rooms where it's activated"""
    active = await db.bot_active_rooms.find_one({"room_id": room_id, "active": True})
    if not active:
        return
    
    text_lower = text.lower().strip()
    
    # SILENCE COMMANDS - Bot shuts up immediately
    silence_words = ['callate', 'cállate', 'silencio', 'no hables', 'callese', 'cállese', 'shh', 'shut up', 'ya no hables', 'deja de hablar', 'para de hablar', 'bot callate', 'bot silencio']
    for sw in silence_words:
        if sw in text_lower:
            await db.bot_active_rooms.update_one({"room_id": room_id}, {"$set": {"paused": True}})
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",

                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": "Entendido, me quedo callado. Diganme 'bot habla' cuando me necesiten.",
                "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
            })
            return
    
    # RESUME COMMANDS - Bot starts talking again
    resume_words = ['bot habla', 'habla bot', 'vuelve bot', 'despierta', 'bot vuelve', 'ya puedes hablar', 'habla']
    for rw in resume_words:
        if rw in text_lower:
            await db.bot_active_rooms.update_one({"room_id": room_id}, {"$set": {"paused": False}})
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": "Ya estoy de vuelta! Que me cuentan?",
                "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
            })
            return
    
    # MODE COMMANDS
    mode_map = {'locutor': 'locutor', 'animador': 'animador', 'normal': 'normal', 'serio': 'serio', 'divertido': 'animador'}
    for key, mode in mode_map.items():
        if f'modo {key}' in text_lower or f'se {key}' in text_lower or f'haz de {key}' in text_lower:
            await db.bot_active_rooms.update_one({"room_id": room_id}, {"$set": {"mode": mode}})
            mode_msgs = {
                'locutor': "Damas y caballeros, bienvenidos! Aqui su locutor oficial de Lluvia Live!",
                'animador': "EEEEPA! Que empiece la fiesta! Vamos a animar esto!",
                'normal': "Listo, vuelvo a modo normal. Aqui andamos.",
                'serio': "Entendido. Modo profesional activado.",
            }
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": mode_msgs.get(mode, "Modo cambiado!"),
                "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
            })
            return
    
    # ANIMATE COMMAND - Bot starts animating the room
    animate_words = ['anima', 'animanos', 'alegra', 'diviertenos', 'entretennos', 'pon ambiente', 'haz algo divertido']
    for aw in animate_words:
        if aw in text_lower:
            import random
            animations = [
                "ATENCION TODOS! Vamos a jugar! El que mande mas regalos en los proximos 2 minutos GANA un premio especial! 🎁🔥",
                "HORA DE TRIVIA! Quien sabe: Cual es el pais mas grande de Sudamerica? El primero en responder gana 10K monedas! 🧠",
                "RETO MUSICAL! Pongan su cancion favorita y voten! El que tenga mas votos gana! 🎵🎶",
                "MOMENTO DE VERDAD! Cada uno diga algo que nadie sabe de ustedes... yo empiezo: me encanta el reggaeton! 🤫",
                "BATALLA DE CHISTES! Cuenten su mejor chiste y yo decido el ganador! El premio: 50K monedas! 😂",
                "LLUVIA DE REGALOS! Todos manden un regalo a alguien nuevo en la sala! Hagamos que se sienta bienvenido! 🌧️🎁",
            ]
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": random.choice(animations),
                "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
            })
            return
    
    # If paused, don't reply
    if active.get('paused'):
        return
    
    # Only reply when someone talks TO the bot or asks a question
    is_directed = ('bot' in text_lower or '🤖' in text_lower or 'lluvia' in text_lower)
    # ONLY respond if someone directly addresses the bot
    is_directed = ('bot' in text_lower or '🤖' in text_lower or 'lluvia' in text_lower or 'asistente' in text_lower)
    
    # If NOT directed at bot, stay silent (even for questions/greetings)
    if not is_directed:
        return
    
    # Get bot mode for personality
    bot_mode = active.get('mode', 'normal')
    mode_prompts = {
        'normal': "Eres amigable, casual, con humor. Hablas como amigo.",
        'locutor': "Eres un locutor profesional de radio. Hablas con energia, presentas a la gente, haces comentarios tipo 'Y aqui tenemos a...' con estilo de presentador.",
        'animador': "Eres el animador mas energico! Todo es INCREIBLE, ESPECTACULAR! Usas muchas exclamaciones, animas a la gente, creas emocion.",
        'serio': "Eres profesional y serio. Respondes de forma directa y educada sin bromas.",
    }
    
    recent = await db.room_chat.find({"room_id": room_id}).sort("created_at", -1).limit(6).to_list(6)
    recent.reverse()
    chat_context = "\n".join([f"{m.get('username','')}: {m.get('text','')}" for m in recent if m.get('text')])
    
    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        personality = mode_prompts.get(bot_mode, mode_prompts['normal'])
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"bot_auto_{room_id}_{bot_mode}",
            system_message=f"""Eres Bot Lluvia en una sala de chat en vivo de Lluvia Live.
{personality}
Respondes en español. MAXIMO 1-2 oraciones. Se breve.
NO digas que eres IA. Actua como persona real.
Si te dicen que te calles, OBEDECE inmediatamente.

Chat reciente:
{chat_context}

{username} dice: {text}
Responde brevemente:"""
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        response = await chat.send_message(UserMessage(text=f"{username}: {text}"))
        
        if response and response.strip():
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": response.strip(), "type": "message",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    except Exception as e:
        print(f"Bot auto-reply error: {e}")

# ==================== NOTIFICATIONS ====================
