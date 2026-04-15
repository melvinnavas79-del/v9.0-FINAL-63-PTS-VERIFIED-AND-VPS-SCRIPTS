# Lluvia Live - PRD

## Descripcion
App de streaming de audio en vivo con salas, juegos, economia de monedas, Bot IA.

## Arquitectura (v2.0 - Modular)
```
backend/
  server.py          (60 lineas) - Entry point, CORS, mounting
  database.py        (177 lineas) - MongoDB, models, helpers
  routes/
    auth.py          (107) - Login, registro, perfil, ghost mode, rankings
    rooms.py         (299) - CRUD salas, seats, chat, musica, Agora
    games.py         (538) - 12 juegos, PK battles
    bot.py           (682) - IA, auto-reply, misiones, monitoreo
    events.py        (430) - King/CP, cashback, solicitudes
    admin.py         (436) - Consola, roles, config, premios
    social.py        (405) - Clanes, parejas, regalos, cofres, sobres
    store.py         (113) - Tienda, Stripe
    notifications.py (104) - Notificaciones, preferencias
```
Total: 119 rutas en 10 archivos (antes: 3460 lineas en 1 archivo)

## Credenciales
- Melvin_Live / test123 - Role: dueño
