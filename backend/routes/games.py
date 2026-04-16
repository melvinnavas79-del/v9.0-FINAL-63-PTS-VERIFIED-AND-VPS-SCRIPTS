"""
Game routes: All mini-games, PK battles, slot machine, ruleta, etc.
"""
from fastapi import APIRouter, HTTPException
from database import db, GenericPlay, GameBet, PKBattleStart, RPSBet, TriviaBet, CardBet, uuid, datetime, timezone, timedelta, create_notification
import random

router = APIRouter()

@router.post("/games/play")
async def play_generic(play: GenericPlay):
    """Play Generic."""
    user = await db.users.find_one({"id": play.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get('coins', 0) < play.bet:
        raise HTTPException(status_code=400, detail="Monedas insuficientes")
    
    import random
    
    if play.game == 'cofre':
        # Cofres: 35% chance to win 1.5x-3x the cost
        await db.users.update_one({"id": play.user_id}, {"$inc": {"coins": -play.bet}})
        won = random.random() < 0.35
        if won:
            multiplier = random.choice([1.5, 2.0, 2.5, 3.0])
            prize = int(play.bet * multiplier)
            await db.users.update_one({"id": play.user_id}, {"$inc": {"coins": prize}})
            updated = await db.users.find_one({"id": play.user_id})
            return {"won": True, "prize": prize, "multiplier": multiplier, "new_balance": updated['coins']}
        updated = await db.users.find_one({"id": play.user_id})
        return {"won": False, "prize": 0, "new_balance": updated['coins']}
    
    elif play.game in ('ruleta', 'dados', 'rps', 'slots', 'trivia', 'carta',
                       'ludo', 'yacaro', 'carreras', 'pool', 'domino', 'monster', 'lion_tiger'):
        await db.users.update_one({"id": play.user_id}, {"$inc": {"coins": -play.bet}})
        import random
        
        game_data = {}
        
        if play.game == 'slots':
            won = random.random() < 0.25
            mult = random.choice([3, 5, 10]) if won else 0
            symbols = ['🍒','🍋','🔔','💎','7️⃣','🍀']
            reels = [[random.choice(symbols) for _ in range(3)] for _ in range(3)]
            if won: reels[1] = [reels[1][0]] * 3  # Force match on middle row
            game_data = {"reels": reels}
        elif play.game == 'ludo':
            # Ludo: Roll dice, move pieces. Higher bet = more rounds
            dice = [random.randint(1, 6) for _ in range(4)]
            player_pos = sum(dice[:2])
            bot_pos = sum(dice[2:])
            won = player_pos > bot_pos
            mult = random.choice([2, 3]) if won else 0
            game_data = {"dice": dice, "player_score": player_pos, "bot_score": bot_pos, "rounds": 4}
        elif play.game == 'yacaro':
            # Greedy dice: Roll 6 dice, score combos
            dice = [random.randint(1, 6) for _ in range(6)]
            ones = dice.count(1) * 100
            fives = dice.count(5) * 50
            triples = 0
            for d in range(1, 7):
                if dice.count(d) >= 3:
                    triples = d * 100 if d != 1 else 1000
            score = ones + fives + triples
            won = score >= 350
            mult = 2 if score >= 350 else (3 if score >= 600 else (5 if score >= 1000 else 0))
            if not won: mult = 0
            game_data = {"dice": dice, "score": score, "ones": ones, "fives": fives, "triples": triples}
        elif play.game == 'carreras':
            # Car racing: 5 cars race, user bets on car 1
            cars = [random.randint(60, 100) for _ in range(5)]
            car_names = ['Rojo', 'Azul', 'Verde', 'Dorado', 'Negro']
            winner = cars.index(max(cars))
            user_car = random.randint(0, 4)
            won = user_car == winner
            mult = 5 if won else 0
            game_data = {"cars": [{"name": car_names[i], "speed": cars[i]} for i in range(5)], "user_car": user_car, "winner": winner}
        elif play.game == 'pool':
            # Pool: Angle + power = hit accuracy. Sink balls to win
            balls_sunk = random.randint(0, 7)
            opponent_sunk = random.randint(0, 7)
            won = balls_sunk > opponent_sunk
            mult = 2 if won else 0
            game_data = {"player_sunk": balls_sunk, "opponent_sunk": opponent_sunk, "total_balls": 7}
        elif play.game == 'domino':
            # Domino: Score comparison
            player_hand = [[random.randint(0, 6), random.randint(0, 6)] for _ in range(7)]
            player_score = sum(a + b for a, b in player_hand)
            bot_score = random.randint(20, 60)
            won = player_score < bot_score  # Lower score wins in domino
            mult = 2 if won else 0
            game_data = {"hand": player_hand, "player_total": player_score, "bot_total": bot_score}
        elif play.game == 'monster':
            # Monster battle: Stats + luck
            monsters = ['Dragon', 'Fenix', 'Kraken', 'Golem', 'Hidra', 'Quimera']
            player_monster = random.choice(monsters)
            enemy_monster = random.choice(monsters)
            p_power = random.randint(50, 100)
            e_power = random.randint(50, 100)
            won = p_power > e_power
            mult = random.choice([2, 3, 4]) if won else 0
            game_data = {"player": {"name": player_monster, "power": p_power}, "enemy": {"name": enemy_monster, "power": e_power}}
        else:
            won = random.random() < 0.4
            mult = random.choice([2, 3, 5]) if won else 0
        
        if won and mult > 0:
            prize = play.bet * mult
            await db.users.update_one({"id": play.user_id}, {"$inc": {"coins": prize}})
            updated = await db.users.find_one({"id": play.user_id})
            await db.event_requests.update_one(
                {"user_id": play.user_id, "status": "approved", "event_type": {"$regex": "^king"}},
                {"$inc": {"game_progress": play.bet}}
            )
            return {"won": True, "prize": prize, "multiplier": mult, "new_balance": updated['coins'], "game_data": game_data}
        updated = await db.users.find_one({"id": play.user_id})
        await db.event_requests.update_one(
            {"user_id": play.user_id, "status": "approved", "event_type": {"$regex": "^king"}},
            {"$inc": {"game_progress": play.bet}}
        )
        return {"won": False, "prize": 0, "new_balance": updated['coins'], "game_data": game_data}
    
    raise HTTPException(status_code=400, detail="Juego no válido")

# PKBattleStart imported from database
    room_id: str
    challenger_id: str
    opponent_id: str
    bet_amount: int

@router.post("/games/pk-battle")
async def start_pk_battle(battle: PKBattleStart):
    """PK Battle: 2 users battle with gifts. Higher total gifts wins the opponent's bet."""
    challenger = await db.users.find_one({"id": battle.challenger_id})
    opponent = await db.users.find_one({"id": battle.opponent_id})
    if not challenger or not opponent:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if challenger.get('coins', 0) < battle.bet_amount:
        raise HTTPException(status_code=400, detail="Monedas insuficientes (retador)")
    if opponent.get('coins', 0) < battle.bet_amount:
        raise HTTPException(status_code=400, detail="El oponente no tiene suficientes monedas")
    
    # Deduct bets
    await db.users.update_one({"id": battle.challenger_id}, {"$inc": {"coins": -battle.bet_amount}})
    await db.users.update_one({"id": battle.opponent_id}, {"$inc": {"coins": -battle.bet_amount}})
    
    battle_doc = {
        "id": str(uuid.uuid4()),
        "room_id": battle.room_id,
        "challenger_id": battle.challenger_id,
        "challenger_name": challenger['username'],
        "opponent_id": battle.opponent_id,
        "opponent_name": opponent['username'],
        "bet_amount": battle.bet_amount,
        "challenger_gifts": 0,
        "opponent_gifts": 0,
        "status": "active",
        "winner": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=3)).isoformat()
    }
    await db.pk_battles.insert_one(battle_doc)
    battle_doc.pop('_id', None)
    
    await db.room_chats.insert_one({
        "id": str(uuid.uuid4()), "room_id": battle.room_id,
        "type": "event",
        "text": f"⚔️ BATALLA PK! {challenger['username']} vs {opponent['username']} - Apuesta: {battle.bet_amount:,} monedas!",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "battle": battle_doc}

@router.get("/games/pk-battle/{room_id}")
async def get_active_pk(room_id: str):
    """Get Active Pk."""
    battle = await db.pk_battles.find_one({"room_id": room_id, "status": "active"})
    if not battle:
        return None
    battle.pop('_id', None)
    return battle

@router.post("/games/pk-battle/{battle_id}/gift")
async def pk_gift(battle_id: str, user_id: str, amount: int):
    """Send a gift during PK battle. Adds to your score."""
    battle = await db.pk_battles.find_one({"id": battle_id, "status": "active"})
    if not battle:
        raise HTTPException(status_code=404, detail="Batalla no encontrada o ya termino")
    
    user = await db.users.find_one({"id": user_id})
    if not user or user.get('coins', 0) < amount:
        raise HTTPException(status_code=400, detail="Monedas insuficientes")
    
    await db.users.update_one({"id": user_id}, {"$inc": {"coins": -amount}})
    
    if user_id == battle['challenger_id']:
        await db.pk_battles.update_one({"id": battle_id}, {"$inc": {"challenger_gifts": amount}})
    elif user_id == battle['opponent_id']:
        await db.pk_battles.update_one({"id": battle_id}, {"$inc": {"opponent_gifts": amount}})
    
    updated = await db.pk_battles.find_one({"id": battle_id})
    updated.pop('_id', None)
    return {"success": True, "battle": updated}

@router.post("/games/pk-battle/{battle_id}/end")
async def end_pk_battle(battle_id: str):
    """End PK battle. Winner gets both bets + loser's gifts."""
    battle = await db.pk_battles.find_one({"id": battle_id, "status": "active"})
    if not battle:
        raise HTTPException(status_code=404, detail="Batalla no encontrada")
    
    c_gifts = battle.get('challenger_gifts', 0)
    o_gifts = battle.get('opponent_gifts', 0)
    total_pot = battle['bet_amount'] * 2
    
    if c_gifts > o_gifts:
        winner_id = battle['challenger_id']
        winner_name = battle['challenger_name']
    elif o_gifts > c_gifts:
        winner_id = battle['opponent_id']
        winner_name = battle['opponent_name']
    else:
        # Tie: return bets
        await db.users.update_one({"id": battle['challenger_id']}, {"$inc": {"coins": battle['bet_amount']}})
        await db.users.update_one({"id": battle['opponent_id']}, {"$inc": {"coins": battle['bet_amount']}})
        await db.pk_battles.update_one({"id": battle_id}, {"$set": {"status": "tie"}})
        return {"success": True, "result": "tie", "returned": battle['bet_amount']}
    
    await db.users.update_one({"id": winner_id}, {"$inc": {"coins": total_pot}})
    await db.pk_battles.update_one({"id": battle_id}, {"$set": {"status": "finished", "winner": winner_id}})
    
    await db.room_chats.insert_one({
        "id": str(uuid.uuid4()), "room_id": battle['room_id'],
        "type": "event",
        "text": f"⚔️ {winner_name} GANA LA BATALLA PK! +{total_pot:,} monedas!",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "winner": winner_name, "prize": total_pot}


@router.post("/games/ruleta")
async def play_ruleta(bet: GameBet):
    """Play Ruleta."""
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    prizes = [
        {"multiplier": 0, "label": "Sin suerte", "chance": 30},
        {"multiplier": 1.5, "label": "x1.5", "chance": 25},
        {"multiplier": 2, "label": "x2", "chance": 20},
        {"multiplier": 3, "label": "x3", "chance": 15},
        {"multiplier": 5, "label": "x5", "chance": 7},
        {"multiplier": 10, "label": "JACKPOT x10", "chance": 3},
    ]
    
    roll = random.randint(1, 100)
    cumulative = 0
    selected = prizes[0]
    for p in prizes:
        cumulative += p["chance"]
        if roll <= cumulative:
            selected = p
            break
    
    winnings = int(bet.bet_amount * selected["multiplier"])
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "result": selected["label"],
        "multiplier": selected["multiplier"],
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

@router.post("/games/dados")
async def play_dados(bet: GameBet):
    """Play Dados."""
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    dice1 = random.randint(1, 6)
    dice2 = random.randint(1, 6)
    total = dice1 + dice2
    
    if total >= 10:
        multiplier = 3
        result = "GRAN VICTORIA"
    elif total >= 7:
        multiplier = 2
        result = "Victoria"
    elif total == 7:
        multiplier = 1.5
        result = "Empate"
    else:
        multiplier = 0
        result = "Perdiste"
    
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "dice1": dice1,
        "dice2": dice2,
        "total": total,
        "result": result,
        "multiplier": multiplier,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

@router.post("/games/piedra-papel-tijera")
async def play_rps(bet: RPSBet):
    """Play Rps."""
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    choices = ["piedra", "papel", "tijera"]
    if bet.choice not in choices:
        raise HTTPException(status_code=400, detail="Opción inválida")
    
    computer = random.choice(choices)
    
    if bet.choice == computer:
        result = "empate"
        multiplier = 1
    elif (bet.choice == "piedra" and computer == "tijera") or \
         (bet.choice == "papel" and computer == "piedra") or \
         (bet.choice == "tijera" and computer == "papel"):
        result = "ganaste"
        multiplier = 2
    else:
        result = "perdiste"
        multiplier = 0
    
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "player_choice": bet.choice,
        "computer_choice": computer,
        "result": result,
        "multiplier": multiplier,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

@router.get("/games/trivia/question")
async def get_trivia_question():
    """Get Trivia Question."""
    q = random.choice(TRIVIA_QUESTIONS)
    return {
        "question": q["question"],
        "options": q["options"],
        "question_id": TRIVIA_QUESTIONS.index(q)
    }

@router.post("/games/trivia")
async def play_trivia(bet: TriviaBet):
    """Play Trivia."""
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    q = random.choice(TRIVIA_QUESTIONS)
    correct = q["correct"] == bet.answer_index
    
    multiplier = 3 if correct else 0
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "correct": correct,
        "correct_answer": q["options"][q["correct"]],
        "result": "Correcto x3" if correct else "Incorrecto",
        "multiplier": multiplier,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

@router.post("/games/carta-mayor")
async def play_carta_mayor(bet: CardBet):
    """Play Carta Mayor."""
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")
    if bet.guess not in ["mayor", "menor"]:
        raise HTTPException(status_code=400, detail="Opción inválida")

    cards = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    card_values = {"A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13}
    
    card1 = random.choice(cards)
    card2 = random.choice(cards)
    
    val1 = card_values[card1]
    val2 = card_values[card2]
    
    if val1 == val2:
        correct = False
        result = "Empate - Pierdes"
    elif bet.guess == "mayor":
        correct = val2 > val1
    else:
        correct = val2 < val1
    
    multiplier = 2 if correct else 0
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "card1": card1,
        "card2": card2,
        "guess": bet.guess,
        "correct": correct,
        "result": "Ganaste x2" if correct else "Perdiste",
        "multiplier": multiplier,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

# ==================== SLOT MACHINE 777 ====================

@router.post("/games/slot-machine")
async def play_slot_machine(bet: GameBet):
    """Play Slot Machine."""
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    symbols = ['7️⃣', '💎', '🍒', '🔔', '⭐', '🍋', '🍊', '🃏']
    weights = [5, 8, 15, 12, 10, 20, 20, 10]
    
    reel1 = random.choices(symbols, weights=weights, k=1)[0]
    reel2 = random.choices(symbols, weights=weights, k=1)[0]
    reel3 = random.choices(symbols, weights=weights, k=1)[0]
    
    combo = f"{reel1}{reel2}{reel3}"
    
    payouts = {
        '7️⃣7️⃣7️⃣': (50, 'MEGA JACKPOT 777'),
        '💎💎💎': (25, 'DIAMOND RUSH'),
        '🍒🍒🍒': (10, 'CHERRY BLAST'),
        '🔔🔔🔔': (8, 'BELL RINGER'),
        '⭐⭐⭐': (15, 'STAR POWER'),
        '🍋🍋🍋': (5, 'LEMON DROP'),
        '🍊🍊🍊': (5, 'ORANGE CRUSH'),
        '🃏🃏🃏': (20, 'WILD CARD'),
    }
    
    multiplier = 0
    jackpot_name = None
    
    if combo in payouts:
        multiplier, jackpot_name = payouts[combo]
    elif reel1 == reel2 or reel2 == reel3 or reel1 == reel3:
        multiplier = 2
        jackpot_name = "PAR"
    
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one({"id": bet.user_id}, {"$inc": {"coins": net}})
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "reels": [reel1, reel2, reel3],
        "multiplier": multiplier,
        "jackpot_name": jackpot_name,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }


# ==================== LION VS TIGER (Dedicated) ====================

@router.post("/games/lion-tiger/bet")
async def lion_tiger_bet(user_id: str, amount: int):
    """Deduct bet amount from user balance. Returns new balance."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get('coins', 0) < amount:
        raise HTTPException(status_code=400, detail="Monedas insuficientes")
    await db.users.update_one({"id": user_id}, {"$inc": {"coins": -amount}})
    updated = await db.users.find_one({"id": user_id})
    return {"success": True, "new_balance": updated['coins']}

@router.post("/games/lion-tiger/win")
async def lion_tiger_win(user_id: str, amount: int):
    """Add winnings to user balance. Returns new balance."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.users.update_one({"id": user_id}, {"$inc": {"coins": amount}})
    updated = await db.users.find_one({"id": user_id})
    return {"success": True, "new_balance": updated['coins']}
