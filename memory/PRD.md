# Lluvia Live - Product Requirements Document

## Original Problem Statement
Full-stack social audio streaming platform ("Lluvia Live") with:
- Audio Streaming Rooms via Agora.io (Mic/Speaker, auto-mute, no duplicate seats)
- Gamification: VIP Entrances, Aristocracy levels, CP (Couples) system, Clanes
- Economy: Coins, Diamonds, Stripe Payments, Treasure Chests, Coin rains
- Interactive Mini-games: Ludo, Lion vs Tiger, and other casino/betting style games
- Master Control Panel: Manage users, voices, prizes, configurations
- Autonomous AI Admin Bot: Global floating bot + in-room moderation
- PWA, Android build script, iOS setup
- Brand: "Lluvia Live" with zero third-party branding
- Automatic Badge/Medal system (29 achievements across 7 categories)

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
    auth.py          - Register, Login, User profile, Entry animations
    rooms.py         - Room CRUD, Seats, Chat, Photos, Agora tokens
    games.py         - All games, PK battles, Lion vs Tiger
    bot.py           - AI Bot, missions, monitoring
    events.py        - King/CP events, cashback
    admin.py         - Console, roles, config
    social.py        - Clanes, Parejas, Gifts, Sobres, Cofres
    store.py         - Stripe checkout
    notifications.py - Notification CRUD
    badges.py        - Automatic badge/medal system (29 badges)
```

## What's Been Implemented (Complete)
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
- Android Studio build skeleton, iOS project structure
- Comprehensive Pytest test suite
- Entry announcements & VIP hierarchy (role-based)
- Gift deduction bug fixed (BIG_GIFTS)
- Lion vs Tiger multiplier math verified (x2/x5)
- iOS buttons fixed (44px minimum touch targets)
- Gift float animations + chat bubble animations
- Audio cleanup on room leave/unmount
- Number formatting (K, M, B) across all views
- Automatic Badge System (29 badges, 7 categories, auto-award)
- Badge display in profile with collection grid

## Remaining Backlog
### P1
- TTS Voice Integration (Google Cloud/Azure) for natural bot voices

### P2
- More casino mini-games
- Enhanced StorePage with actual Stripe product catalog
- Push notifications
- More entry animations per aristocracy level
