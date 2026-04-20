import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ParejasView = ({ onBack }) => {
  const { user, updateUser } = useUser();
  const [parejas, setParejas] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadParejas(); loadAllUsers(); }, []);

  const loadParejas = async () => {
    try {
      const res = await axios.get(`${API}/cp`);
      setParejas(res.data);
    } catch (err) { /* silent */ }
  };

  const loadAllUsers = async () => {
    try {
      const res = await axios.get(`${API}/rankings/coins`);
      setAllUsers(res.data.filter(u => u.id !== user.id));
    } catch (err) { /* silent */ }
  };

  const createPareja = async (partnerId) => {
    setLoading(true);
    try {
      await axios.post(`${API}/cp/create`, { user1_id: user.id, user2_id: partnerId });
      setShowCreate(false);
      setSearchUser('');
      loadParejas();
      const res = await axios.get(`${API}/users/${user.id}`);
      updateUser(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al crear pareja');
    }
    setLoading(false);
  };

  const myCp = user.cp_id || null;
  const filtered = allUsers.filter(u => u.username?.toLowerCase().includes(searchUser.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-900 via-rose-900 to-purple-900">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button data-testid="parejas-back-btn" onClick={onBack} className="bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur border border-white/20">← Volver</button>
          <h1 className="text-xl font-bold text-white">Parejas (CP)</h1>
          {!myCp && (
            <button data-testid="create-pareja-btn" onClick={() => setShowCreate(!showCreate)} className="bg-pink-500 text-white px-4 py-2 rounded-full text-sm font-bold">+ Crear</button>
          )}
          {myCp && <div />}
        </div>

        {/* Create Pareja Form */}
        {showCreate && !myCp && (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 mb-4">
            <h3 className="text-white font-bold mb-3">Elegir tu pareja</h3>
            <input
              data-testid="search-partner-input"
              type="text"
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              placeholder="Buscar usuario..."
              className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-3 mb-3 outline-none"
            />
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filtered.slice(0, 10).map(u => (
                <button
                  key={u.id}
                  data-testid={`select-partner-${u.id}`}
                  onClick={() => createPareja(u.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/15 p-3 rounded-xl transition-all"
                >
                  <img src={u.avatar} alt="" className="w-10 h-10 rounded-full" />
                  <div className="text-left flex-1">
                    <span className="text-white font-bold text-sm">{u.username}</span>
                    <p className="text-white/50 text-xs">Nivel {u.level}</p>
                  </div>
                  <span className="text-pink-400 text-xs font-bold">Elegir</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-white/40 text-center text-sm py-4">No se encontraron usuarios</p>
              )}
            </div>
          </div>
        )}

        {/* My Pareja Info */}
        {myCp && (
          <div className="bg-gradient-to-r from-pink-500/20 to-rose-500/20 backdrop-blur border border-pink-500/30 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">💖</span>
              <span className="text-pink-300 font-bold">Tu Pareja: {user.cp_partner}</span>
            </div>
            <p className="text-white/60 text-sm">Ya tienes pareja registrada</p>
          </div>
        )}

        {/* Parejas Ranking */}
        <h3 className="text-white/70 font-bold text-sm mb-3">Ranking de Parejas</h3>
        <div className="space-y-3">
          {parejas.map((cp, i) => (
            <div key={cp.id} className="bg-white/10 backdrop-blur border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                    i === 0 ? 'bg-yellow-500/30' : i === 1 ? 'bg-gray-400/30' : i === 2 ? 'bg-orange-500/30' : 'bg-white/10'
                  }`}>
                    {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">{cp.user1_name} 💖 {cp.user2_name}</h4>
                    <p className="text-white/50 text-xs">Nivel CP: {cp.level} {cp.ring ? `| 💍 ${cp.ring}` : ''}</p>
                    <p className="text-pink-400 text-xs font-bold">{(cp.total_coins || 0).toLocaleString()} coins</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {parejas.length === 0 && (
            <div className="text-center py-12 text-white/40">
              <div className="text-5xl mb-3">💕</div>
              <p>No hay parejas todavia. Crea la primera!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParejasView;
