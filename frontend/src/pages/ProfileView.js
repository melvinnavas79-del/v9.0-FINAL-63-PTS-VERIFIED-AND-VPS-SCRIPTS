import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCoins = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return n.toLocaleString();
};

const ProfileView = ({ onBack, onNavigate }) => {
  const { user, logout, updateUser } = useUser();
  const [ghostMode, setGhostMode] = useState(user?.ghost_mode || false);
  const [uploading, setUploading] = useState(false);
  const [badgesData, setBadgesData] = useState(null);
  const [countries, setCountries] = useState([]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadBadges();
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try { const r = await axios.get(`${API}/countries`); setCountries(r.data); } catch (e) {}
  };

  const setCountry = async (code) => {
    try {
      const r = await axios.post(`${API}/users/${user.id}/country?country_code=${code}`);
      if (r.data.success) {
        updateUser({ country: r.data.country.code, country_flag: r.data.country.flag });
        setShowCountryPicker(false);
      }
    } catch (e) { alert('Error al cambiar pais'); }
  };

  const loadBadges = async () => {
    try {
      // Trigger badge check first
      await axios.post(`${API}/badges/${user.id}/check`);
      const r = await axios.get(`${API}/badges/${user.id}`);
      setBadgesData(r.data);
    } catch (e) { console.error(e); }
  };

  const toggleGhostMode = async () => {
    try {
      const res = await axios.post(`${API}/users/${user.id}/ghost-mode`);
      if (res.data.success) {
        setGhostMode(res.data.ghost_mode);
        updateUser({ ghost_mode: res.data.ghost_mode });
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Solo el admin puede usar Modo Fantasma');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API}/users/${user.id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success) {
        const fullUrl = res.data.avatar.startsWith('http') ? res.data.avatar : `${process.env.REACT_APP_BACKEND_URL}${res.data.avatar}`;
        updateUser({ avatar: fullUrl });
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al subir foto');
    }
    setUploading(false);
  };

  const memberDate = user.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : '';

  const avatarSrc = user.avatar?.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${user.avatar}` : user.avatar;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Profile Header Banner */}
      <div className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 pt-8 pb-16 px-4 relative">
        <button data-testid="profile-back-btn" onClick={onBack}
          className="absolute top-4 left-4 bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-medium">
          ← Volver
        </button>

        {/* Avatar with Upload */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-4 border-white bg-white overflow-hidden shadow-lg">
              <img src={avatarSrc} alt={user.username} className="w-full h-full object-cover" />
            </div>
            <button
              data-testid="change-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-9 h-9 bg-cyan-500 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white active:scale-90 transition-transform"
            >
              {uploading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <span className="text-sm">📷</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
              data-testid="avatar-file-input"
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <h2 className="text-3xl font-bold text-white text-center">{user.username}</h2>
          <button
            data-testid="edit-username-btn"
            onClick={async () => {
              const nuevo = window.prompt('Nuevo nombre de usuario (3-20 caracteres):', user.username);
              if (!nuevo || nuevo.trim() === user.username) return;
              try {
                const r = await axios.put(`${API}/users/${user.id}`, { username: nuevo.trim() });
                if (r.data && r.data.username) {
                  updateUser({ username: r.data.username });
                  alert('✅ Nombre actualizado');
                }
              } catch (err) {
                alert(err.response?.data?.detail || 'No se pudo cambiar el nombre');
              }
            }}
            className="text-white/60 hover:text-white text-lg"
            title="Cambiar nombre"
          >✏️</button>
        </div>
        <p className="text-center text-white/40 text-[11px] mb-2">ID: {user.numeric_id || user.id?.slice(0,8)}</p>
        {/* Country & SVIP */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <button onClick={() => setShowCountryPicker(!showCountryPicker)}
            className="bg-white/10 px-3 py-1 rounded-full text-sm flex items-center gap-1 active:scale-95">
            <span>{user.country_flag || '🌍'}</span>
            <span className="text-white/60 text-xs">{user.country || 'Elegir pais'}</span>
          </button>
          {user.svip_level > 0 && (
            <span className="bg-yellow-500/80 text-white text-xs px-3 py-1 rounded-full font-bold">SVIP {user.svip_level}</span>
          )}
        </div>

        {/* Country Picker */}
        {showCountryPicker && (
          <div className="mb-4 max-h-[200px] overflow-y-auto bg-white/5 rounded-xl p-2">
            <div className="grid grid-cols-2 gap-1">
              {countries.map(c => (
                <button key={c.code} onClick={() => setCountry(c.code)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs ${user.country === c.code ? 'bg-cyan-500/30 border border-cyan-400/30' : 'bg-white/5 hover:bg-white/10'}`}>
                  <span className="text-base">{c.flag}</span>
                  <span className="text-white/80 truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {badgesData?.badges?.filter(b => b.earned).map((badge) => (
            <span key={badge.id} className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-bold backdrop-blur">
              {badge.icon} {badge.name}
            </span>
          ))}
          {user.role === 'dueño' && (
            <span className="bg-yellow-500/80 text-white text-xs px-3 py-1 rounded-full font-bold">👑 Dueño</span>
          )}
          {badgesData && (
            <span className="bg-white/10 text-white/60 text-[10px] px-2 py-1 rounded-full">
              {badgesData.earned_count}/{badgesData.total} medallas
            </span>
          )}
        </div>

        {memberDate && <p className="text-white/80 text-center text-sm">Miembro desde {memberDate}</p>}
      </div>

      {/* Stats Grid */}
      <div className="px-4 -mt-8">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl mb-1">⭐</div>
            <div className="text-gray-500 text-sm">Nivel</div>
            <div className="text-2xl font-bold text-gray-800">{user.level || 1}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl mb-1">💰</div>
            <div className="text-gray-500 text-sm">Monedas</div>
            <div className="text-2xl font-bold text-gray-800">{formatCoins(user.coins)}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl mb-1">💎</div>
            <div className="text-gray-500 text-sm">Diamantes</div>
            <div className="text-2xl font-bold text-gray-800">{formatCoins(user.diamonds)}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl mb-1">💸</div>
            <div className="text-gray-500 text-sm">Total Gastado</div>
            <div className="text-2xl font-bold text-gray-800">{formatCoins(user.total_spent)}</div>
          </div>
        </div>

        {/* Wallet · Canje Oro → Diamantes */}
        <WalletExchange user={user} updateUser={updateUser} />

        {/* Badge Collection */}
        {badgesData && badgesData.badges && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Medallas ({badgesData.earned_count}/{badgesData.total})</h3>
            <div className="grid grid-cols-4 gap-2">
              {badgesData.badges.map(b => (
                <div key={b.id} className={`rounded-xl p-2 text-center ${b.earned ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100 opacity-40'}`}>
                  <div className="text-2xl mb-0.5">{b.icon}</div>
                  <div className={`text-[9px] font-bold ${b.earned ? 'text-gray-800' : 'text-gray-400'}`}>{b.name}</div>
                  <div className="text-[8px] text-gray-400">{b.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info cards */}
        {(user.clan_name || user.cp_partner) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {user.clan_name && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center">
                <div className="text-2xl mb-1">🏰</div>
                <div className="text-gray-500 text-xs">Clan</div>
                <div className="text-sm font-bold text-blue-600">{user.clan_name}</div>
              </div>
            )}
            {user.cp_partner && (
              <div className="bg-pink-50 rounded-2xl p-4 border border-pink-100 text-center">
                <div className="text-2xl mb-1">💖</div>
                <div className="text-gray-500 text-xs">Pareja</div>
                <div className="text-sm font-bold text-pink-600">{user.cp_partner}</div>
              </div>
            )}
          </div>
        )}

        {/* Account Verification */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Seguridad de Cuenta</h3>
          
          {user.is_verified ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-green-500 text-lg">✓</span>
                <div>
                  <div className="text-green-700 text-sm font-bold">Cuenta Verificada</div>
                  {user.email && <div className="text-green-600 text-xs">{user.email}</div>}
                  {user.phone && <div className="text-green-600 text-xs">{user.phone}</div>}
                  <div className="text-green-500 text-[10px]">via {user.auth_provider === 'google.com' ? 'Google' : user.auth_provider === 'phone' ? 'Telefono' : user.auth_provider || 'Contraseña'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
              <div className="text-yellow-700 text-sm font-bold">Cuenta No Verificada</div>
              <div className="text-yellow-600 text-xs">Vincula Google o Telefono para proteger tu cuenta</div>
            </div>
          )}

          {!user.firebase_uid && (
            <button onClick={async () => {
              try {
                const { auth: fbAuth, googleProvider: gp, signInWithPopup: siwp } = await import('../lib/firebase');
                const result = await siwp(fbAuth, gp);
                const idToken = await result.user.getIdToken();
                const res = await axios.post(`${API}/auth/link-account`, { user_id: user.id, id_token: idToken });
                if (res.data.success) { updateUser(res.data.user); alert('Cuenta vinculada con Google!'); }
              } catch (e) { alert(e.response?.data?.detail || 'Error al vincular'); }
            }} className="w-full bg-white border-2 border-blue-400 text-blue-600 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Vincular con Google
            </button>
          )}

          {user.device_id && (
            <div className="mt-2 text-gray-400 text-[9px] text-center">Device: {user.device_id.substring(0, 12)}...</div>
          )}
        </div>

        {/* Config */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Configuracion</h3>
          {user.role === 'dueño' && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-gray-700 font-medium">👻 Modo Fantasma</span>
                <p className="text-gray-500 text-xs">Exclusivo del Dueño · Invisible en salas, listas y conteos</p>
                {ghostMode && <p className="text-green-500 text-xs font-bold">ACTIVO · Estás invisible</p>}
              </div>
              <button onClick={toggleGhostMode} data-testid="toggle-ghost-btn"
                className={`px-4 py-1.5 rounded-lg text-sm font-bold ${ghostMode ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {ghostMode ? 'Activado' : 'Desactivado'}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Rol</span>
            <span className="bg-pink-100 text-pink-600 px-4 py-1.5 rounded-lg text-sm font-bold">
              👑 {user.role === 'dueño' ? 'Dueño' : user.role === 'admin' ? 'Admin' : user.role === 'moderador' ? 'Moderador' : user.role === 'supervisor' ? 'Supervisor' : 'Usuario'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {(user.is_admin || user.role === 'dueño' || user.role === 'admin' || user.role === 'moderador' || user.role === 'supervisor') && (
            <button data-testid="open-admin-panel" onClick={() => onNavigate('admin')}
              className="col-span-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 rounded-2xl font-bold text-center">
              👑 Panel de Administracion
            </button>
          )}

          <button data-testid="change-photo-btn" onClick={() => fileInputRef.current?.click()}
            className="bg-white border-2 border-cyan-400 text-cyan-500 py-3 rounded-2xl font-bold">
            📷 Cambiar Foto
          </button>

          <button onClick={() => { logout(); onBack(); }}
            className="bg-gradient-to-r from-pink-500 to-red-500 text-white py-3 rounded-2xl font-bold">
            Cerrar Sesion
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;

// ==================== WALLET · CANJE DIAMANTES → ORO (1:1) ====================
const WalletExchange = ({ user, updateUser }) => {
  const [cfg, setCfg] = useState({ diamond_to_coin_rate: 1.0, min_diamond_exchange: 1, commission_rate: 0.30 });
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/economy/config`).then(r => setCfg(r.data)).catch(() => {});
  }, []);

  const coinsPreview = Math.round((amount || 0) * (cfg.diamond_to_coin_rate || 1.0));
  const canExchange = amount >= (cfg.min_diamond_exchange || 1) && amount <= (user.diamonds || 0);

  const exchange = async () => {
    if (!canExchange) return;
    if (!window.confirm(`¿Canjear ${amount.toLocaleString()} 💎 por ${coinsPreview.toLocaleString()} 💰?`)) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/wallet/redeem-diamonds`, { user_id: user.id, diamonds: amount });
      updateUser({ coins: res.data.new_coins, diamonds: res.data.new_diamonds });
      alert(`✅ Recibiste ${res.data.coins_received.toLocaleString()} 💰\nSaldo: ${res.data.new_coins.toLocaleString()} monedas · ${res.data.new_diamonds.toLocaleString()} diamantes`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error en el canje');
    }
    setLoading(false);
  };

  const presets = [1000, 10000, 100000, 1000000];

  return (
    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-5 shadow-sm border border-cyan-200 mb-4" data-testid="wallet-exchange">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">🏦 Wallet · Canje Diamantes → Oros</h3>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        Tasa exacta <strong>{cfg.diamond_to_coin_rate.toFixed(2)} 💰 por 1 💎</strong> · Sin pérdida ·
        Comisión de la casa ({Math.round((cfg.commission_rate || 0) * 100)}%) ya fue descontada al recibir los regalos.
      </p>

      <div className="bg-white rounded-xl p-3 mb-3 border border-cyan-100">
        <label className="text-gray-500 text-xs font-medium">Diamantes a canjear</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(parseInt(e.target.value) || 0)}
          min={cfg.min_diamond_exchange}
          data-testid="wallet-exchange-input"
          className="w-full bg-transparent text-2xl font-black text-cyan-700 outline-none"
        />
        <div className="flex gap-1 mt-2 flex-wrap">
          {presets.map(p => (
            <button key={p} onClick={() => setAmount(p)} data-testid={`wallet-preset-${p}`}
              className={`text-[11px] px-2 py-1 rounded-full font-bold ${amount === p ? 'bg-cyan-500 text-white' : 'bg-cyan-100 text-cyan-700'}`}>
              {formatCoins(p)}
            </button>
          ))}
          <button onClick={() => setAmount(user.diamonds || 0)} data-testid="wallet-preset-max"
            className="text-[11px] px-2 py-1 rounded-full font-bold bg-blue-500 text-white">
            MAX
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl p-3 mb-3 border border-cyan-100">
        <div className="text-gray-600 text-sm">Recibirás</div>
        <div className="flex items-center gap-2">
          <span className="text-3xl">💰</span>
          <span className="text-3xl font-black text-yellow-600" data-testid="wallet-coins-preview">{coinsPreview.toLocaleString()}</span>
        </div>
      </div>

      <button
        onClick={exchange}
        disabled={!canExchange || loading}
        data-testid="wallet-exchange-btn"
        className={`w-full py-3 rounded-xl font-black text-white text-sm ${canExchange && !loading ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 active:scale-[0.98]' : 'bg-gray-300 cursor-not-allowed'}`}
      >
        {loading ? '⏳ Procesando...' : `🔄 CANJEAR ${amount.toLocaleString()} 💎 → ${coinsPreview.toLocaleString()} 💰`}
      </button>
      {!canExchange && amount > 0 && (
        <p className="text-red-500 text-[11px] mt-2 text-center">
          {amount > (user.diamonds || 0)
            ? `Saldo insuficiente (tienes ${(user.diamonds || 0).toLocaleString()} 💎)`
            : `Mínimo ${cfg.min_diamond_exchange} diamantes`}
        </p>
      )}
    </div>
  );
};
