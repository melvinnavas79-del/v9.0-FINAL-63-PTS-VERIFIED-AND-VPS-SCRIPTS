import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ClanesView = ({ onBack }) => {
  const { user, updateUser } = useUser();
  const [clanes, setClanes] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [clanName, setClanName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadClanes(); }, []);

  const loadClanes = async () => {
    try {
      const res = await axios.get(`${API}/clanes`);
      setClanes(res.data);
    } catch (err) { /* silent */ }
  };

  const createClan = async () => {
    if (!clanName.trim()) return;
    setLoading(true);
    try {
      await axios.post(`${API}/clanes`, { name: clanName, owner_id: user.id });
      setClanName('');
      setShowCreate(false);
      loadClanes();
      const res = await axios.get(`${API}/users/${user.id}`);
      updateUser(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al crear clan');
    }
    setLoading(false);
  };

  const joinClan = async (clanId) => {
    try {
      await axios.post(`${API}/clanes/${clanId}/join?user_id=${user.id}`);
      loadClanes();
      const res = await axios.get(`${API}/users/${user.id}`);
      updateUser(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error');
    }
  };

  const leaveClan = async (clanId) => {
    try {
      await axios.post(`${API}/clanes/${clanId}/leave?user_id=${user.id}`);
      loadClanes();
      const res = await axios.get(`${API}/users/${user.id}`);
      updateUser(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error');
    }
  };

  const myClanId = user.clan_id || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-indigo-900 to-purple-900">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button data-testid="clanes-back-btn" onClick={onBack} className="bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur border border-white/20">← Volver</button>
          <h1 className="text-xl font-bold text-white">Clanes</h1>
          <button data-testid="create-clan-btn" onClick={() => setShowCreate(!showCreate)} className="bg-cyan-500 text-white px-4 py-2 rounded-full text-sm font-bold">+ Crear</button>
        </div>

        {/* Create Clan Form */}
        {showCreate && (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 mb-4">
            <h3 className="text-white font-bold mb-3">Crear nuevo Clan</h3>
            <input
              data-testid="clan-name-input"
              type="text"
              value={clanName}
              onChange={e => setClanName(e.target.value)}
              placeholder="Nombre del Clan..."
              className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-3 mb-3 outline-none"
            />
            <button
              data-testid="confirm-create-clan-btn"
              onClick={createClan}
              disabled={loading || !clanName.trim()}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Clan'}
            </button>
          </div>
        )}

        {/* My Clan Info */}
        {myClanId && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur border border-yellow-500/30 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏆</span>
              <span className="text-yellow-300 font-bold">Tu Clan: {user.clan_name}</span>
            </div>
            <p className="text-white/60 text-sm">Ya perteneces a un clan</p>
          </div>
        )}

        {/* Clanes List */}
        <h3 className="text-white/70 font-bold text-sm mb-3">Ranking de Clanes</h3>
        <div className="space-y-3">
          {clanes.map((clan, i) => {
            const isMember = clan.members?.includes(user.id);
            const isOwner = clan.owner_id === user.id;
            return (
              <div key={clan.id} className="bg-white/10 backdrop-blur border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                      i === 0 ? 'bg-yellow-500/30 text-yellow-300' :
                      i === 1 ? 'bg-gray-400/30 text-gray-300' :
                      i === 2 ? 'bg-orange-500/30 text-orange-300' :
                      'bg-white/10 text-white/60'
                    }`}>
                      #{i + 1}
                    </div>
                    <div>
                      <h4 className="text-white font-bold">{clan.name}</h4>
                      <p className="text-white/50 text-xs">Lider: {clan.owner_name} | {clan.members?.length || 0} miembros</p>
                      <p className="text-cyan-400 text-xs font-bold">{(clan.weekly_coins || 0).toLocaleString()} coins semanales</p>
                    </div>
                  </div>
                  <div>
                    {isOwner ? (
                      <span className="bg-yellow-500/20 text-yellow-300 text-xs px-3 py-1 rounded-full font-bold">Lider</span>
                    ) : isMember ? (
                      <button data-testid={`leave-clan-${clan.id}`} onClick={() => leaveClan(clan.id)} className="bg-red-500/20 text-red-300 text-xs px-3 py-2 rounded-full font-bold">Salir</button>
                    ) : !myClanId ? (
                      <button data-testid={`join-clan-${clan.id}`} onClick={() => joinClan(clan.id)} className="bg-cyan-500 text-white text-xs px-3 py-2 rounded-full font-bold">Unirse</button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {clanes.length === 0 && (
            <div className="text-center py-12 text-white/40">
              <div className="text-5xl mb-3">🏰</div>
              <p>No hay clanes todavia. Crea el primero!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClanesView;
