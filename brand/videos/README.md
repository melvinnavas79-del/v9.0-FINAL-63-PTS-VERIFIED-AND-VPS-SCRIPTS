# Videos Oficiales · Lluvia Live

© 2026 Melvin H. Navas Hernández. Todos los derechos reservados.

---

## Contenido

| Archivo                          | Formato       | Duración | Tamaño | Uso                                                |
|----------------------------------|---------------|----------|--------|----------------------------------------------------|
| `splash-1080x1080.mp4`           | H.264 · 1:1   | 3.00 s   | 2.4 MB | Pantalla de bienvenida al abrir la app (iOS/Android) |
| `splash-1080x1080.webm`          | VP9 · 1:1     | 3.00 s   | 3.7 MB | Splash para navegadores (web/PWA)                  |
| `splash-preview.gif`             | GIF 24fps     | 3.00 s   | 7.7 MB | Preview rápido (email, chats)                      |
| `splash-preview-frame.png`       | PNG 1080×1080 | —        | 1.9 MB | Screenshot estático (cover de documentos)          |
| **`promo-1080x1920.mp4`**        | H.264 · 9:16  | 20.00 s  | 5.9 MB | **TikTok, Reels, Stories, WhatsApp, Marketplace** |
| `promo-1920x1080.mp4`            | H.264 · 16:9  | 20.00 s  | 2.3 MB | YouTube, Facebook feed, anuncios horizontales      |
| `promo-preview.gif`              | GIF 15fps     | 10.00 s  | 12 MB  | Preview rápido de los primeros 10 s               |
| `promo-preview-frame.png`        | PNG 1080×1920 | —        | 0.7 MB | Thumbnail / cover para redes                       |

---

## Splash Screen (3 s)

Pensado para reproducirse al abrir la app. Timeline:

| Tiempo       | Efecto                                                        |
|--------------|---------------------------------------------------------------|
| 0.0 – 0.6 s  | Zoom-in del logo con fade desde negro                         |
| 0.6 – 1.4 s  | Destello radial dorado que barre la corona                    |
| 1.0 – 3.0 s  | Gotas doradas cayendo (partículas animadas)                   |
| 1.2 – 2.2 s  | Chispas turquesas pulsantes en las 3 gemas de la corona       |
| 2.4 – 3.0 s  | Hold final con ligero fade (listo para transición al Dashboard)|

**Integración iOS** — añadir `splash-1080x1080.mp4` al proyecto Xcode y usarlo como contenido del `LaunchScreen.storyboard` con un `AVPlayerView`.

**Integración Android** — copiar a `android-build/app/src/main/res/raw/splash.mp4` y reproducir con `VideoView` antes del `Intent` a `MainActivity`.

**Integración Web/PWA** — embeder con `<video autoplay muted playsinline>` en un overlay fijo que se desmonta tras `ended`.

---

## Video Publicitario (20 s)

Sin referencias a aristocracia, VIP ni niveles (como indicó el Titular).
Enfoque: conexión en vivo, comunidad fresca, lujo del logo dorado.

### Storyboard

| Tiempo         | Escena                                                        | Texto en pantalla                      |
|----------------|---------------------------------------------------------------|-----------------------------------------|
| 0.0 – 3.0 s    | Hero: logo grande con destello de corona dorado               | (Sin texto)                            |
| 3.0 – 7.0 s    | Logo reducido arriba · partículas · ondas de audio concéntricas | **CONECTA EN VIVO** / _Tu voz, tu comunidad_ |
| 7.0 – 11.0 s   | Ondas expansivas · 5 avatares circulares de colores           | **CONOCE GENTE NUEVA**                 |
| 11.0 – 15.0 s  | 3 íconos animados (🎙 Salas · 💝 Regalos · 🎮 Juegos)          | **TODO EN UN SOLO LUGAR**              |
| 15.0 – 18.5 s  | Logo central pulsante                                          | **LA COMUNIDAD QUE SUENA DIFERENTE**   |
| 18.5 – 20.0 s  | Logo + botón dorado "DESCARGA AHORA"                          | **LLUVIA LIVE** / _Tu voz, tu reino_   |

### Paleta usada

Solo los colores oficiales de `BRAND-GUIDELINES.md`:
- Oro Lluvia `#FFD700`, Oro Light `#FFF4C2`, Oro Deep `#8B5E00`
- Negro Noche `#0B0F1A`, Azul Abismo `#050813`
- Turquesa Corona `#5FE3F0`, Turquesa Light `#BFF5FA`

### Versiones

- **Vertical (1080×1920)** — formato nativo de redes sociales 2026.
- **Horizontal (1920×1080)** — recorte con padding negro noche para
  plataformas que aún requieren 16:9 (YouTube, Marketplace).

---

## Licencia

Estos videos son material exclusivo de **Lluvia Live**. Queda prohibida
su reproducción, modificación o distribución fuera de los canales
oficiales sin autorización expresa y por escrito del Titular. Consulta
`../../LICENSE` para los términos completos.
