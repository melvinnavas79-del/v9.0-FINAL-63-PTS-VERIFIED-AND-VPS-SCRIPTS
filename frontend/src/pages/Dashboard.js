import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = ({ onNavigate }) => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('popular');
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [subTab, setSubTab] = useState('popular');
  const [unreadCount, setUnreadCount] = useState(0);
  const [weeklyClans, setWeeklyClans] = useState([]);
  const [monthlyClans, setMonthlyClans] = useState([]);
  const [starIndex, setStarIndex] = useState(0);

  useEffect(() => {
    loadRooms();
    loadUsers();
    loadUnreadCount();
    loadClansRankings();
    const n = setInterval(loadUnreadCount, 10000);
    const s = setInterval(() => setStarIndex(p => p + 1), 3000);
    return () => { clearInterval(n); clearInterval(s); };
  }, []);

  const loadRooms = async () => {
    try {
      const res = await axios.get(`${API}/rooms`);
      setRooms(res.data);
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await axios.get(`${API}/rankings/coins`);
      setUsers(res.data);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await axios.get(`${API}/notifications/${user.id}/unread-count`);
      setUnreadCount(res.data.count || 0);
    } catch (err) { console.error(err); }
  };

  const loadClansRankings = async () => {
    try {
      const [w, m] = await Promise.all([
        axios.get(`${API}/rankings/weekly-clans`),
        axios.get(`${API}/rankings/monthly-clans`)
      ]);
      setWeeklyClans(w.data);
      setMonthlyClans(m.data);
    } catch (err) { console.error(err); }
  };

  const openMyRoom = async () => {
    try {
      const res = await axios.post(`${API}/rooms/my-room?user_id=${user.id}`);
      if (res.data && res.data.id) {
        onNavigate('room', res.data.id);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al abrir sala');
    }
  };

  const createRoom = async () => {
    const roomName = prompt('Nombre de la sala:');
    if (!roomName) return;
    try {
      const res = await axios.post(`${API}/rooms?owner_id=${user.id}`, { name: roomName });
      if (res.data && res.data.id) {
        onNavigate('room', res.data.id);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al crear sala');
    }
  };

  const renderMio = () => (
    <div className="p-4">
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { icon: '🏠', label: 'My Room', action: createRoom },
          { icon: '💬', label: 'Quick Join', action: () => { if (rooms.length > 0) onNavigate('room', rooms[0].id); } },
          { icon: '🎬', label: 'Reels', action: () => onNavigate('reels') },
          { icon: '💰', label: 'Tienda', action: () => onNavigate('store') }
        ].map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            data-testid={`mio-btn-${i}`}
            className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 hover:bg-white/20 transition-all flex flex-col items-center"
          >
            <div className="text-3xl mb-1">{item.icon}</div>
            <div className="text-white text-xs font-medium">{item.label}</div>
          </button>
        ))}
      </div>

      <h3 className="text-lg font-bold text-gray-800 mb-3">🔑 Salas Activas</h3>
      <div className="space-y-3">
        {rooms.map(room => (
          <button
            key={room.id}
            data-testid={`room-card-${room.id}`}
            onClick={() => onNavigate('room', room.id)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center text-white text-xl">☔</div>
                <div>
                  <h4 className="font-bold text-gray-800">{room.name}</h4>
                  <p className="text-gray-500 text-sm">Bienvenidos a Lluvia Live</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-blue-500 font-bold">{room.active_users} 👥</div>
              </div>
            </div>
          </button>
        ))}
        {rooms.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-5xl mb-3">🪑</div>
            <p>No hay salas. ¡Crea una!</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPopular = () => {
    const topWeekly = weeklyClans.length > 0 ? weeklyClans : [{name: 'Sin datos'}];
    const topMonthly = monthlyClans.length > 0 ? monthlyClans : [{name: 'Sin datos'}];
    const showIdx = starIndex % 3;
    const isWeekOne = new Date().getDate() <= 7;

    return (
    <div className="p-4">
      {/* Monthly Star Banner - GOLD BACKGROUND */}
      <div className="rounded-2xl p-4 mb-3 overflow-hidden relative" style={{background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'}}>
        <div className="absolute inset-0 opacity-30" style={{background: 'radial-gradient(circle at 50% 50%, #d4a017 0%, transparent 60%)'}} />
        <div className="relative text-center">
          <h2 className="text-sm font-bold text-yellow-400 mb-3" style={{textShadow: '0 0 10px rgba(212,160,23,0.5)'}}>Monthly Star</h2>
          <div className="flex justify-center gap-5">
            <div className="text-center" style={{animation: 'fadeIn 0.5s ease'}}>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-yellow-400 flex items-center justify-center mx-auto mb-1 shadow-lg">
                <span className="text-xl">🏰</span>
              </div>
              <div className="text-xs text-white/60">Clan</div>
            </div>
            <div className="text-center" style={{animation: 'fadeIn 0.5s ease 0.05s both'}}>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 border-2 border-yellow-400 flex items-center justify-center mx-auto mb-1 shadow-lg" style={{animation: 'pulse 2s infinite'}}>
                <span className="text-xl">🦁</span>
              </div>
              <div className="text-xs text-white/60">Recarga</div>
            </div>
            <div className="text-center" style={{animation: 'fadeIn 0.5s ease 0.1s both'}}>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 border-2 border-yellow-400 flex items-center justify-center mx-auto mb-1 shadow-lg">
                <span className="text-xl">💖</span>
              </div>
              <div className="text-xs text-white/60">Pareja</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* WEEKLY CARDS - Original style: lista (cyan), Pareja (pink), Clan (blue) */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* lista */}
        <div className="bg-gradient-to-b from-cyan-200 to-cyan-100 rounded-2xl p-4 text-center shadow-sm">
          <h4 className="font-bold text-gray-800 text-sm mb-2">lista</h4>
          <div className="flex justify-center items-center gap-1 mb-2">
            <div className="w-11 h-11 rounded-full bg-cyan-300 border-2 border-yellow-400 flex items-center justify-center text-sm">🥇</div>
            <div className="w-11 h-11 rounded-full bg-cyan-400 border-2 border-yellow-400 flex items-center justify-center text-sm">🥈</div>
            <div className="w-11 h-11 rounded-full bg-cyan-300 border-2 border-yellow-400 flex items-center justify-center text-sm">🥉</div>
          </div>
          <div className="text-sm font-bold text-gray-800">👑 TOP 3 👑</div>
        </div>

        {/* Pareja */}
        <button data-testid="nav-parejas-btn" onClick={() => onNavigate('parejas')} className="bg-gradient-to-b from-pink-200 to-pink-100 rounded-2xl p-4 text-center shadow-sm hover:scale-105 transition-transform">
          <h4 className="font-bold text-gray-800 text-sm mb-2">Pareja</h4>
          <div className="flex justify-center items-center gap-1 mb-2">
            <div className="w-11 h-11 rounded-full bg-blue-300 border-2 border-yellow-400 flex items-center justify-center text-sm">👤</div>
            <div className="text-xl" style={{animation: 'pulse 1.5s infinite'}}>💖</div>
            <div className="w-11 h-11 rounded-full bg-pink-300 border-2 border-yellow-400 flex items-center justify-center text-sm">👩</div>
          </div>
          <div className="text-sm font-bold text-pink-600">👑 PAREJA 👑</div>
        </button>

        {/* Clan */}
        <button data-testid="nav-clanes-btn" onClick={() => onNavigate('clanes')} className="bg-gradient-to-b from-blue-200 to-blue-100 rounded-2xl p-4 text-center shadow-sm hover:scale-105 transition-transform">
          <h4 className="font-bold text-gray-800 text-sm mb-2">Clan</h4>
          <div className="flex justify-center -space-x-2 mb-2">
            <div className="w-11 h-11 rounded-full bg-yellow-300 border-2 border-yellow-400 flex items-center justify-center text-sm" style={{animation: 'pulse 2s infinite'}}>🦁</div>
            <div className="w-11 h-11 rounded-full bg-blue-300 border-2 border-yellow-400 flex items-center justify-center text-sm">👤</div>
            <div className="w-11 h-11 rounded-full bg-pink-300 border-2 border-yellow-400 flex items-center justify-center text-sm">👩</div>
          </div>
          <div className="text-sm font-bold text-gray-800">👑 TOP 2 👑</div>
        </button>
      </div>

      {/* Popular / Nuevo Sub-tabs */}
      <div className="flex gap-6 mb-4 border-b border-gray-200">
        <button
          onClick={() => setSubTab('popular')}
          className={`pb-2 font-bold transition-all ${subTab === 'popular' ? 'text-gray-800 border-b-2 border-cyan-400' : 'text-gray-400'}`}
        >
          Popular
        </button>
        <button
          onClick={() => setSubTab('nuevo')}
          className={`pb-2 font-bold transition-all ${subTab === 'nuevo' ? 'text-gray-800 border-b-2 border-cyan-400' : 'text-gray-400'}`}
        >
          Nuevo
        </button>
      </div>

      {/* User Feed */}
      <div className="space-y-3 px-1">
        {users.map((u, i) => (
          <div key={u.id || i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <img
                src={u.avatar}
                alt={u.username}
                className="w-16 h-16 rounded-full border-2 border-blue-200 object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1 flex-wrap">
                  <span className="text-blue-500">🦋</span>
                  <span className="font-bold text-gray-800 text-base truncate max-w-[140px]">{u.username}</span>
                  <span className="text-blue-500">🦋</span>
                  <span className="bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">FRIENDS</span>
                </div>
                <div className="flex gap-1 mb-1 text-base">
                  <span>🇨🇴</span>
                  <span>🏆</span>
                  <span>👑</span>
                </div>
                <p className="text-gray-500 text-sm truncate">Nunca hagas cosas que después ...</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-blue-500 font-bold flex items-center gap-1 text-base">
                  <span className="text-lg">📊</span>
                  <span className="whitespace-nowrap">{u.coins >= 1e9 ? `${(u.coins/1e9).toFixed(1)}B` : u.coins >= 1e6 ? `${(u.coins/1e6).toFixed(1)}M` : u.coins?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-5xl mb-3">👥</div>
            <p>No hay usuarios todavía</p>
          </div>
        )}
      </div>
    </div>
  );
  };

  const renderDescubrir = () => (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => onNavigate('reels')}
          className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-6 text-center hover:scale-105 transition-all"
        >
          <div className="text-5xl mb-2">🎬</div>
          <h3 className="text-white font-bold text-lg">Reels</h3>
          <p className="text-white/80 text-sm">Videos cortos</p>
        </button>
        <button
          onClick={() => onNavigate('photos')}
          className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 text-center hover:scale-105 transition-all"
        >
          <div className="text-5xl mb-2">📸</div>
          <h3 className="text-white font-bold text-lg">Fotos</h3>
          <p className="text-white/80 text-sm">Galería</p>
        </button>
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-3">✨ Tendencias</h3>
      <div className="text-center py-8 text-gray-400">
        <div className="text-5xl mb-3">🔍</div>
        <p>Descubre contenido nuevo</p>
      </div>
    </div>
  );

  const renderEvent = () => (
    <div className="p-4">
      {/* 3 Event cards - same style as lista/Pareja/Clan */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* King Event */}
        <div className="bg-gradient-to-b from-yellow-200 to-yellow-100 rounded-2xl p-4 text-center shadow-sm">
          <h4 className="font-bold text-gray-800 text-sm mb-2">King</h4>
          <div className="flex justify-center -space-x-2 mb-2">
            {users.slice(0, 3).length > 0 ? users.slice(0, 3).map((u, i) => (
              <img key={i} src={u.avatar} alt="" className="w-11 h-11 rounded-full border-2 border-yellow-400 object-cover" />
            )) : [1,2,3].map(i => (
              <div key={i} className="w-11 h-11 rounded-full bg-yellow-300 border-2 border-yellow-400 flex items-center justify-center text-sm">👑</div>
            ))}
          </div>
          <div className="text-sm font-bold text-gray-800">👑 TOP 3 👑</div>
        </div>

        {/* CP Event */}
        <div className="bg-gradient-to-b from-pink-200 to-pink-100 rounded-2xl p-4 text-center shadow-sm">
          <h4 className="font-bold text-gray-800 text-sm mb-2">CP Event</h4>
          <div className="flex justify-center -space-x-2 mb-2">
            {users.slice(0, 3).length > 0 ? users.slice(0, 3).map((u, i) => (
              <img key={i} src={u.avatar} alt="" className="w-11 h-11 rounded-full border-2 border-yellow-400 object-cover" />
            )) : [1,2,3].map(i => (
              <div key={i} className="w-11 h-11 rounded-full bg-pink-300 border-2 border-yellow-400 flex items-center justify-center text-sm">💖</div>
            ))}
          </div>
          <div className="text-sm font-bold text-pink-600">👑 TOP 3 👑</div>
        </div>

        {/* Recarga Event */}
        <div className="bg-gradient-to-b from-green-200 to-green-100 rounded-2xl p-4 text-center shadow-sm">
          <h4 className="font-bold text-gray-800 text-sm mb-2">Recarga</h4>
          <div className="flex justify-center -space-x-2 mb-2">
            {users.slice(0, 3).length > 0 ? users.slice(0, 3).map((u, i) => (
              <img key={i} src={u.avatar} alt="" className="w-11 h-11 rounded-full border-2 border-yellow-400 object-cover" />
            )) : [1,2,3].map(i => (
              <div key={i} className="w-11 h-11 rounded-full bg-green-300 border-2 border-yellow-400 flex items-center justify-center text-sm">💰</div>
            ))}
          </div>
          <div className="text-sm font-bold text-gray-800">👑 TOP 3 👑</div>
        </div>
      </div>

      {/* Upcoming Events */}
      <h3 className="text-lg font-bold text-gray-800 mb-3">🎉 Eventos Activos</h3>
      <div className="space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center text-white text-xl">👑</div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800">Evento King Semanal</h4>
              <p className="text-gray-500 text-sm">Top 3 ganan hasta 45M monedas</p>
            </div>
            <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full font-bold">ACTIVO</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center text-white text-xl">💖</div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800">CP Nivel 6 & 7</h4>
              <p className="text-gray-500 text-sm">Parejas compiten por 5M+</p>
            </div>
            <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full font-bold">ACTIVO</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center text-white text-xl">💰</div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800">Recarga Mensual</h4>
              <p className="text-gray-500 text-sm">Top recargadores ganan premios</p>
            </div>
            <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full font-bold">MENSUAL</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Status Bar */}
      <div className="bg-blue-50 px-4 flex items-center justify-between" style={{paddingTop: 'max(8px, env(safe-area-inset-top, 8px))', paddingBottom: '4px'}}>
        <span className="text-gray-600 text-sm font-medium">08:03</span>
        <div className="flex items-center gap-3">
          <span className="text-gray-600 text-sm">📶</span>
          <span className="text-gray-600 text-sm">📡</span>
          <span className="text-green-500 font-bold text-sm">🔋 1K</span>
        </div>
      </div>

      {/* Top Tabs: Mío, Popular, Descubrir, Event */}
      <div className="bg-white/80 backdrop-blur px-4 pt-2">
        <div className="flex items-center gap-1">
          {[
            { id: 'mio', label: 'Mío' },
            { id: 'popular', label: 'Popular' },
            { id: 'descubrir', label: 'Descubrir' },
            { id: 'event', label: 'Event' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-center font-medium transition-all relative ${
                activeTab === tab.id ? 'text-gray-800' : 'text-gray-400'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-cyan-400 rounded-full"></div>
              )}
            </button>
          ))}
          <button data-testid="nav-notifications-btn" onClick={() => onNavigate('notifications')} className="p-2 text-gray-500 text-xl relative">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pb-28">
        {activeTab === 'mio' && renderMio()}
        {activeTab === 'popular' && renderPopular()}
        {activeTab === 'descubrir' && renderDescubrir()}
        {activeTab === 'event' && renderEvent()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 z-50" style={{paddingTop: '10px', paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))'}}>
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button
            data-testid="nav-sala-btn"
            onClick={openMyRoom}
            className="flex flex-col items-center gap-1 min-w-[60px] py-1"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white text-3xl">🎤</span>
            </div>
            <span className="text-xs text-cyan-500 font-semibold">por la sala</span>
          </button>

          <button
            onClick={() => onNavigate('games')}
            className="flex flex-col items-center gap-1 min-w-[60px] py-1"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🎮</span>
            </div>
            <span className="text-xs text-gray-600 font-medium">Juegos</span>
          </button>

          <button
            onClick={() => onNavigate('reels')}
            className="flex flex-col items-center gap-1 min-w-[60px] py-1"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🎬</span>
            </div>
            <span className="text-xs text-gray-600 font-medium">Momento</span>
          </button>

          <button
            onClick={() => onNavigate('photos')}
            className="flex flex-col items-center gap-1 min-w-[60px] py-1"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">📸</span>
            </div>
            <span className="text-xs text-gray-600 font-medium">Fotos</span>
          </button>

          <button
            onClick={() => onNavigate('profile')}
            className="flex flex-col items-center gap-1 min-w-[60px] py-1"
          >
            <img
              src={user.avatar}
              alt="yo"
              className="w-16 h-16 rounded-full border-2 border-gray-200 object-cover"
            />
            <span className="text-xs text-gray-600 font-medium">yo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
