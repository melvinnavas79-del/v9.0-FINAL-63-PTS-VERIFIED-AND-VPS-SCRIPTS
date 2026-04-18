import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const formatNum = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : (n || 0).toLocaleString();

const EventControlPanel = ({ userId, onClose }) => {
  const [traffic, setTraffic] = useState(null);
  const [config, setConfig] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [flashMsg, setFlashMsg] = useState('');
  const [flashRoom, setFlashRoom] = useState('');
  const [flashScope, setFlashScope] = useState('global');
  const [flashCountry, setFlashCountry] = useState('');
  const [cofreRoom, setCofreRoom] = useState('');
  const [cofreLevel, setCofreLevel] = useState(5);
  const [loading, setLoading] = useState('');

  useEffect(() => {
    loadAll();
    const i = setInterval(loadTraffic, 10000);
    return () => clearInterval(i);
  }, []);

  const loadAll = () => { loadTraffic(); loadConfig(); loadRooms(); };
  const loadTraffic = async () => { try { const r = await axios.get(`${API}/admin/traffic-monitor?admin_id=${userId}`); setTraffic(r.data); } catch (e) {} };
  const loadConfig = async () => { try { const r = await axios.get(`${API}/admin/event-config?admin_id=${userId}`); setConfig(r.data); } catch (e) {} };
  const loadRooms = async () => { try { const r = await axios.get(`${API}/rooms`); setRooms(r.data); } catch (e) {} };

  const toggleBroadcast = async (mode) => {
    try {
      await axios.post(`${API}/admin/event-config?admin_id=${userId}`, { broadcast_mode: mode });
      setConfig(c => ({ ...c, broadcast_mode: mode }));
    } catch (e) { alert('Error'); }
  };

  const sendFlash = async () => {
    if (!flashMsg) { alert('Escribe un mensaje'); return; }
    setLoading('flash');
    try {
      await axios.post(`${API}/admin/flash-event?admin_id=${userId}`, {
        room_id: flashRoom, message: flashMsg, scope: flashScope, country: flashCountry
      });
      alert('Evento Flash enviado!');
      setFlashMsg('');
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setLoading('');
  };

  const activateCofre = async () => {
    if (!cofreRoom) { alert('Selecciona una sala'); return; }
    setLoading('cofre');
    try {
      await axios.post(`${API}/admin/activate-cofre?admin_id=${userId}&room_id=${cofreRoom}&level=${cofreLevel}`);
      alert(`Cofre Nivel ${cofreLevel} activado!`);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setLoading('');
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 overflow-y-auto">
      <div className="max-w-lg mx-auto p-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-black">Centro de Control</h2>
          <button onClick={onClose} className="bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold">Cerrar</button>
        </div>

        {/* Traffic Monitor */}
        <div className="bg-gradient-to-b from-blue-900/40 to-indigo-900/40 border border-blue-500/20 rounded-2xl p-4 mb-4">
          <h3 className="text-blue-300 text-sm font-bold mb-3">Monitor de Trafico en Vivo</h3>
          {traffic && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-black/30 rounded-xl p-2 text-center">
                  <div className="text-white text-lg font-bold">{formatNum(traffic.total_users)}</div>
                  <div className="text-white/40 text-[9px]">Usuarios</div>
                </div>
                <div className="bg-black/30 rounded-xl p-2 text-center">
                  <div className="text-white text-lg font-bold">{traffic.total_rooms}</div>
                  <div className="text-white/40 text-[9px]">Salas</div>
                </div>
                <div className="bg-black/30 rounded-xl p-2 text-center">
                  <div className="text-green-400 text-lg font-bold">{traffic.active_rooms}</div>
                  <div className="text-white/40 text-[9px]">Activas</div>
                </div>
              </div>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {traffic.by_country?.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{c.flag}</span>
                      <span className="text-white/80 text-xs">{c.name || c.country}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-500/30 h-2 rounded-full" style={{width: `${Math.min(100, (c.count / (traffic.total_users || 1)) * 300)}px`}} />
                      <span className="text-white text-xs font-bold">{c.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Broadcast Mode */}
        <div className="bg-gradient-to-b from-purple-900/40 to-violet-900/40 border border-purple-500/20 rounded-2xl p-4 mb-4">
          <h3 className="text-purple-300 text-sm font-bold mb-3">Modo de Difusion</h3>
          <div className="flex gap-2">
            <button onClick={() => toggleBroadcast('regional')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${config?.broadcast_mode === 'regional' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/40'}`}>
              Regional
            </button>
            <button onClick={() => toggleBroadcast('global')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${config?.broadcast_mode === 'global' ? 'bg-green-500 text-white' : 'bg-white/5 text-white/40'}`}>
              Global
            </button>
          </div>
          <p className="text-white/30 text-[9px] mt-2 text-center">
            {config?.broadcast_mode === 'global' ? 'Los anuncios se ven en TODO el mundo' : 'Los anuncios se ven solo en la region de la sala'}
          </p>
        </div>

        {/* Flash Event */}
        <div className="bg-gradient-to-b from-yellow-900/40 to-amber-900/40 border border-yellow-500/20 rounded-2xl p-4 mb-4">
          <h3 className="text-yellow-300 text-sm font-bold mb-3">Evento Flash</h3>
          <input value={flashMsg} onChange={e => setFlashMsg(e.target.value)} placeholder="Mensaje del evento..."
            className="w-full bg-black/30 text-white rounded-xl px-4 py-2.5 text-sm mb-2 border border-white/10" />
          <select value={flashRoom} onChange={e => setFlashRoom(e.target.value)}
            className="w-full bg-black/30 text-white rounded-xl px-4 py-2 text-sm mb-2 border border-white/10">
            <option value="">Sala destino (opcional)</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.active_users} activos)</option>)}
          </select>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setFlashScope('global')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold ${flashScope === 'global' ? 'bg-green-500 text-white' : 'bg-white/5 text-white/40'}`}>Global</button>
            <button onClick={() => setFlashScope('regional')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold ${flashScope === 'regional' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/40'}`}>Regional</button>
          </div>
          {flashScope === 'regional' && (
            <select value={flashCountry} onChange={e => setFlashCountry(e.target.value)}
              className="w-full bg-black/30 text-white rounded-xl px-4 py-2 text-sm mb-2 border border-white/10">
              <option value="">Pais destino</option>
              {traffic?.by_country?.map(c => <option key={c.country} value={c.country}>{c.flag} {c.name} ({c.count})</option>)}
            </select>
          )}
          <button onClick={sendFlash} disabled={!!loading}
            className="w-full bg-yellow-500 text-black py-3 rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50">
            {loading === 'flash' ? '...' : 'ENVIAR EVENTO FLASH'}
          </button>
        </div>

        {/* Cofre Activation */}
        <div className="bg-gradient-to-b from-red-900/40 to-rose-900/40 border border-red-500/20 rounded-2xl p-4 mb-4">
          <h3 className="text-red-300 text-sm font-bold mb-3">Activar Cofre Manual</h3>
          <select value={cofreRoom} onChange={e => setCofreRoom(e.target.value)}
            className="w-full bg-black/30 text-white rounded-xl px-4 py-2 text-sm mb-2 border border-white/10">
            <option value="">Seleccionar sala</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-white/40 text-xs">Nivel:</span>
            <input type="range" min="1" max="10" value={cofreLevel} onChange={e => setCofreLevel(parseInt(e.target.value))}
              className="flex-1" />
            <span className="text-yellow-400 text-sm font-bold">{cofreLevel}</span>
          </div>
          <button onClick={activateCofre} disabled={!!loading}
            className="w-full bg-red-500 text-white py-3 rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50">
            {loading === 'cofre' ? '...' : `ACTIVAR COFRE NIVEL ${cofreLevel}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventControlPanel;
