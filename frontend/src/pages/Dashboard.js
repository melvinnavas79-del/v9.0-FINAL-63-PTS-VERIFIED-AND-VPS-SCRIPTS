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
      {/* Weekly Family Star Banner - MONTHLY WINNERS ON TOP */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-3 mb-3 overflow-hidden relative">
        <div className="absolute inset-0 opacity-20" style={{background: 'radial-gradient(circle at 50% 30%, #fbbf24 0%, transparent 70%)'}} />
        <div className="relative">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl" style={{animation: 'pulse 2s infinite'}}>🦁</span>
            <h2 className="text-base font-bold text-yellow-400">Monthly Star</h2>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="bg-white/10 rounded-lg p-1.5" style={{animation: 'fadeIn 0.5s ease'}}>
              <div className="text-[9px] text-white/50">Clan Mensual</div>
              <div className="text-xs font-bold text-yellow-300">{topMonthly[0]?.name || '---'}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-1.5" style={{animation: 'fadeIn 0.5s ease 0.1s both'}}>
              <div className="text-[9px] text-white/50">Pareja Mensual</div>
              <div className="text-xs font-bold text-pink-300">TOP CP</div>
            </div>
            <div className="bg-white/10 rounded-lg p-1.5" style={{animation: 'fadeIn 0.5s ease 0.2s both'}}>
              <div className="text-[9px] text-white/50">Star Mensual</div>
              <div className="text-xs font-bold text-cyan-300">{users[0]?.username || '---'}</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* WEEKLY CARDS - Scrollable */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Clan Semanal */}
        <button data-testid="nav-clanes-btn" onClick={() => onNavigate('clanes')} className="bg-gradient-to-b from-blue-100 to-blue-50 rounded-2xl p-3 text-center hover:scale-105 transition-transform">
          <h4 className="font-bold text-gray-700 text-xs mb-1">Clan Semanal</h4>
          <div className="flex justify-center -space-x-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-yellow-300 border-2 border-yellow-400 flex items-center justify-center text-xs" style={{animation: 'pulse 2s infinite'}}>🦁</div>
            <div className="w-8 h-8 rounded-full bg-blue-300 border-2 border-yellow-400 flex items-center justify-center text-xs">👤</div>
          </div>
          <div className="text-[10px] font-bold text-blue-600">{topWeekly[0]?.name || 'TOP'}</div>
        </button>

        {/* Pareja CP Semanal */}
        <button data-testid="nav-parejas-btn" onClick={() => onNavigate('parejas')} className="bg-gradient-to-b from-pink-100 to-pink-50 rounded-2xl p-3 text-center hover:scale-105 transition-transform">
          <h4 className="font-bold text-gray-700 text-xs mb-1">Pareja CP</h4>
          <div className="flex justify-center items-center gap-0.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-300 border-2 border-yellow-400 flex items-center justify-center text-xs">👤</div>
            <div className="text-sm" style={{animation: 'pulse 1.5s infinite'}}>💖</div>
            <div className="w-8 h-8 rounded-full bg-pink-300 border-2 border-yellow-400 flex items-center justify-center text-xs">👩</div>
          </div>
          <div className="text-[10px] font-bold text-pink-600">PAREJA</div>
        </button>

        {/* Eventos Semanales */}
        <div className="bg-gradient-to-b from-green-100 to-green-50 rounded-2xl p-3 text-center hover:scale-105 transition-transform">
          <h4 className="font-bold text-gray-700 text-xs mb-1">Eventos</h4>
          <div className="flex justify-center -space-x-2 mb-1">
            {users.slice(0, 3).map((u, i) => (
              <img key={i} src={u.avatar} alt="" className="w-8 h-8 rounded-full border-2 border-yellow-400 object-cover" style={{animation: `fadeIn 0.3s ease ${i * 0.1}s both`}} />
            ))}
          </div>
          <div className="text-[10px] font-bold text-green-600">TOP 3</div>
        </div>
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
      <div className="space-y-3">
        {users.map((u, i) => (
          <div key={u.id || i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <img
                src={u.avatar}
                alt={u.username}
                className="w-14 h-14 rounded-full border-2 border-blue-200 object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-500">🦋</span>
                  <span className="font-bold text-gray-800">{u.username}</span>
                  <span className="text-blue-500">🦋</span>
                  <span className="bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">FRIENDS</span>
                </div>
                <div className="flex gap-1 mb-1">
                  <span>🇨🇴</span>
                  <span>🏆</span>
                  <span>👑</span>
                </div>
                <p className="text-gray-500 text-sm truncate">Nunca hagas cosas que después ...</p>
              </div>
              <div className="text-right">
                <div className="text-blue-500 font-bold flex items-center gap-1">
                  <span className="text-lg">📊</span> {u.coins?.toLocaleString() || 0}
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
    <div className="p-4 text-center py-12">
      <div className="text-6xl mb-4">🎉</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">Eventos</h3>
      <p className="text-gray-500">Próximamente eventos especiales</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Status Bar */}
      <div className="bg-blue-50 px-4 py-2 flex items-center justify-between">
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
      <div className="pb-24">
        {activeTab === 'mio' && renderMio()}
        {activeTab === 'popular' && renderPopular()}
        {activeTab === 'descubrir' && renderDescubrir()}
        {activeTab === 'event' && renderEvent()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-50">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button
            data-testid="nav-sala-btn"
            onClick={openMyRoom}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xl">🎤</span>
            </div>
            <span className="text-xs text-cyan-500 font-medium">por la sala</span>
          </button>

          <button
            onClick={() => onNavigate('games')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎮</span>
            </div>
            <span className="text-xs text-gray-500">Juegos</span>
          </button>

          <button
            onClick={() => onNavigate('reels')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎬</span>
            </div>
            <span className="text-xs text-gray-500">Momento</span>
          </button>

          <button
            onClick={() => onNavigate('photos')}
            className="flex flex-col items-center gap-1 relative"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📸</span>
            </div>
            <span className="text-xs text-gray-500">Fotos</span>
          </button>

          <button
            onClick={() => onNavigate('profile')}
            className="flex flex-col items-center gap-1"
          >
            <img
              src={user.avatar}
              alt="yo"
              className="w-12 h-12 rounded-full border-2 border-gray-200 object-cover"
            />
            <span className="text-xs text-gray-500">yo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
