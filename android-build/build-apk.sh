#!/bin/bash
# ================================================================
# Lluvia Live - Android APK Build Guide
# ================================================================
# 
# PREREQUISITOS:
#   1. Android Studio instalado (https://developer.android.com/studio)
#   2. Java JDK 17+ instalado
#   3. Android SDK 34 instalado
#
# PASOS PARA COMPILAR:
#
# 1. Cambiar la URL de la app:
#    Editar: app/src/main/java/com/lluvialive/MainActivity.java
#    Linea:  private static final String APP_URL = "https://tu-dominio.com";
#    Cambiar a: "https://207.180.235.220" o tu dominio real
#
# 2. Abrir en Android Studio:
#    File > Open > Seleccionar carpeta android-build/
#
# 3. Compilar APK:
#    Build > Build Bundle(s) / APK(s) > Build APK(s)
#    El APK estara en: app/build/outputs/apk/release/
#
# 4. Para Google Play Store:
#    Build > Generate Signed Bundle / APK
#    Seguir instrucciones para crear keystore
#
# ================================================================
# CONFIGURACION APLICADA:
# ================================================================
#
# 1. ESCALA:
#    - setUseWideViewPort(true)      -> Ajusta al ancho del dispositivo
#    - setLoadWithOverviewMode(true) -> Escala contenido automaticamente
#    - setTextZoom(100)              -> Respeta densidad de pixeles
#    - setInitialScale(0)            -> Auto-escala
#
# 2. ALMACENAMIENTO Y SCRIPTS:
#    - setJavaScriptEnabled(true)    -> JS para logica completa
#    - setDomStorageEnabled(true)    -> localStorage para sesiones
#    - setDatabaseEnabled(true)      -> Bases de datos web
#
# 3. PANTALLA COMPLETA:
#    - Modo inmersivo (oculta barras del sistema)
#    - Status bar y navigation bar transparentes
#    - Layout borde a borde (ignora Safe Areas)
#    - windowLayoutInDisplayCutoutMode = shortEdges (notch)
#
# 4. PERMISOS DE AUDIO (Agora):
#    - RECORD_AUDIO                  -> Microfono para salas
#    - MODIFY_AUDIO_SETTINGS         -> Control de volumen
#    - CAMERA                        -> Fotos de perfil/chat
#    - BLUETOOTH_CONNECT             -> Audifonos bluetooth
#    - WebChromeClient.onPermissionRequest -> Auto-grant
#
# ================================================================

echo "=================================================="
echo "  Lluvia Live - Android Build"
echo "=================================================="
echo ""
echo "Este proyecto debe compilarse en Android Studio."
echo ""
echo "IMPORTANTE: Cambia APP_URL en MainActivity.java"
echo "a la URL de tu servidor antes de compilar."
echo ""
echo "Archivos del proyecto:"
find app/ -name "*.java" -o -name "*.xml" -o -name "*.gradle" | sort
echo ""
echo "Abre esta carpeta en Android Studio para compilar."
