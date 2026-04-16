# Lluvia Live - Product Requirements Document

## Original Problem Statement
Full-stack social audio streaming platform ("Lluvia Live") with:
- Audio Streaming Rooms via Agora.io (Mic/Speaker, auto-mute, no duplicate seats)
- Gamification: VIP Entrances, Aristocracy levels, CP (Couples) system, Clanes
- Economy: Coins, Diamonds, Stripe Payments, Treasure Chests, Coin rains
- Interactive Mini-games: Ludo, Lion vs Tiger, and other casino/betting style games
- Master Control Panel: Manage users, voices, prizes, configurations
- Autonomous AI Admin Bot: Global floating bot + in-room moderation, voice TTS/STT, session memory
- PWA, Android build script, iOS setup
- Brand: "Lluvia Live" with zero third-party/Emergent branding

## Tech Stack
- Frontend: React.js, TailwindCSS, JS viewport scaling for Android PWA
- Backend: FastAPI, Motor (Async MongoDB), Modular Routers
- Real-time Audio: Agora.io WebRTC
- AI Bot: Gemini via Emergent LLM Key
- Payments: Stripe
- Database: MongoDB

## Architecture
```
/app/backend/
  server.py          - Clean entry point
  database.py        - MongoDB, models, helpers
  routes/
    auth.py          - Register, Login, User profile, Ghost mode, Entry animations
    rooms.py         - Room CRUD, Seats, Chat, Photos, Agora tokens
    games.py         - All games, PK battles, Lion vs Tiger
    bot.py           - AI Bot, missions, monitoring
    events.py        - King/CP events, cashback
    admin.py         - Console, roles, config
    social.py        - Clanes, Parejas, Gifts, Sobres, Cofres
    store.py         - Stripe checkout
    notifications.py - Notification CRUD
/app/frontend/src/
  pages/             - RoomView, Dashboard, LoginPage, StorePage, etc.
  components/        - LionTigerGame, RoomGames, Animations, etc.
```

## What's Been Implemented
- Full auth system (register, login, case-insensitive)
- Audio rooms with Agora WebRTC (9 seats, auto-mute)
- Complete gamification (aristocracy, VIP levels, CP, clanes)
- Economy (coins, diamonds, gifts, sobres, cofres)
- 12 interactive mini-games including Lion vs Tiger casino
- AI Admin Bot with Gemini integration
- Event request/approval system (King, CP)
- Control Panel for admin management
- Stripe payment integration
- Notification system
- Android Studio build skeleton
- iOS project structure
- Comprehensive Pytest test suite

## Completed Fixes (Latest Session - Apr 16, 2026)
1. Entry Announcements: Role-based welcome messages ("Melvin, el dueño de Lluvia Live, acaba de ingresar")
2. Gift Deduction Bug: Fixed NameError (BIG_GIFTS undefined) in social.py
3. Lion vs Tiger Math: Verified x2/x5 payouts with separate bet/win endpoints
4. iOS Buttons: Salir (88x44px), Minimizar (44x44px) meet iOS touch requirements
5. Gift Float Animations: CSS @keyframes giftFloat on gift send
6. Audio Cleanup: audioElementRef cleanup on unmount/leave, owner leave clears music
7. Number Formatting: K/M/B abbreviations for coin displays
8. Tienda: Full-height scrollable panel (80vh), 6 store categories
9. Branding: All text is "Lluvia Live", no Emergent mentions

## Remaining Backlog
### P1
- TTS Voice Integration (Google Cloud/Azure) for natural bot voices
- More casino mini-games

### P2
- Enhanced StorePage with actual Stripe product catalog
- Push notifications
- More entry animations per aristocracy level
