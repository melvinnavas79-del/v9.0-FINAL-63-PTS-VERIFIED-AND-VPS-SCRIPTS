#!/usr/bin/env bash
# ================================================================
#  Lluvia Live v9.0 — Diagnóstico automático del VPS
#  Uso:  chmod +x scripts/verificar-vps.sh && ./scripts/verificar-vps.sh
#  El output le dice exactamente qué está mal y cómo arreglarlo.
# ================================================================

set -u

# Colores
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; N='\033[0m'
ok()    { echo -e "${G}✅ $1${N}"; }
warn()  { echo -e "${Y}⚠️  $1${N}"; }
fail()  { echo -e "${R}❌ $1${N}"; }
info()  { echo -e "${B}ℹ️  $1${N}"; }
line()  { echo "────────────────────────────────────────────────────────"; }

ROOT="${1:-/root/lluvia-live}"
cd "$ROOT" 2>/dev/null || { fail "No existe la ruta $ROOT. Pase la ruta como argumento: ./verificar-vps.sh /ruta/a/lluvia-live"; exit 1; }

echo ""
echo -e "${B}╔════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  DIAGNÓSTICO VPS — Lluvia Live v9.0                ║${N}"
echo -e "${B}╚════════════════════════════════════════════════════╝${N}"
info "Directorio analizado: $ROOT"
info "Fecha: $(date)"
line

# ---- 1. Verificar estructura del repositorio ----
echo ""
info "1) Estructura del repositorio"
for f in backend/server.py backend/routes/economy.py backend/routes/script_runner.py backend/routes/reels.py backend/routes/diagnostics.py frontend/package.json; do
  if [ -f "$f" ]; then ok "Existe: $f"; else fail "FALTA: $f  →  el despliegue es incompleto o antiguo"; fi
done
line

# ---- 2. Verificar .env del backend ----
echo ""
info "2) Variables de entorno del BACKEND"
ENV_B="$ROOT/backend/.env"
if [ ! -f "$ENV_B" ]; then
  fail "No existe $ENV_B"
  warn "Solución:  cp backend/.env.example backend/.env  &&  nano backend/.env"
else
  ok "Existe: $ENV_B"
  REQUIRED_BE=(MONGO_URL DB_NAME MASTER_KEY JWT_SECRET GEMINI_API_KEY FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY FIREBASE_STORAGE_BUCKET PAYPAL_MODE PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET CORS_ORIGINS)
  for v in "${REQUIRED_BE[@]}"; do
    val=$(grep -E "^${v}=" "$ENV_B" | cut -d'=' -f2- | tr -d '"' | xargs 2>/dev/null)
    if [ -z "${val:-}" ]; then
      fail "Variable vacía o ausente: $v"
    else
      # ocultar valor en el log
      masked="${val:0:4}…${val: -4}"
      ok "$v = $masked"
    fi
  done
fi
line

# ---- 3. Verificar .env del frontend ----
echo ""
info "3) Variables de entorno del FRONTEND"
ENV_F="$ROOT/frontend/.env"
if [ ! -f "$ENV_F" ]; then
  fail "No existe $ENV_F"
  warn "Solución:  cp frontend/.env.example frontend/.env  &&  nano frontend/.env"
else
  ok "Existe: $ENV_F"
  val=$(grep -E '^REACT_APP_BACKEND_URL=' "$ENV_F" | cut -d'=' -f2- | xargs 2>/dev/null)
  if [ -z "${val:-}" ]; then
    fail "REACT_APP_BACKEND_URL vacía"
  else
    ok "REACT_APP_BACKEND_URL = $val"
    case "$val" in
      */) warn "La URL no debe terminar en / (quítele la barra final)" ;;
    esac
  fi
fi
line

# ---- 4. Supervisor / servicios ----
echo ""
info "4) Estado de los servicios"
if command -v supervisorctl >/dev/null 2>&1; then
  sudo supervisorctl status | while read -r linea; do
    case "$linea" in
      *RUNNING*) ok "$linea" ;;
      *) fail "$linea" ;;
    esac
  done
else
  warn "supervisorctl no está instalado en este servidor"
fi
line

# ---- 5. MongoDB local ----
echo ""
info "5) MongoDB"
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet mongod; then
  ok "mongod está activo"
elif pgrep -x mongod >/dev/null 2>&1; then
  ok "mongod corriendo como proceso"
else
  fail "mongod NO está corriendo"
  warn "Solución:  sudo systemctl start mongod"
fi
line

# ---- 6. Prueba de endpoints HTTP ----
echo ""
info "6) Prueba en vivo de endpoints HTTP"
BASE_URL="${BASE_URL:-http://127.0.0.1:8001}"
info "Probando contra: $BASE_URL (puede sobrescribir con:  BASE_URL=https://lluvia-live.com ./verificar-vps.sh)"

test_endpoint() {
  local ep="$1" expect="$2"
  code=$(curl -s -o /tmp/_lluvia_body -w "%{http_code}" --max-time 8 "$BASE_URL$ep" 2>/dev/null || echo "000")
  if [ "$code" = "$expect" ]; then
    ok "GET $ep → HTTP $code"
  else
    fail "GET $ep → HTTP $code (esperado $expect)"
    head -c 200 /tmp/_lluvia_body 2>/dev/null; echo
  fi
}

test_endpoint "/api/rooms"          "200"
test_endpoint "/api/webrtc/config"  "200"
test_endpoint "/api/agora/token"    "404"   # debe estar ELIMINADO
test_endpoint "/api/reels"          "200"
# /api/diagnostics requiere user_id de un dueño/super_admin
OWNER_ID="${OWNER_ID:-}"
if [ -n "$OWNER_ID" ]; then
  test_endpoint "/api/diagnostics?user_id=$OWNER_ID" "200"
else
  warn "Saltando /api/diagnostics — exporte OWNER_ID=<su_user_id> para incluirlo en la prueba"
fi
line

# ---- 7. Inspección fina de /api/diagnostics ----
echo ""
info "7) Panel de Salud (/api/diagnostics)"
if [ -z "$OWNER_ID" ]; then
  warn "OWNER_ID no definido. Ejecute de nuevo con: OWNER_ID=<id_del_dueno> BASE_URL=... ./verificar-vps.sh"
  DIAG=""
else
  DIAG=$(curl -s --max-time 8 "$BASE_URL/api/diagnostics?user_id=$OWNER_ID" 2>/dev/null)
fi
if [ -n "$DIAG" ]; then
  echo "$DIAG" | python3 -m json.tool 2>/dev/null || echo "$DIAG"
  echo "$DIAG" | grep -q '"paypal":[[:space:]]*"ok"'   && ok "PayPal OK"   || fail "PayPal con error — revise PAYPAL_CLIENT_ID/SECRET"
  echo "$DIAG" | grep -q '"uploads":[[:space:]]*"ok"'  && ok "Uploads OK"  || fail "Uploads con error — permisos de backend/uploads/"
  echo "$DIAG" | grep -q '"mongo":[[:space:]]*"ok"'    && ok "Mongo OK"    || fail "Mongo con error — revise MONGO_URL y systemctl status mongod"
else
  fail "El backend no respondió /api/diagnostics"
fi
line

# ---- 8. Puertos abiertos ----
echo ""
info "8) Puertos en escucha"
ss -tlnp 2>/dev/null | grep -E ':(80|443|8001|27017)' || warn "ss no disponible o ningún puerto esperado abierto"
line

# ---- 9. Resumen final ----
echo ""
echo -e "${B}╔════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  RESUMEN                                           ║${N}"
echo -e "${B}╚════════════════════════════════════════════════════╝${N}"
echo ""
echo "Si ve cualquier ❌ arriba, siga la 'Solución' indicada debajo de cada error."
echo "Después de aplicar cambios al .env:"
echo "   sudo supervisorctl restart backend frontend"
echo ""
echo "Para ayuda: comparta el output completo de este script con el agente Emergent."
echo ""
