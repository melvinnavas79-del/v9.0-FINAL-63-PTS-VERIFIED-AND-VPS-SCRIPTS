# Lluvia Live - PRD

## Descripcion
App de streaming de audio en vivo con salas, juegos de monetizacion, Bot IA inteligente, economia de monedas.

## Stack
- Frontend: React.js + TailwindCSS + Agora.io WebRTC
- Backend: FastAPI + Motor (MongoDB async)
- AI Bot: emergentintegrations (Gemini) + Web Speech API

## Responsivo
- iOS: Safe area insets para notch y home indicator
- Android: Font scaling agresivo para High DPI (2x/3x), iconos w-16 h-16
- Bottom nav: 64px icons, safe-area-inset-bottom
- Room header: paddingTop safe-area-inset-top

## Bot IA
- [x] Solo responde cuando le dicen "bot" directamente
- [x] Si alguien habla normal, NO interrumpe
- [x] Puede animar salas (comandos: "bot anima", "bot animanos")
- [x] Vigilar TODAS las salas (boton en Panel > Bot IA)
- [x] 4 modos: normal, locutor, animador, serio
- [x] Comandos: callate, habla, modo X

## Juegos (8 con iconos profesionales)
- Tablita, PK, LUDO (tablero real), UNO, Domino, Eliminacion, Corona, Jackaroo

## Credenciales
- Melvin_Live / test123 - Role: dueño
