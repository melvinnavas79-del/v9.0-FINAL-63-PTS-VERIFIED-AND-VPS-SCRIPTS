# Lluvia Live - PRD

## Descripcion
App de streaming de audio en vivo con salas, juegos, economia, Bot IA.

## Arquitectura (v2.0 - Modular, Documentada, Testeada)
```
backend/
  server.py          (60 lineas)  - Entry point
  database.py        (195 lineas) - MongoDB, 14 models, helpers (documented)
  routes/
    auth.py          (107) - Login, registro, perfil, ghost, rankings
    rooms.py         (299) - Salas, seats, chat, musica, Agora
    games.py         (538) - 12 juegos, PK battles
    bot.py           (690) - IA, auto-reply, misiones, monitoreo
    events.py        (445) - King/CP events, cashback
    admin.py         (470) - Consola, roles, config, stats
    social.py        (425) - Clanes, parejas, regalos, cofres
    store.py         (130) - Tienda, Stripe
    notifications.py (104) - Notificaciones
  tests/
    test_api.py      (290) - 42 tests automatizados (100% pass)
```

## Tests: 42 automatizados (pytest)
- TestAuth: 7 (register, login, search, rankings)
- TestRooms: 5 (CRUD, seats, chat)
- TestGames: 13 (11 game types + insufficient coins + parametrized)
- TestEvents: 5 (request, approve, cashback, history)
- TestBot: 3 (command, activate/deactivate all)
- TestAdmin: 4 (stats, users, config, permission check)
- TestSocial: 4 (clanes, gifts, sobres, cofres)
- TestNotifications: 1
- TestStore: 1

## Credenciales
- Melvin_Live / test123 - Role: dueño
