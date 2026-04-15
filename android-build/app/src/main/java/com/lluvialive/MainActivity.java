/**
 * Lluvia Live - MainActivity.java
 * ================================
 * WebView nativo configurado para escala completa, audio Agora,
 * y pantalla borde a borde (full screen).
 */
package com.lluvialive;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends Activity {

    private WebView webView;
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final String APP_URL = "https://tu-dominio.com"; // Cambiar a tu URL

    // Permisos requeridos para Agora audio
    private static final String[] REQUIRED_PERMISSIONS = {
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.MODIFY_AUDIO_SETTINGS,
        Manifest.permission.INTERNET,
        Manifest.permission.ACCESS_NETWORK_STATE,
        Manifest.permission.CAMERA
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ========== 3. PANTALLA COMPLETA (Borde a borde) ==========
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        // Modo inmersivo - oculta barras de navegacion y status
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(
                getWindow(), getWindow().getDecorView()
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }

        // Status bar transparente
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }

        // Layout borde a borde sin margenes
        FrameLayout container = new FrameLayout(this);
        container.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // ========== CREAR WEBVIEW ==========
        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // Eliminar padding/margin de Safe Areas
        webView.setPadding(0, 0, 0, 0);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);

        container.addView(webView);
        setContentView(container);

        // Solicitar permisos de audio antes de cargar
        requestPermissions();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();

        // ========== 1. CONFIGURACION DE ESCALA ==========
        settings.setUseWideViewPort(true);           // Ajustar al ancho del viewport
        settings.setLoadWithOverviewMode(true);       // Escalar contenido al ancho total
        settings.setSupportZoom(false);               // Deshabilitar zoom manual
        settings.setBuiltInZoomControls(false);       // Sin controles de zoom
        settings.setDisplayZoomControls(false);       // Ocultar botones de zoom
        settings.setInitialScale(0);                  // Escala automatica

        // Densidad de pixeles: forzar a usar la densidad del dispositivo
        settings.setTextZoom(100);                    // Respetar escala del sistema

        // ========== 2. ALMACENAMIENTO Y SCRIPTS ==========
        settings.setJavaScriptEnabled(true);          // JS para toda la logica
        settings.setDomStorageEnabled(true);           // localStorage para sesiones
        settings.setDatabaseEnabled(true);             // Bases de datos web
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Media sin interaccion del usuario (para Agora audio)
        settings.setMediaPlaybackRequiresUserGesture(false);

        // User Agent personalizado
        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " LluviaLive/2.0 Android");

        // Mixed content (para cargar recursos http/https)
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Cookies para sesion
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // ========== WEB CHROME CLIENT (Permisos de audio/video) ==========
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // ========== 4. PERMISOS DE AUDIO (Agora SDK) ==========
                // Conceder automaticamente permisos de audio/video al WebView
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            // Soporte para file upload (avatars, photos)
            @Override
            public boolean onShowFileChooser(WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams) {
                // Implementar selector de archivos
                return false;
            }
        });

        // WebView client para navegacion interna
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Mantener navegacion interna
                if (url.contains("lluvialive") || url.contains("tu-dominio") || url.contains("localhost")) {
                    return false; // Cargar en WebView
                }
                return false; // Todo en WebView
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Inyectar CSS para forzar escala completa en Android
                String css = "javascript:(function(){" +
                    "var meta=document.querySelector('meta[name=viewport]');" +
                    "if(meta){meta.content='width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover';}" +
                    "document.body.style.margin='0';" +
                    "document.body.style.padding='0';" +
                    "document.body.style.width='100vw';" +
                    "document.body.style.minHeight='100vh';" +
                    "document.body.style.overflow='auto';" +
                    "})()";
                view.loadUrl(css);
            }
        });

        // Cargar la app
        webView.loadUrl(APP_URL);
    }

    // ========== MANEJO DE PERMISOS ==========
    private void requestPermissions() {
        boolean allGranted = true;
        for (String perm : REQUIRED_PERMISSIONS) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }
        if (!allGranted) {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, PERMISSION_REQUEST_CODE);
        } else {
            setupWebView();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            setupWebView(); // Cargar aunque no concedan todos
        }
    }

    // ========== NAVEGACION CON BOTON ATRAS ==========
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ========== LIFECYCLE ==========
    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        // Re-aplicar modo inmersivo
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
