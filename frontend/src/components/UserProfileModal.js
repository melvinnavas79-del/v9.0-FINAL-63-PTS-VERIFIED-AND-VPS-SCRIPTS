import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCoins = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return n.toLocaleString();
};

const UserProfileModal = ({ targetUser, currentUser, roomId, onClose, onRefresh }) => {
  const [permissions, setPermissions] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [giveAmount, setGiveAmount] = useState('');
  const [giveType, setGiveType] = useState('coins');
  const [showGive, setShowGive] = useState(false);
  const [loading, setLoading] = useState('');
  const [following, setFollowing] = useState(false);

  const targetId = targetUser.user_id || targetUser.id;
  const isSelf = targetId === currentUser.id;

  useEffect(() => {
    loadPermissions();
    if (!isSelf) loadFollowStatus();
  }, []);

  const loadPermissions = async () => {
    try {
      const r = await axios.get(`${API}/svip/permissions/${currentUser.id}`);
      setPermissions(r.data);
    } catch (e) {}
  };

  const loadFollowStatus = async () => {
    try {
      const r = await axios.get(`${API}/social/follow-status?follower_id=${currentUser.id}&target_id=${targetId}`);
      setFollowing(r.data?.following || false);
    } catch (e) { setFollowing(false); }
  };

  const toggleFollow = async () => {
    setLoading('follow');
    try {
      if (following) {
        await axios.delete(`${API}/social/follow`, { data: { follower_id: currentUser.id, target_id: targetId } });
        setFollowing(false);
      } else {
        await axios.post(`${API}/social/follow`, { follower_id: currentUser.id, target_id: targetId });
        setFollowing(true);
      }
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setLoading('');
  };

  const loadDeviceInfo = async () => {
    try {
      const r = await axios.get(`${API}/admin/device-info/${targetUser.user_id || targetUser.id}?admin_id=${currentUser.id}`);
      setDeviceInfo(r.data);
      setShowDeviceInfo(true);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const kickUser = async () => {
    setLoading('kick');
    try {
      await axios.post(`${API}/rooms/${roomId}/kick?kicker_id=${currentUser.id}&target_id=${targetUser.user_id || targetUser.id}`);
      alert('Usuario expulsado');
      onClose(); onRefresh?.();
    } catch (e) { alert(e.response?.data?.detail || 'No puedes expulsar a este usuario'); }
    setLoading('');
  };

  const muteUser = async () => {
    setLoading('mute');
    try {
      await axios.post(`${API}/rooms/${roomId}/mute?muter_id=${currentUser.id}&target_id=${targetUser.user_id || targetUser.id}`);
      alert('Usuario silenciado');
    } catch (e) { alert(e.response?.data?.detail || 'No puedes silenciar a este usuario'); }
    setLoading('');
  };

  const banAccount = async () => {
    if (!confirm('Banear esta cuenta?')) return;
    setLoading('ban');
    try {
      await axios.post(`${API}/admin/console/ban?admin_id=${currentUser.id}&target_id=${targetUser.user_id || targetUser.id}`);
      alert('Cuenta baneada');
      onClose();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setLoading('');
  };

  const banDevice = async () => {
    if (!confirm('BANEAR DISPOSITIVO? Esto bloquea el telefono permanentemente.')) return;
    const did = deviceInfo?.device_id || targetUser.device_id;
    if (!did) { alert('Este usuario no tiene Device ID registrado'); return; }
    setLoading('bandev');
    try {
      await axios.post(`${API}/admin/ban-device?device_id=${did}&admin_id=${currentUser.id}&reason=Fraude`);
      alert('Dispositivo baneado permanentemente');
      onClose();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setLoading('');
  };

  const giveCoins = async () => {
    const amount = parseInt(giveAmount);
    if (!amount || amount <= 0) return;
    setLoading('give');
    try {
      const params = giveType === 'coins' ? `coins=${amount}&diamonds=0` : `coins=0&diamonds=${amount}`;
      const r = await axios.post(`${API}/admin/give-coins?admin_id=${currentUser.id}&target_id=${targetUser.user_id || targetUser.id}&${params}`);
      alert(`Entregado! Nuevo saldo: ${formatCoins(r.data.coins)} monedas, ${formatCoins(r.data.diamonds)} diamantes`);
      setGiveAmount(''); setShowGive(false);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setLoading('');
  };

  const setRole = async (role) => {
    if (!confirm(`Cambiar rol a ${role}?`)) return;
    try {
      await axios.post(`${API}/admin/set-role?user_id=${targetUser.user_id || targetUser.id}&admin_id=${currentUser.id}&role=${role}`);
      alert(`Rol cambiado a ${role}`);
      onRefresh?.();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  if (!permissions) return null;

  return (
    <div className="absolute inset-0 z-[70] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-5 text-center relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/50 text-xl">x</button>
          <img src={targetUser.avatar} alt="" className="w-20 h-20 rounded-full mx-auto border-4 border-white/20 mb-2" />
          <h3 className="text-white font-bold text-lg">{targetUser.username}</h3>
          <div className="flex items-center justify-center gap-2 mt-1">
            {targetUser.country_flag && <span className="text-lg">{targetUser.country_flag}</span>}
            {targetUser.svip_level > 0 && <span className="bg-yellow-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">SVIP {targetUser.svip_level}</span>}
            <span className="bg-white/10 text-white/60 text-[10px] px-2 py-0.5 rounded-full">{targetUser.role || 'usuario'}</span>
          </div>
          <div className="text-yellow-400/60 text-xs mt-1">Nivel {targetUser.level || 1}</div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          {/* EVERYONE: Basic info */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white/5 rounded-xl p-2 text-center">
              <div className="text-yellow-400 text-sm font-bold">{formatCoins(targetUser.coins || 0)}</div>
              <div className="text-white/30 text-[9px]">Monedas</div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 text-center">
              <div className="text-cyan-400 text-sm font-bold">{formatCoins(targetUser.diamonds || 0)}</div>
              <div className="text-white/30 text-[9px]">Diamantes</div>
            </div>
          </div>

          {/* FOLLOW / UNFOLLOW — visible para TODOS excepto uno mismo */}
          {!isSelf && (
            <button
              data-testid="modal-follow-btn"
              onClick={toggleFollow}
              disabled={loading === 'follow'}
              className={`w-full py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-50 transition-all ${
                following
                  ? 'bg-white/10 text-white/80 hover:bg-white/15'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
              }`}
            >
              {loading === 'follow' ? '…' : (following ? '✓ Siguiendo (tocar para dejar)' : '+ Seguir a este usuario')}
            </button>
          )}

          {/* SVIP 7+ / Moderator: Mute & Kick */}
          {!isSelf && (permissions.can_mute || permissions.can_kick) && (
            <div className="flex gap-2">
              {permissions.can_mute && (
                <button onClick={muteUser} disabled={!!loading} data-testid="modal-mute-btn"
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-50">
                  {loading === 'mute' ? '...' : 'Silenciar'}
                </button>
              )}
              {permissions.can_kick && (
                <button onClick={kickUser} disabled={!!loading} data-testid="modal-kick-btn"
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-50">
                  {loading === 'kick' ? '...' : 'Expulsar'}
                </button>
              )}
            </div>
          )}

          {/* ADMIN: Ban Account */}
          {!isSelf && permissions.can_ban && (
            <button onClick={banAccount} disabled={!!loading} data-testid="modal-ban-btn"
              className="w-full bg-red-800 text-white py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-50">
              {loading === 'ban' ? '...' : 'Banear Cuenta'}
            </button>
          )}

          {/* OWNER ONLY: Give Coins */}
          {!isSelf && permissions.can_give_coins && (
            <>
              {!showGive ? (
                <button onClick={() => setShowGive(true)} data-testid="modal-give-btn"
                  className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold active:scale-95">
                  Dar Monedas/Diamantes
                </button>
              ) : (
                <div className="bg-green-900/30 border border-green-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => setGiveType('coins')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${giveType === 'coins' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white/50'}`}>Monedas</button>
                    <button onClick={() => setGiveType('diamonds')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${giveType === 'diamonds' ? 'bg-cyan-500 text-black' : 'bg-white/10 text-white/50'}`}>Diamantes</button>
                  </div>
                  <input type="number" value={giveAmount} onChange={e => setGiveAmount(e.target.value)} placeholder="Cantidad"
                    className="w-full bg-black/30 text-white rounded-lg px-3 py-2 text-sm" />
                  <button onClick={giveCoins} disabled={!!loading}
                    className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                    {loading === 'give' ? '...' : `Dar ${giveType === 'coins' ? 'Monedas' : 'Diamantes'}`}
                  </button>
                </div>
              )}
            </>
          )}

          {/* OWNER ONLY: Set Role */}
          {!isSelf && permissions.can_set_role && (
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-white/40 text-[10px] mb-2">Cambiar Rol</div>
              <div className="flex flex-wrap gap-1">
                {['usuario', 'supervisor', 'moderador', 'admin'].map(r => (
                  <button key={r} onClick={() => setRole(r)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold ${targetUser.role === r ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/50'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* OWNER ONLY: Device Info & Ban Device */}
          {!isSelf && permissions.can_see_device_info && (
            <>
              <button onClick={loadDeviceInfo} data-testid="modal-device-info-btn"
                className="w-full bg-blue-800 text-white py-2.5 rounded-xl text-sm font-bold active:scale-95">
                Ver Info del Dispositivo
              </button>

              {showDeviceInfo && deviceInfo && (
                <div className="bg-blue-900/30 border border-blue-500/20 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Device ID:</span><span className="text-white font-mono text-[10px]">{deviceInfo.device_id || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Modelo:</span><span className="text-white">{deviceInfo.device_model || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">IP:</span><span className="text-white font-mono">{deviceInfo.last_ip || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Device Baneado:</span><span className={deviceInfo.is_device_banned ? 'text-red-400' : 'text-green-400'}>{deviceInfo.is_device_banned ? 'SI' : 'NO'}</span></div>

                  {deviceInfo.linked_accounts?.length > 0 && (
                    <div>
                      <div className="text-yellow-400 text-[10px] font-bold mb-1">Cuentas en este dispositivo ({deviceInfo.linked_accounts.length}):</div>
                      {deviceInfo.linked_accounts.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-black/20 rounded p-1.5 mb-1">
                          <span className={`text-white text-[10px] ${a.is_banned ? 'line-through text-red-400' : ''}`}>{a.username}</span>
                          <span className="text-white/30 text-[8px]">{a.created_at?.slice(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {deviceInfo.ip_linked_accounts?.length > 0 && (
                    <div>
                      <div className="text-orange-400 text-[10px] font-bold mb-1">Misma IP ({deviceInfo.ip_linked_accounts.length}):</div>
                      {deviceInfo.ip_linked_accounts.map(a => (
                        <div key={a.id} className="bg-black/20 rounded p-1.5 mb-1">
                          <span className="text-white text-[10px]">{a.username}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isSelf && (
                <button onClick={banDevice} disabled={!!loading} data-testid="modal-ban-device-btn"
                  className="w-full bg-red-900 text-red-200 py-2.5 rounded-xl text-sm font-bold border border-red-500/30 active:scale-95 disabled:opacity-50">
                  {loading === 'bandev' ? '...' : 'BANEAR DISPOSITIVO'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
