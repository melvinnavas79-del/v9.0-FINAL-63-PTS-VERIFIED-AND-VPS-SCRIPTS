# Brand Kit · Lluvia Live

Paquete oficial de identidad visual.
Todo este contenido está protegido por la licencia del proyecto
([`../LICENSE`](../LICENSE)) y es propiedad exclusiva de
**Melvin H. Navas Hernández**.

## Estructura

```
brand/
├── BRAND-GUIDELINES.md          Guía de marca completa
├── logo-full-color.svg          SVG oficial (raster embebido)
├── logo-wordmark.svg            SVG vectorial puro (wordmark + corona)
├── README.md                    Este archivo
│
├── source/
│   └── logo-lluvia-live-master.png    Master 1024×1024 oficial
│
├── favicon/
│   ├── favicon.ico              multi-res (16/32/48)
│   ├── favicon-16x16.png ... favicon-512x512.png
│   ├── apple-touch-icon.png     180×180 para iOS Safari
│   ├── icon-192.png             PWA (Android Chrome)
│   └── icon-512.png             PWA (splash)
│
├── icons/
│   ├── android/
│   │   ├── mipmap-mdpi/…xxxhdpi/        ic_launcher[_round|_foreground].png
│   │   ├── playstore/ic_launcher.png    512×512 para Google Play
│   │   ├── ic_launcher.xml              adaptive icon XML
│   │   └── ic_launcher_colors.xml       paleta oficial para res/values/colors.xml
│   └── ios/
│       ├── Contents.json                Asset Catalog de Xcode
│       └── icon-*.png                   15 tamaños oficiales de Apple
```

## Integración rápida

**Android Studio**
1. Copiar los subdirectorios `mipmap-*` a `android-build/app/src/main/res/`.
2. Copiar `ic_launcher.xml` a `res/mipmap-anydpi-v26/ic_launcher.xml`
   y `res/mipmap-anydpi-v26/ic_launcher_round.xml`.
3. Mezclar `ic_launcher_colors.xml` en `res/values/colors.xml`.

**Xcode (iOS)**
1. Arrastrar toda la carpeta `icons/ios/` al Asset Catalog
   (`Assets.xcassets/AppIcon.appiconset`).
2. Xcode leerá `Contents.json` y aplicará los tamaños automáticamente.

**Web (ya integrado en `/frontend`)**
- `favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
  ya copiados a `frontend/public/` y referenciados en `index.html`
  y `manifest.json` con la paleta oficial.

## Paleta Oficial

| Color           | HEX       | Rol                             |
|-----------------|-----------|---------------------------------|
| **Oro Lluvia**  | `#FFD700` | Primario — wordmark, acentos    |
| **Negro Noche** | `#0B0F1A` | Fondo principal de la app       |
| **Turquesa Corona** | `#5FE3F0` | Gemas, highlights, CTA       |

Paleta completa con variantes en
[`BRAND-GUIDELINES.md`](BRAND-GUIDELINES.md).
