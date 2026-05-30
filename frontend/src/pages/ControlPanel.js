import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';
import SuperAdminTools from '../components/SuperAdminTools';
import SystemHealthPanel from '../components/SystemHealthPanel';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ControlPanel = ({ onBack }) => {
  const { user } = useUser();
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [clanes, setClanes] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('salas');
  const [searchQuery, setSearchQuery] = useState('');

  // Event Creator
  const [eventName, setEventName] = useState('');
  const [eventPrize1, setEventPrize1] = useState(45000000);
  const [eventPrize2, setEventPrize2] = useState(35000000);
  const [eventPrize3, setEventPrize3] = useState(25000000);

  // Clan Prizes
  const [clanPrize1, setClanPrize1] = useState(25000000);
  const [clanPrize2, setClanPrize2] = useState(20000000);
  const [clanPrize3, setClanPrize3] = useState(15000000);

  // Config
  const [config, setConfig] = useState({
    gift_rosa_price: 100,
    gift_corazon_price: 500,
    gift_diamante_price: 5000,
    gift_corona_price: 10000,
    gift_dragon_price: 50000,
    slot_min_bet: 100,
    slot_max_bet: 1000000,
    king_level_bonus: 3000000,
    cp_level6_bonus: 5000000,
    cp_level7_bonus: 5000000,
    baby_robot_goal: 25000000,
    baby_robot_prize: 15000000,
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [u, r, c, e] = await Promise.all([
        axios.get(`${API}/admin/users?admin_id=${user.id}`),
        axios.get(`${API}/rooms`),
        axios.get(`${API}/clanes`),
        axios.get(`${API}/events/history`),
      ]);
      setUsers(u.data);
      setRooms(r.data);
      setClanes(c.data);
      setEvents(e.data);
    } catch (err) { /* silent */ }
  };

  const updateUserField = async (userId, field, value) => {
    try {
      await axios.put(`${API}/admin/users/${userId}?admin_id=${user.id}`, { [field]: value });
      loadAll();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const setRole = async (userId, role) => {
    try {
      await axios.post(`${API}/admin/set-role?user_id=${userId}&admin_id=${user.id}&role=${role}`);
      loadAll();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const verifyUser = async (userId) => {
    try {
      await axios.post(`${API}/admin/verify-user?user_id=${userId}&admin_id=${user.id}`);
      loadAll();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const [consoleCmd, setConsoleCmd] = useState('');
  const [consoleTarget, setConsoleTarget] = useState('');
  const [consoleValue, setConsoleValue] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [roomMaxSeats, setRoomMaxSeats] = useState(9);

  // Store config
  const [storePackages, setStorePackages] = useState([
    { id: 'custom_1', name: 'Pack 1', coins: 50000, diamonds: 100, price: 5 },
    { id: 'custom_2', name: 'Pack 2', coins: 150000, diamonds: 300, price: 10 },
    { id: 'custom_3', name: 'Pack 3', coins: 500000, diamonds: 1000, price: 25 },
    { id: 'custom_4', name: 'Pack 4', coins: 1200000, diamonds: 3000, price: 50 },
  ]);

  const runConsole = async (action) => {
    const target = consoleTarget;
    if (!target && action !== 'broadcast') return alert('Selecciona un usuario');
    // Confirmación de rango para acciones destructivas / Aristocracia alta
    if (action === 'set-aristocracy') {
      const lvl = Number(consoleValue);
      if (isNaN(lvl) || lvl < 0 || lvl > 10) return alert('Aristocracia debe ser 0-10');
      if (lvl >= 6 && !window.confirm(`⚠️ Aristocracia nivel ${lvl} es un rango ALTO. ¿Confirmas otorgar este rango al usuario ${target}?`)) return;
    }
    if (action === 'give-diamonds' && Math.abs(Number(consoleValue)) > 100000) {
      if (!window.confirm(`⚠️ Vas a ${Number(consoleValue) >= 0 ? 'dar' : 'quitar'} ${Math.abs(Number(consoleValue)).toLocaleString()} diamantes. ¿Confirmas?`)) return;
    }
    if (action === 'ban' && !window.confirm(`🚫 ¿Confirmas BANEAR al usuario ${target}? Quedará bloqueado de toda la plataforma.`)) return;
    try {
      let res;
      switch(action) {
        case 'give-coins':
          res = await axios.post(`${API}/admin/console/give-coins?admin_id=${user.id}&target_id=${target}&amount=${Number(consoleValue)}`);
          break;
        case 'give-diamonds':
          res = await axios.post(`${API}/admin/console/give-diamonds?admin_id=${user.id}&target_id=${target}&amount=${Number(consoleValue)}`);
          break;
        case 'set-level':
          res = await axios.post(`${API}/admin/console/set-level?admin_id=${user.id}&target_id=${target}&level=${Number(consoleValue)}`);
          break;
        case 'set-aristocracy':
          res = await axios.post(`${API}/admin/console/set-aristocracy?admin_id=${user.id}&target_id=${target}&aristocracy=${Number(consoleValue)}`);
          break;
        case 'verify':
          res = await axios.post(`${API}/admin/verify-user?user_id=${target}&admin_id=${user.id}`);
          break;
        case 'ban':
          res = await axios.post(`${API}/admin/console/ban?admin_id=${user.id}&target_id=${target}`);
          break;
        case 'unban':
          res = await axios.post(`${API}/admin/console/unban?admin_id=${user.id}&target_id=${target}`);
          break;
        case 'broadcast':
          res = await axios.post(`${API}/admin/console/broadcast?admin_id=${user.id}&message=${encodeURIComponent(broadcastMsg)}`);
          setBroadcastMsg('');
          break;
        default: break;
      }
      alert('✓ Ejecutado');
      loadAll();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const saveConfig = async () => {
    try {
      await axios.put(`${API}/admin/config?admin_id=${user.id}`, config);
      alert('Configuracion guardada!');
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const banUser = async (userId) => {
    if (!window.confirm('¿Banear este usuario?')) return;
    try {
      await axios.put(`${API}/admin/users/${userId}?admin_id=${user.id}`, { banned: true, vip_status: 'BANNED' });
      loadAll();
    } catch (err) { alert('Error'); }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('¿ELIMINAR este usuario permanentemente?')) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}?admin_id=${user.id}`);
      loadAll();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const distributeWeekly = async () => {
    if (!window.confirm(`¿Repartir premios semanales?\n1° = ${(eventPrize1).toLocaleString()}\n2° = ${(eventPrize2).toLocaleString()}\n3° = ${(eventPrize3).toLocaleString()}`)) return;
    try {
      const res = await axios.post(`${API}/events/weekly-rewards?admin_id=${user.id}`);
      alert(`Premios repartidos:\n${res.data.results.map(r => `${r.place}° ${r.username}: +${r.reward.toLocaleString()}`).join('\n')}`);
      loadAll();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const distributeClanRewards = async () => {
    if (!window.confirm(`¿Repartir premios de clanes?\n1° = ${clanPrize1.toLocaleString()}\n2° = ${clanPrize2.toLocaleString()}\n3° = ${clanPrize3.toLocaleString()}`)) return;
    try {
      const res = await axios.post(`${API}/events/clan-rewards?admin_id=${user.id}`, {
        prizes: [clanPrize1, clanPrize2, clanPrize3]
      });
      alert(`Premios de clanes:\n${res.data.results.map(r => `${r.place}° ${r.clan}: +${r.total_reward.toLocaleString()}`).join('\n')}`);
      loadAll();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const triggerBabyRobot = async () => {
    try {
      const res = await axios.post(`${API}/events/baby-robot?admin_id=${user.id}`);
      if (res.data.success) {
        alert(`🤖 BEBÉ ROBOT ACTIVADO\nBono por usuario: ${res.data.bonus_per_user.toLocaleString()}\nUsuarios: ${res.data.users_rewarded}`);
      } else {
        alert(`Meta no alcanzada. Total: ${res.data.total_global.toLocaleString()} / ${res.data.needed.toLocaleString()}`);
      }
      loadAll();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id?.includes(searchQuery) ||
    u.custom_id?.includes(searchQuery)
  );

  const roleCounts = {
    dueño: users.filter(u => u.role === 'dueño').length,
    admin: users.filter(u => u.role === 'admin').length,
    moderador: users.filter(u => u.role === 'moderador').length,
    supervisor: users.filter(u => u.role === 'supervisor').length,
    usuario: users.filter(u => !u.role || u.role === 'usuario').length,
  };

  const totalCoins = users.reduce((a, u) => a + (u.coins || 0), 0);

  const tabs = [
    { id: 'salas', label: 'Salas', icon: '🏠' },
    { id: 'config', label: 'Config', icon: '⚙️' },
    { id: 'console', label: 'Consola', icon: '💻' },
    { id: 'techconsole', label: 'Script Runner', icon: '⚡' },
    { id: 'economy', label: 'Economía', icon: '🏦' },
    { id: 'agents', label: 'Agentes', icon: '🧑‍💼' },
    { id: 'bot', label: 'Bot IA', icon: '🤖' },
    { id: 'security', label: 'Seguridad', icon: '🛡️' },
    { id: 'health', label: 'Salud', icon: '🩺' },
    { id: 'diagnostics', label: 'Diagnósticos', icon: '🔬' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-600 p-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button onClick={onBack} className="bg-black/30 text-white px-4 py-2 rounded-full text-sm">← Volver</button>
          <h1 className="text-xl font-black">👑 CONTROL MAESTRO</h1>
          <span className="text-sm font-bold bg-black/30 px-3 py-1 rounded-full">☔ Lluvia Live</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 overflow-x-auto">
        <div className="flex max-w-6xl mx-auto">
          {tabs.map(tab => (
            <button key={tab.id} data-testid={`ctrl-tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">

        {/* DASHBOARD */}
        {activeTab === 'salas' && (
          <>
          {/* PANEL MAESTRO - Stats */}
          <div>
            {/* Flash de Fama - Top 1 */}
            {users.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 rounded-2xl p-6 mb-6 text-center">
                <p className="text-yellow-200 text-sm font-bold mb-2">⭐ FLASH DE FAMA ⭐</p>
                <img src={users[0]?.avatar} alt="" className="w-20 h-20 rounded-full mx-auto mb-2 border-4 border-yellow-300" />
                <h2 className="text-2xl font-black text-white">{users[0]?.username}</h2>
                <p className="text-yellow-200">👑 TOP 1 - {users[0]?.coins?.toLocaleString()} monedas</p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
                <div className="text-3xl font-black text-yellow-400">{users.length}</div>
                <div className="text-gray-500 text-xs">Usuarios</div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
                <div className="text-3xl font-black text-blue-400">{rooms.length}</div>
                <div className="text-gray-500 text-xs">Salas</div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
                <div className="text-3xl font-black text-green-400">{clanes.length}</div>
                <div className="text-gray-500 text-xs">Clanes</div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
                <div className="text-3xl font-black text-pink-400">{totalCoins.toLocaleString()}</div>
                <div className="text-gray-500 text-xs">Total Monedas</div>
              </div>
            </div>

            {/* Roles */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {Object.entries(roleCounts).map(([role, count]) => (
                <div key={role} className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
                  <div className="text-xl font-bold text-white">{count}</div>
                  <div className="text-gray-500 text-xs capitalize">{role}s</div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <h3 className="text-lg font-bold text-yellow-400 mb-3">⚡ Acciones Rapidas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button onClick={distributeWeekly} className="bg-gradient-to-r from-yellow-600 to-amber-600 p-4 rounded-xl font-bold text-sm">
                🏆 Premios Semanales
              </button>
              <button onClick={distributeClanRewards} className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 rounded-xl font-bold text-sm">
                🏷️ Premios Clanes
              </button>
              <button onClick={triggerBabyRobot} className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 rounded-xl font-bold text-sm">
                🤖 Bebe Robot
              </button>
              <button onClick={async () => {
                if (!window.confirm('Repartir cashback semanal?')) return;
                try {
                  const r = await axios.post(`${API}/events/cashback?admin_id=${user.id}`);
                  alert(`Cashback repartido a ${r.data.total_users} usuarios:\n${r.data.results.map(r => `${r.username}: +${r.cashback.toLocaleString()}`).join('\n') || 'Ningun usuario califica (min 100M gastados)'}`);
                  loadAll();
                } catch (err) { alert(err.response?.data?.detail || 'Error'); }
              }} className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-xl font-bold text-sm">
                💸 Cashback Semanal
              </button>
            </div>
          </div>

          {/* USERS */}
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white mb-3">Usuarios ({users.length})</h3>
            <div className="mb-4">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="🔍 Buscar por nombre o ID..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500" />
            </div>
            <div className="space-y-2">
              {filteredUsers.map(u => (
                <div key={u.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt="" className="w-10 h-10 rounded-full" />
                      <div>
                        <div className="font-bold text-sm">{u.username} {u.role === 'dueño' && '👑'}</div>
                        <div className="text-gray-500 text-xs">Lv.{u.level} | 💰{u.coins?.toLocaleString()} | {u.role || 'usuario'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {u.role !== 'dueño' && (
                        <>
                          <select value={u.role || 'usuario'} onChange={e => setRole(u.id, e.target.value)}
                            className="bg-gray-800 text-xs rounded-lg px-2 py-1 border border-gray-700">
                            <option value="admin">⭐ Admin</option>
                            <option value="moderador">🛡️ Mod</option>
                            <option value="supervisor">👁️ Sup</option>
                            <option value="usuario">👤 User</option>
                          </select>
                          <button onClick={() => updateUserField(u.id, 'coins', (u.coins || 0) + 10000000)}
                            className="bg-green-900 text-green-400 px-2 py-1 rounded text-xs">+10M</button>
                          <button onClick={() => verifyUser(u.id)}
                            className="bg-cyan-900 text-cyan-400 px-2 py-1 rounded text-xs">✅</button>
                          <button onClick={() => updateUserField(u.id, 'level', Math.min((u.level || 1) + 10, 99))}
                            className="bg-blue-900 text-blue-400 px-2 py-1 rounded text-xs">+10Lv</button>
                          <button onClick={() => updateUserField(u.id, 'aristocracy', Math.min((u.aristocracy || 0) + 1, 9))}
                            className="bg-purple-900 text-purple-400 px-2 py-1 rounded text-xs">+Arist</button>
                          <button onClick={async () => {
                            try {
                              const hasGif = u.gif_permission;
                              const endpoint = hasGif ? 'revoke-gif' : 'grant-gif';
                              await axios.post(`${API}/admin/${endpoint}/${u.id}?admin_id=${user.id}`);
                              loadAll();
                            } catch (err) { alert(err.response?.data?.detail || 'Error'); }
                          }}
                            className={`px-2 py-1 rounded text-xs ${u.gif_permission ? 'bg-yellow-900 text-yellow-400' : 'bg-gray-800 text-gray-400'}`}>
                            {u.gif_permission ? '🎞️ GIF ON' : '🎞️ GIF'}</button>
                          <button onClick={() => banUser(u.id)}
                            className="bg-orange-900 text-orange-400 px-2 py-1 rounded text-xs">Ban</button>
                          <button onClick={() => deleteUser(u.id)}
                            className="bg-red-900 text-red-400 px-2 py-1 rounded text-xs">X</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>
        )}

        {/* CONFIG - All Config in one block */}
        {activeTab === 'config' && (
          <div>
            <h3 className="text-lg font-bold text-yellow-400 mb-4">⚙️ Configuracion General</h3>
            
            {/* Weekly Events */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
              <h4 className="font-bold text-white mb-3">📅 Evento Semanal - Top 3</h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-gray-500 text-xs">🥇 1er lugar</label>
                  <input type="number" value={eventPrize1} onChange={e => setEventPrize1(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-yellow-400 font-bold" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">🥈 2do lugar</label>
                  <input type="number" value={eventPrize2} onChange={e => setEventPrize2(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 font-bold" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">🥉 3er lugar</label>
                  <input type="number" value={eventPrize3} onChange={e => setEventPrize3(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-orange-400 font-bold" />
                </div>
              </div>
              <button onClick={distributeWeekly}
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 py-3 rounded-xl font-bold">
                🏆 REPARTIR PREMIOS SEMANALES
              </button>
            </div>

            {/* Clanes Prizes */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
              <h4 className="font-bold text-white mb-3">🏷️ Premios Clanes</h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-gray-500 text-xs">🥇 1er Clan</label>
                  <input type="number" value={clanPrize1} onChange={e => setClanPrize1(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-yellow-400 font-bold" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">🥈 2do Clan</label>
                  <input type="number" value={clanPrize2} onChange={e => setClanPrize2(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 font-bold" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">🥉 3er Clan</label>
                  <input type="number" value={clanPrize3} onChange={e => setClanPrize3(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-orange-400 font-bold" />
                </div>
              </div>
              <p className="text-gray-500 text-xs mb-3">+ Aristocracia: 1°=Lv6 | 2°=Lv5 | 3°=Lv4</p>
              <button onClick={distributeClanRewards}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 py-3 rounded-xl font-bold">
                🏷️ REPARTIR PREMIOS CLANES
              </button>
            </div>

            {/* Baby Robot */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
              <h4 className="font-bold text-white mb-3">🤖 Bebe Robot</h4>
              <p className="text-gray-400 text-sm mb-3">Meta global: 25M → Bono 15M repartido</p>
              <button onClick={triggerBabyRobot}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 py-3 rounded-xl font-bold">
                🤖 ACTIVAR BEBE ROBOT
              </button>
            </div>

            {/* System Config */}
            <h4 className="font-bold text-white mb-3">🔧 Precios y Valores</h4>
            <div className="space-y-3 mb-6">
              {Object.entries(config).map(([key, value]) => (
                <div key={key} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                  <span className="text-gray-300 text-xs">{key.replace(/_/g, ' ').toUpperCase()}</span>
                  <input type="number" value={value}
                    onChange={e => setConfig(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-yellow-400 font-bold w-28 text-right text-sm" />
                </div>
              ))}
              <button onClick={saveConfig} data-testid="save-config-btn" className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 py-3 rounded-xl font-bold">Guardar Config</button>
            </div>

            {/* Prizes */}
            <PrizesConfig userId={user.id} />
            
            {/* Rooms */}
            <h4 className="text-white font-bold mt-6 mb-3">Salas ({rooms.length})</h4>
            <div className="space-y-2 mb-4">
              {rooms.map(r => (
                <div key={r.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold text-sm">{r.name}</div>
                    <div className="text-gray-500 text-xs">{r.owner_name} | {r.active_users} online</div>
                  </div>
                  <button onClick={async () => {
                    if (!window.confirm('Eliminar sala?')) return;
                    await axios.delete(`${API}/admin/rooms/${r.id}?admin_id=${user.id}`);
                    loadAll();
                  }} className="bg-red-900 text-red-400 px-3 py-1 rounded-lg text-xs font-bold">X</button>
                </div>
              ))}
            </div>

            {/* Clanes */}
            <h4 className="text-white font-bold mb-3">Clanes ({clanes.length})</h4>
            <div className="space-y-2">
              {clanes.map((c, i) => (
                <div key={c.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex justify-between">
                  <div>
                    <span className="text-yellow-400 font-bold mr-1">#{i+1}</span>
                    <span className="text-white font-bold text-sm">{c.name}</span>
                    <span className="text-gray-500 text-xs ml-1">by {c.owner_name}</span>
                  </div>
                  <span className="text-gray-400 text-xs">{c.members?.length || 0} miembros</span>
                </div>
              ))}
            </div>

            {/* History */}
            <h4 className="font-bold text-white mt-6 mb-2">📜 Historial de Eventos</h4>
            <div className="space-y-2">
              {events.map(e => (
                <div key={e.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-sm">
                  <span className="text-yellow-400 font-bold">{e.type}</span>
                  <span className="text-gray-500 ml-2">{e.created_at?.split('T')[0]}</span>
                </div>
              ))}
              {events.length === 0 && <p className="text-gray-600 text-center py-4">Sin eventos registrados</p>}
            </div>
          </div>
        )}

        {/* CONSOLE */}
        {activeTab === 'console' && (
          <div>
            <h3 className="text-lg font-bold text-yellow-400 mb-4">💻 Consola de Comandos</h3>
            
            {/* Select User */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
              <label className="text-gray-400 text-sm mb-2 block">👤 Usuario objetivo:</label>
              <select value={consoleTarget} onChange={e => setConsoleTarget(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white">
                <option value="">-- Seleccionar --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username} (Lv.{u.level}) {u.verified ? '✅' : ''}</option>
                ))}
              </select>
            </div>

            {/* Value Input */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
              <label className="text-gray-400 text-sm mb-2 block">🔢 Valor:</label>
              <input type="number" value={consoleValue} onChange={e => setConsoleValue(e.target.value)}
                placeholder="Cantidad"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button data-testid="console-give-coins" onClick={() => runConsole('give-coins')} className="bg-green-800 text-green-300 p-3 rounded-xl font-bold text-sm">💰 Dar Monedas</button>
              <button data-testid="console-give-diamonds" onClick={() => runConsole('give-diamonds')} className="bg-sky-800 text-sky-300 p-3 rounded-xl font-bold text-sm">💎 Dar Diamantes</button>
              <button data-testid="console-set-level" onClick={() => runConsole('set-level')} className="bg-blue-800 text-blue-300 p-3 rounded-xl font-bold text-sm">⬆️ Set Nivel</button>
              <button data-testid="console-set-aristocracy" onClick={() => runConsole('set-aristocracy')} className="bg-purple-800 text-purple-300 p-3 rounded-xl font-bold text-sm">👑 Set Aristocracia</button>
              <button data-testid="console-verify" onClick={() => runConsole('verify')} className="bg-cyan-800 text-cyan-300 p-3 rounded-xl font-bold text-sm">✅ Verificar</button>
              <button data-testid="console-ban" onClick={() => runConsole('ban')} className="bg-red-800 text-red-300 p-3 rounded-xl font-bold text-sm">🚫 Banear</button>
              <button data-testid="console-unban" onClick={() => runConsole('unban')} className="bg-yellow-800 text-yellow-300 p-3 rounded-xl font-bold text-sm">🔓 Desbanear</button>
            </div>

            {/* Broadcast */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
              <h4 className="text-white font-bold mb-2">📢 Mensaje Global</h4>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                placeholder="Escribe un mensaje para todos los usuarios..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white h-20 resize-none mb-3" />
              <button onClick={() => runConsole('broadcast')}
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 py-3 rounded-xl font-bold">
                📢 ENVIAR A TODOS
              </button>
            </div>

            {/* Room Mic Expansion */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
              <h4 className="text-white font-bold mb-2">🎤 Expandir Micros de Sala</h4>
              <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-3">
                <option value="">-- Seleccionar Sala --</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.max_seats || 9} micros)</option>
                ))}
              </select>
              <div className="flex gap-2 mb-3">
                {[9, 12, 16, 20, 24].map(n => (
                  <button key={n} onClick={() => setRoomMaxSeats(n)}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm ${roomMaxSeats === n ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={async () => {
                if (!selectedRoom) return alert('Selecciona una sala');
                try {
                  await axios.post(`${API}/admin/console/expand-room?admin_id=${user.id}&room_id=${selectedRoom}&max_seats=${roomMaxSeats}`);
                  alert(`Sala expandida a ${roomMaxSeats} micros`);
                  loadAll();
                } catch (err) { alert(err.response?.data?.detail || 'Error'); }
              }} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 py-3 rounded-xl font-bold">
                🎤 EXPANDIR MICROS
              </button>
            </div>

            {/* Store Config */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h4 className="text-white font-bold mb-3">💰 Configurar Precios de Tienda</h4>
              {storePackages.map((pkg, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input type="text" value={pkg.name} onChange={e => {
                    const arr = [...storePackages]; arr[i].name = e.target.value; setStorePackages(arr);
                  }} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs w-24" placeholder="Nombre" />
                  <input type="number" value={pkg.coins} onChange={e => {
                    const arr = [...storePackages]; arr[i].coins = Number(e.target.value); setStorePackages(arr);
                  }} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-yellow-400 text-xs w-24" placeholder="Monedas" />
                  <input type="number" value={pkg.diamonds} onChange={e => {
                    const arr = [...storePackages]; arr[i].diamonds = Number(e.target.value); setStorePackages(arr);
                  }} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-cyan-400 text-xs w-20" placeholder="Diamantes" />
                  <span className="text-white text-xs">$</span>
                  <input type="number" value={pkg.price} onChange={e => {
                    const arr = [...storePackages]; arr[i].price = Number(e.target.value); setStorePackages(arr);
                  }} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-green-400 text-xs w-16" placeholder="Precio" />
                </div>
              ))}
              <button onClick={async () => {
                try {
                  for (const pkg of storePackages) {
                    await axios.post(`${API}/admin/console/update-store?admin_id=${user.id}&package_id=${pkg.id}&coins=${pkg.coins}&diamonds=${pkg.diamonds}&price=${pkg.price}&name=${encodeURIComponent(pkg.name)}`);
                  }
                  alert('Precios actualizados');
                } catch (err) { alert('Error'); }
              }} className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 py-3 rounded-xl font-bold mt-3">
                💾 GUARDAR PRECIOS
              </button>
            </div>
          </div>
        )}

        {/* BOT IA */}
        {activeTab === 'bot' && (
          <BotTab userId={user.id} />
        )}

        {/* SCRIPT RUNNER — Consola Técnica con Master Key */}
        {activeTab === 'techconsole' && (
          <TechConsoleTab userId={user.id} />
        )}

        {/* ECONOMÍA · Regla 70/30 y canjes */}
        {activeTab === 'economy' && (
          <EconomyTab userId={user.id} />
        )}

        {/* AGENTES DE RECARGA */}
        {activeTab === 'agents' && (
          <AgentsTab userId={user.id} />
        )}

        {/* SEGURIDAD - Super Admin Tools (Device/IP ban + fake accounts) */}
        {activeTab === 'security' && (
          <SuperAdminTools adminId={user.id} />
        )}

        {/* SALUD DEL SISTEMA - Ojo Técnico del Bot */}
        {activeTab === 'health' && (
          <SystemHealthPanel userId={user.id} />
        )}

        {/* DIAGNÓSTICOS - PayPal, MongoDB, disco, env vars */}
        {activeTab === 'diagnostics' && (
          <DiagnosticsTab userId={user.id} />
        )}
      </div>
    </div>
  );
};

const BotGhostToggle = () => {
  const BOT_ID = 'system_bot_lluvia';
  const [ghost, setGhost] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/users/${BOT_ID}`).then(r => setGhost(!!r.data?.ghost_mode)).catch(() => {});
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const r = await axios.post(`${API}/users/${BOT_ID}/ghost-mode`);
      setGhost(r.data.ghost_mode);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-between bg-black/40 rounded-lg p-2 border border-purple-700/40">
      <div>
        <p className="text-purple-300 text-xs font-bold">👻 Modo Fantasma del Bot</p>
        <p className="text-white/40 text-[10px]">Bot invisible en salas · supervisión silenciosa</p>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        data-testid="bot-ghost-toggle"
        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ghost ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}
      >
        {loading ? '…' : ghost ? 'ACTIVO' : 'INACTIVO'}
      </button>
    </div>
  );
};

const BotTab = ({ userId }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${API}/bot/history?admin_id=${userId}`);
      setHistory(res.data);
    } catch (err) { /* silent */ }
  };

  const [pendingAction, setPendingAction] = useState(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/bot/command`, { admin_id: userId, message: input });
      const hasAction = res.data.action_result;
      
      if (hasAction && !input.toLowerCase().startsWith('sí') && !input.toLowerCase().startsWith('si') && !input.toLowerCase().includes('confirmo')) {
        // Show confirmation
        setPendingAction(res.data);
        setHistory(prev => [...prev, {
          message: input,
          response: res.data.response,
          action_result: `⚠️ CONFIRMAR: ${res.data.action_result}\n¿Confirmas? Escribe "SÍ" para ejecutar`,
          created_at: new Date().toISOString()
        }]);
      } else {
        setHistory(prev => [...prev, {
          message: input,
          response: res.data.response,
          action_result: res.data.action_result,
          created_at: new Date().toISOString()
        }]);
      }
      setInput('');
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
    setLoading(false);
  };

  const quickCommands = [
    '¿Cuántos usuarios hay?',
    '¿Quién es el más rico?',
    '¿Quiénes están en las salas?',
    'Regala 1M a todos en la sala',
    'Paga premios Top 3',
    'Manda aviso: Evento en 10 min',
  ];

  return (
    <div>
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-4 mb-4 text-center">
        <div className="text-4xl mb-2">🤖</div>
        <h3 className="text-xl font-black text-white">Bot Administrativo IA</h3>
        <p className="text-white/60 text-xs">Preguntame lo que quieras o dame ordenes</p>
      </div>

      {/* Bot Room Monitoring */}
      <div className="bg-gray-800 rounded-xl p-3 mb-4">
        <h4 className="text-white/70 text-xs font-bold mb-2">Vigilancia de Salas</h4>
        <p className="text-white/40 text-[10px] mb-2">El bot solo responde cuando le hablan directamente (digan "bot...")</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={async () => {
            try {
              const r = await axios.post(`${API}/bot/activate-all-rooms?admin_id=${userId}`);
              alert(`Bot activado en ${r.data.activated} salas!`);
            } catch (e) { alert(e.response?.data?.detail || 'Error'); }
          }} className="bg-green-600 text-white py-3 rounded-xl font-bold text-sm active:scale-95">
            Vigilar TODAS las Salas
          </button>
          <button onClick={async () => {
            try {
              const r = await axios.post(`${API}/bot/deactivate-all-rooms?admin_id=${userId}`);
              alert(`Bot desactivado de ${r.data.deactivated} salas`);
            } catch (e) { alert(e.response?.data?.detail || 'Error'); }
          }} className="bg-red-600 text-white py-3 rounded-xl font-bold text-sm active:scale-95">
            Desactivar de TODAS
          </button>
        </div>
        <BotGhostToggle />
      </div>

      {/* Voice Selector */}
      <div className="bg-gray-800 rounded-xl p-3 mb-4">
        <h4 className="text-white/70 text-xs font-bold mb-2">Voz del Bot (TTS)</h4>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'hombre', label: 'Hombre', icon: '👨' },
            { id: 'mujer', label: 'Mujer', icon: '👩' },
            { id: 'animador', label: 'Animador', icon: '🎙️' },
            { id: 'serio', label: 'Serio', icon: '🎩' },
          ].map(v => (
            <button key={v.id} onClick={() => {
              localStorage.setItem('bot_voice', v.id);
              axios.post(`${API}/admin/tts-voice?admin_id=${userId}&voice_id=${v.id}`);
            }} className={`p-2 rounded-lg text-center text-[10px] transition-all ${
              (localStorage.getItem('bot_voice') || 'hombre') === v.id ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60'
            }`}>
              <div className="text-lg">{v.icon}</div>
              <div>{v.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Commands */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {quickCommands.map((cmd, i) => (
          <button key={i} onClick={() => setInput(cmd)}
            className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border border-gray-700 hover:border-purple-500">
            {cmd}
          </button>
        ))}
      </div>

      {/* Chat History */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-4 h-80 overflow-y-auto space-y-3">
        {history.map((h, i) => (
          <div key={i}>
            <div className="flex justify-end mb-1">
              <div className="bg-purple-600 text-white px-3 py-2 rounded-xl rounded-tr-none text-sm max-w-xs">
                {h.message}
              </div>
            </div>
            <div className="flex justify-start mb-1">
              <div className="bg-gray-800 text-gray-200 px-3 py-2 rounded-xl rounded-tl-none text-sm max-w-xs">
                <div className="whitespace-pre-wrap">{h.response?.replace(/```json[\s\S]*?```/g, '').replace(/\{[\s\S]*?\}/g, '').trim() || h.response}</div>
                {h.action_result && (
                  <div className="mt-1 bg-green-900/50 text-green-400 px-2 py-1 rounded text-xs font-bold">
                    ✅ {h.action_result}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <div className="text-center text-gray-600 py-12">
            <div className="text-4xl mb-2">🤖</div>
            <p>Escribe tu primer comando...</p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Escribe un comando o pregunta..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500" />
        <button onClick={send} disabled={loading}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">
          {loading ? '...' : '🤖'}
        </button>
      </div>
    </div>
  );
};

const PrizesConfig = ({ userId }) => {
  const [config, setConfig] = useState({
    recharge_monthly_prizes: { '1st': 45000000, '2nd': 35000000, '3rd': 25000000 },
    event_weekly_return: { '100m': 10000000, '500m': 25000000, '600m': 45000000 },
    event_auto_payout_threshold: 30000000,
    event_auto_payout_amount: 10000000,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/config`).then(r => {
      if (r.data) setConfig(prev => ({ ...prev, ...r.data }));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/config?admin_id=${userId}`, config);
      alert('Configuracion guardada!');
    } catch (e) { alert('Error'); }
    setSaving(false);
  };

  const updatePrize = (section, key, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: parseInt(value) || 0 }
    }));
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-yellow-400 mb-4">💰 Configuracion de Premios</h3>

      {/* Monthly Recharge Prizes */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <h4 className="text-white font-bold mb-3">🏆 Premios Recarga Mensual</h4>
        {[['1st', '1er Lugar'], ['2nd', '2do Lugar'], ['3rd', '3er Lugar']].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-sm">{label}</span>
            <input type="number" value={config.recharge_monthly_prizes?.[key] || 0}
              onChange={e => updatePrize('recharge_monthly_prizes', key, e.target.value)}
              className="bg-gray-700 text-white text-sm px-3 py-1 rounded-lg w-32 text-right" />
          </div>
        ))}
      </div>

      {/* Event Weekly Returns */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <h4 className="text-white font-bold mb-3">📊 Retorno Semanal por Evento</h4>
        {[['100m', 'Evento 100M'], ['500m', 'Evento 500M'], ['600m', 'Evento 600M']].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-sm">{label}</span>
            <input type="number" value={config.event_weekly_return?.[key] || 0}
              onChange={e => updatePrize('event_weekly_return', key, e.target.value)}
              className="bg-gray-700 text-white text-sm px-3 py-1 rounded-lg w-32 text-right" />
          </div>
        ))}
      </div>

      {/* Auto Payout */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <h4 className="text-white font-bold mb-3">⚡ Pago Automatico de Eventos</h4>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/70 text-sm">Umbral (llegar a)</span>
          <input type="number" value={config.event_auto_payout_threshold || 0}
            onChange={e => setConfig(p => ({ ...p, event_auto_payout_threshold: parseInt(e.target.value) || 0 }))}
            className="bg-gray-700 text-white text-sm px-3 py-1 rounded-lg w-32 text-right" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/70 text-sm">Pago automatico</span>
          <input type="number" value={config.event_auto_payout_amount || 0}
            onChange={e => setConfig(p => ({ ...p, event_auto_payout_amount: parseInt(e.target.value) || 0 }))}
            className="bg-gray-700 text-white text-sm px-3 py-1 rounded-lg w-32 text-right" />
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
        {saving ? 'Guardando...' : 'Guardar Configuracion'}
      </button>
    </div>
  );

};

const TechConsoleTab = ({ userId }) => {
  const [masterKey, setMasterKey] = useState(() => sessionStorage.getItem('ll_master_key') || '');
  const [rememberKey, setRememberKey] = useState(() => !!sessionStorage.getItem('ll_master_key'));
  const [mode, setMode] = useState('python');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [snapshotEnabled, setSnapshotEnabled] = useState(true);
  const [lastSnapshotId, setLastSnapshotId] = useState('');
  const [status, setStatus] = useState({ configured: false, min_length: 20, current_length: 0 });
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadStatus();
    loadHistory();
  }, []);

  const loadStatus = async () => {
    try {
      const r = await axios.get(`${API}/admin/script-runner/status?admin_id=${userId}`);
      setStatus(r.data);
    } catch (_) {}
  };

  const loadHistory = async () => {
    try {
      const r = await axios.get(`${API}/admin/script-runner/history?admin_id=${userId}`);
      setHistory(r.data || []);
    } catch (_) {}
  };

  const persistKey = (val) => {
    setMasterKey(val);
    if (rememberKey) sessionStorage.setItem('ll_master_key', val);
  };

  const toggleRemember = (checked) => {
    setRememberKey(checked);
    if (checked) sessionStorage.setItem('ll_master_key', masterKey);
    else sessionStorage.removeItem('ll_master_key');
  };

  const run = async () => {
    if (!masterKey || masterKey.length < 20) {
      alert(`La Master Key debe tener al menos 20 caracteres. Actual: ${masterKey.length}`);
      return;
    }
    if (!code.trim()) { alert('Escribe código para ejecutar'); return; }
    const danger = mode === 'shell' && /\brm\s+-rf\s+\/(?!\S)/.test(code);
    if (danger && !window.confirm('⚠️ Detectamos "rm -rf /". ¿Confirmas ejecutar este comando destructivo?')) return;
    setRunning(true);
    setOutput(null);
    try {
      const res = await axios.post(
        `${API}/admin/script-runner/execute?admin_id=${userId}`,
        { mode, code, snapshot: snapshotEnabled },
        { headers: { 'X-Master-Key': masterKey } }
      );
      setOutput(res.data);
      if (res.data.snapshot_id) setLastSnapshotId(res.data.snapshot_id);
      loadHistory();
    } catch (err) {
      setOutput({
        ok: false,
        error: err.response?.data?.detail || err.message || 'Error desconocido',
      });
    }
    setRunning(false);
  };

  const undo = async () => {
    if (!masterKey || masterKey.length < 20) {
      alert(`La Master Key debe tener al menos 20 caracteres. Actual: ${masterKey.length}`);
      return;
    }
    if (!window.confirm('⚠️ DESHACER: se restaurará la base de datos al estado PREVIO a la última ejecución con snapshot.\n\nEsto reemplazará los datos actuales (mongorestore --drop). ¿Confirmas?')) return;
    setUndoing(true);
    try {
      const params = lastSnapshotId ? `&snapshot_id=${encodeURIComponent(lastSnapshotId)}` : '';
      const res = await axios.post(
        `${API}/admin/script-runner/undo?admin_id=${userId}${params}`,
        null,
        { headers: { 'X-Master-Key': masterKey } }
      );
      setOutput({ ok: true, stdout: `✅ Restaurado snapshot ${res.data.snapshot_id} en ${res.data.duration_ms} ms`, stderr: '', error: '' });
      loadHistory();
    } catch (err) {
      setOutput({
        ok: false,
        error: err.response?.data?.detail || err.message || 'Error al deshacer',
      });
    }
    setUndoing(false);
  };

  const snippets = mode === 'python'
    ? [
        { label: 'Contar usuarios', code: 'import asyncio\nprint(asyncio.get_event_loop().run_until_complete(db.users.count_documents({})))' },
        { label: 'Listar colecciones', code: 'import asyncio\nprint(asyncio.get_event_loop().run_until_complete(db.list_collection_names()))' },
        { label: 'ENV del backend', code: 'import os\nfor k in sorted(os.environ):\n    if any(s in k.lower() for s in ["secret","key","pass","token"]):\n        continue\n    print(k, "=", os.environ[k][:80])' },
      ]
    : [
        { label: 'Uso de disco', code: 'df -h' },
        { label: 'Procesos Python', code: 'ps aux | grep -i python | head -20' },
        { label: 'Logs backend (50)', code: 'tail -n 50 /var/log/supervisor/backend.err.log 2>/dev/null || tail -n 50 /var/log/supervisor/backend.*.log 2>/dev/null' },
        { label: 'MongoDB status', code: 'mongosh --eval "db.adminCommand({ ping: 1 })" 2>/dev/null || echo "mongosh no disponible"' },
      ];

  return (
    <div data-testid="tech-console-panel">
      <div className="bg-gradient-to-r from-red-900 via-orange-800 to-amber-800 rounded-2xl p-4 mb-4 border-2 border-red-500/40">
        <div className="flex items-start gap-3">
          <div className="text-4xl">⚡</div>
          <div className="flex-1">
            <h3 className="text-xl font-black text-white">Consola Técnica · Script Runner</h3>
            <p className="text-orange-100 text-xs mt-1">
              Ejecución directa de Python y Shell en el servidor. Protegido por Master Key (mínimo 20 caracteres).
              Cada ejecución queda registrada en auditoría.
            </p>
          </div>
        </div>
      </div>

      {/* STATUS */}
      <div className={`rounded-xl p-3 mb-4 text-sm font-medium border ${status.configured ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-yellow-900/30 border-yellow-700 text-yellow-300'}`}>
        {status.configured ? (
          <>✅ MASTER_KEY configurada en el servidor ({status.current_length} caracteres).</>
        ) : (
          <>⚠️ MASTER_KEY aún no configurada o tiene menos de {status.min_length} caracteres.
            Define <code className="bg-black/40 px-1 rounded">MASTER_KEY</code> en <code className="bg-black/40 px-1 rounded">/app/backend/.env</code> y reinicia el backend.
          </>
        )}
      </div>

      {/* MASTER KEY */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
        <label className="text-yellow-400 text-sm font-bold block mb-2">🔑 Master Key (no se guarda en DB):</label>
        <input
          type="password"
          autoComplete="off"
          value={masterKey}
          onChange={e => persistKey(e.target.value)}
          placeholder="Introduce tu Master Key de 20+ caracteres"
          data-testid="tech-master-key-input"
          className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white font-mono tracking-wider outline-none focus:border-yellow-500"
        />
        <label className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <input type="checkbox" checked={rememberKey} onChange={e => toggleRemember(e.target.checked)} />
          Recordar durante esta sesión del navegador
        </label>
      </div>

      {/* MODE */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          data-testid="tech-mode-python"
          onClick={() => setMode('python')}
          className={`py-3 rounded-xl font-bold text-sm transition-all ${mode === 'python' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'}`}>
          🐍 Python
        </button>
        <button
          data-testid="tech-mode-shell"
          onClick={() => setMode('shell')}
          className={`py-3 rounded-xl font-bold text-sm transition-all ${mode === 'shell' ? 'bg-green-700 text-white shadow-lg' : 'bg-gray-800 text-gray-400'}`}>
          💠 Shell (bash)
        </button>
      </div>

      {/* SNIPPETS */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {snippets.map((s, i) => (
          <button key={i} onClick={() => setCode(s.code)}
            className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border border-gray-700 hover:border-yellow-500">
            {s.label}
          </button>
        ))}
      </div>

      {/* CODE */}
      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder={mode === 'python' ? '# Python. Variables disponibles: db, os\nprint("Hola desde Lluvia Live")' : '# Bash\nuptime'}
        data-testid="tech-code-input"
        className="w-full bg-black border border-gray-700 rounded-xl px-3 py-3 text-green-400 font-mono text-sm h-56 resize-none outline-none focus:border-yellow-500"
      />

      {/* Snapshot toggle */}
      <label className="flex items-center gap-2 mt-3 text-xs text-gray-300 bg-blue-950/30 border border-blue-800 rounded-lg px-3 py-2">
        <input type="checkbox" checked={snapshotEnabled} onChange={e => setSnapshotEnabled(e.target.checked)}
          data-testid="tech-snapshot-toggle" />
        📸 Crear snapshot automático de la DB antes de ejecutar (recomendado — permite Deshacer)
      </label>

      <div className="flex gap-2 mt-3 mb-3 flex-wrap">
        <button
          onClick={run}
          disabled={running || undoing}
          data-testid="tech-execute-btn"
          className="flex-1 min-w-[140px] bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 py-3 rounded-xl font-black text-white disabled:opacity-50">
          {running ? '⏳ Ejecutando...' : '⚡ EJECUTAR'}
        </button>
        <button
          onClick={undo}
          disabled={running || undoing}
          data-testid="tech-undo-btn"
          title="Restaura la DB al snapshot anterior (mongorestore --drop)"
          className="flex-1 min-w-[140px] bg-gradient-to-r from-indigo-600 to-blue-700 py-3 rounded-xl font-black text-white disabled:opacity-50">
          {undoing ? '⏳ Restaurando...' : '↩️ DESHACER'}
        </button>
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setCode(''); setOutput(null); }}
          className="bg-gray-800 text-gray-300 px-4 py-2 rounded-xl font-bold text-sm">
          Limpiar
        </button>
        <button onClick={() => { setShowHistory(v => !v); if (!showHistory) loadHistory(); }}
          className="bg-gray-800 text-gray-300 px-4 py-2 rounded-xl font-bold text-sm">
          📜 {showHistory ? 'Ocultar' : 'Historial'}
        </button>
        {lastSnapshotId && (
          <span className="bg-blue-900/40 border border-blue-700 text-blue-300 px-3 py-2 rounded-xl text-xs font-mono" data-testid="tech-last-snapshot">
            📸 {lastSnapshotId}
          </span>
        )}
      </div>

      {/* OUTPUT */}
      {output && (
        <div data-testid="tech-output" className={`rounded-xl p-4 border mb-4 ${output.ok ? 'bg-green-950/40 border-green-700' : 'bg-red-950/40 border-red-700'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-bold text-sm ${output.ok ? 'text-green-400' : 'text-red-400'}`}>
              {output.ok ? '✅ OK' : '❌ ERROR'}
            </span>
            {output.duration_ms !== undefined && <span className="text-gray-500 text-xs">⏱ {output.duration_ms} ms</span>}
            {output.exit_code !== undefined && output.exit_code !== null && (
              <span className="text-gray-500 text-xs">exit: {output.exit_code}</span>
            )}
          </div>
          {output.stdout && (
            <>
              <div className="text-gray-400 text-xs font-bold mb-1">STDOUT</div>
              <pre className="bg-black rounded-lg p-3 text-green-300 text-xs overflow-x-auto whitespace-pre-wrap mb-2">{output.stdout}</pre>
            </>
          )}
          {output.stderr && (
            <>
              <div className="text-gray-400 text-xs font-bold mb-1">STDERR</div>
              <pre className="bg-black rounded-lg p-3 text-yellow-300 text-xs overflow-x-auto whitespace-pre-wrap mb-2">{output.stderr}</pre>
            </>
          )}
          {output.error && (
            <>
              <div className="text-gray-400 text-xs font-bold mb-1">ERROR</div>
              <pre className="bg-black rounded-lg p-3 text-red-300 text-xs overflow-x-auto whitespace-pre-wrap">{output.error}</pre>
            </>
          )}
        </div>
      )}

      {/* HISTORY */}
      {showHistory && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h4 className="text-yellow-400 font-bold mb-3 text-sm">📜 Últimas 20 ejecuciones</h4>
          {history.length === 0 && <p className="text-gray-500 text-sm">Sin ejecuciones aún.</p>}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map(h => (
              <div key={h.id} className={`p-2 rounded-lg border text-xs ${h.ok ? 'border-green-800 bg-green-950/30' : 'border-red-800 bg-red-950/30'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400">
                    {h.started_at?.replace('T', ' ').split('.')[0]} · <span className="uppercase">{h.mode}</span> · {h.duration_ms}ms
                  </span>
                  <span className={h.ok ? 'text-green-400' : 'text-red-400'}>{h.ok ? 'OK' : 'ERR'}</span>
                </div>
                <pre className="text-gray-300 bg-black/40 p-2 rounded whitespace-pre-wrap truncate max-h-16 overflow-hidden">{h.code}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;

// ========== ECONOMY TAB ==========
const EconomyTab = ({ userId }) => {
  const [cfg, setCfg] = useState(null);
  const [revenue, setRevenue] = useState({ summary: {}, entries: [] });
  const [pkgs, setPkgs] = useState([]);
  const [edit, setEdit] = useState({});
  const [loading, setLoading] = useState(false);
  const [newPkg, setNewPkg] = useState({ name: '', coins: 0, price_usd: 0, bonus_coins: 0, order: 0, active: true });

  const load = async () => {
    try {
      const [c, r, p] = await Promise.all([
        axios.get(`${API}/economy/config`),
        axios.get(`${API}/admin/economy/house-revenue?admin_id=${userId}&limit=20`),
        axios.get(`${API}/admin/economy/coin-packages?admin_id=${userId}`),
      ]);
      setCfg(c.data);
      setEdit({
        commission_rate: c.data.commission_rate,
        diamond_to_coin_rate: c.data.diamond_to_coin_rate,
        coin_price_usd_per_1000: c.data.coin_price_usd_per_1000,
        min_diamond_exchange: c.data.min_diamond_exchange,
      });
      setRevenue(r.data);
      setPkgs(p.data);
    } catch (e) { /* silent */ }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/admin/economy/config?admin_id=${userId}`, edit);
      alert('✅ Configuración actualizada');
      load();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setLoading(false);
  };

  const savePkg = async (pkg) => {
    try {
      await axios.post(`${API}/admin/economy/coin-packages?admin_id=${userId}`, pkg);
      setNewPkg({ name: '', coins: 0, price_usd: 0, bonus_coins: 0, order: 0, active: true });
      load();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const deletePkg = async (id) => {
    if (!window.confirm('¿Borrar paquete?')) return;
    try {
      await axios.delete(`${API}/admin/economy/coin-packages/${id}?admin_id=${userId}`);
      load();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  if (!cfg) return <div className="text-white/50 text-sm p-4">Cargando...</div>;
  const s = revenue.summary || {};

  return (
    <div className="space-y-4" data-testid="economy-tab">
      <div className="bg-gradient-to-r from-emerald-800 to-amber-800 rounded-2xl p-4 border border-emerald-500/30">
        <h3 className="text-white font-black text-lg">🏦 Economía · Regla 70/30</h3>
        <p className="text-white/80 text-xs mt-1">Se vende SOLO ORO. Los regalos entregan el 70% al creador como DIAMANTES (el 30% es comisión). El creador canjea sus diamantes 1:1 a oros.</p>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h4 className="text-yellow-400 font-bold text-sm mb-3">⚙️ Parámetros</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="text-white/70">Comisión casa (0-0.6):
            <input type="number" step="0.01" min="0" max="0.6" value={edit.commission_rate ?? 0.3}
              data-testid="economy-commission-input"
              onChange={e => setEdit(p => ({ ...p, commission_rate: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white mt-1" />
            <span className="text-white/40">= {Math.round((edit.commission_rate || 0) * 100)}% a la casa</span>
          </label>
          <label className="text-white/70">Tasa 1💎→💰:
            <input type="number" step="0.01" min="0.01" value={edit.diamond_to_coin_rate ?? 1.0}
              data-testid="economy-rate-input"
              onChange={e => setEdit(p => ({ ...p, diamond_to_coin_rate: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white mt-1" />
            <span className="text-white/40">1💎 = {edit.diamond_to_coin_rate || 1}💰</span>
          </label>
          <label className="text-white/70">Precio $ / 1000 oros:
            <input type="number" step="0.01" min="0.01" value={edit.coin_price_usd_per_1000 ?? 1.0}
              data-testid="economy-price-input"
              onChange={e => setEdit(p => ({ ...p, coin_price_usd_per_1000: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white mt-1" />
          </label>
          <label className="text-white/70">Mín. 💎 canje:
            <input type="number" min="1" value={edit.min_diamond_exchange ?? 1}
              onChange={e => setEdit(p => ({ ...p, min_diamond_exchange: parseInt(e.target.value) || 1 }))}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white mt-1" />
          </label>
        </div>
        <button onClick={save} disabled={loading} data-testid="economy-save-btn"
          className="w-full mt-3 bg-gradient-to-r from-yellow-600 to-amber-600 py-2 rounded-lg text-white font-bold text-sm disabled:opacity-50">
          {loading ? '⏳' : '💾 Guardar configuración'}
        </button>
        {cfg.updated_by && <p className="text-white/30 text-[10px] mt-2">Última edición: {cfg.updated_by} · {cfg.updated_at?.split('T')[0]}</p>}
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h4 className="text-yellow-400 font-bold text-sm mb-3">💰 Ingresos de la casa</h4>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-black/40 rounded-lg p-2 text-center">
            <div className="text-xl font-black text-green-400">{(s.total_commission || 0).toLocaleString()}</div>
            <div className="text-[10px] text-white/50">Oros comisionados</div>
          </div>
          <div className="bg-black/40 rounded-lg p-2 text-center">
            <div className="text-xl font-black text-blue-400">{(s.total_gross || 0).toLocaleString()}</div>
            <div className="text-[10px] text-white/50">Oros brutos</div>
          </div>
          <div className="bg-black/40 rounded-lg p-2 text-center">
            <div className="text-xl font-black text-purple-400">{(s.count || 0)}</div>
            <div className="text-[10px] text-white/50">Operaciones</div>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {revenue.entries.map(e => (
            <div key={e.id} className="text-[11px] bg-black/30 rounded px-2 py-1 flex justify-between">
              <span className="text-white/60">{e.source} · {e.reference || ''}</span>
              <span className="text-green-400 font-bold">+{e.commission_coins}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h4 className="text-yellow-400 font-bold text-sm mb-3">📦 Paquetes de recarga (sólo oros)</h4>
        {pkgs.length === 0 && <p className="text-white/40 text-xs mb-2">Sin paquetes aún.</p>}
        <div className="space-y-1 mb-3">
          {pkgs.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-black/40 rounded px-2 py-2 text-xs">
              <span className="text-white/80 font-bold">{p.name}</span>
              <span className="text-yellow-400">{p.coins.toLocaleString()} 💰</span>
              {p.bonus_coins > 0 && <span className="text-green-400">+{p.bonus_coins}</span>}
              <span className="text-blue-400">${p.price_usd}</span>
              <button onClick={() => deletePkg(p.id)} className="text-red-400">🗑</button>
            </div>
          ))}
        </div>
        <div className="bg-black/40 rounded-lg p-2 grid grid-cols-5 gap-1 text-xs">
          <input placeholder="Nombre" value={newPkg.name}
            onChange={e => setNewPkg(p => ({ ...p, name: e.target.value }))}
            className="bg-black border border-gray-700 rounded px-1 text-white col-span-2" />
          <input placeholder="Oros" type="number" value={newPkg.coins || ''}
            onChange={e => setNewPkg(p => ({ ...p, coins: parseInt(e.target.value) || 0 }))}
            className="bg-black border border-gray-700 rounded px-1 text-white" />
          <input placeholder="USD" type="number" step="0.01" value={newPkg.price_usd || ''}
            onChange={e => setNewPkg(p => ({ ...p, price_usd: parseFloat(e.target.value) || 0 }))}
            className="bg-black border border-gray-700 rounded px-1 text-white" />
          <button onClick={() => savePkg(newPkg)} data-testid="economy-add-pkg"
            className="bg-green-600 text-white rounded font-bold">+</button>
        </div>
      </div>
    </div>
  );
};

// ========== AGENTS TAB ==========
const AgentsTab = ({ userId }) => {
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState({ username: '', region: '', commission_rate: 0.10, contact: '', notes: '' });
  const [sale, setSale] = useState({ agent_id: '', buyer_user_id: '', coins_sold: 0, payment_ref: '' });

  const load = async () => {
    try {
      const r = await axios.get(`${API}/admin/agents?admin_id=${userId}`);
      setAgents(r.data);
    } catch (e) { /* silent */ }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.username || !form.region) { alert('Nombre y región son obligatorios'); return; }
    try {
      await axios.post(`${API}/admin/agents?admin_id=${userId}`, form);
      setForm({ username: '', region: '', commission_rate: 0.10, contact: '', notes: '' });
      load();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar agente?')) return;
    try {
      await axios.delete(`${API}/admin/agents/${id}?admin_id=${userId}`);
      load();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const recordSale = async () => {
    if (!sale.agent_id || !sale.buyer_user_id || sale.coins_sold <= 0) { alert('Datos incompletos'); return; }
    try {
      const r = await axios.post(`${API}/admin/agents/record-sale?admin_id=${userId}`, sale);
      alert(`✅ Venta registrada · Comisión agente: ${r.data.agent_commission} · Casa: ${r.data.house_revenue}`);
      setSale({ agent_id: '', buyer_user_id: '', coins_sold: 0, payment_ref: '' });
      load();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  return (
    <div className="space-y-4" data-testid="agents-tab">
      <div className="bg-gradient-to-r from-blue-800 to-indigo-800 rounded-2xl p-4 border border-blue-500/30">
        <h3 className="text-white font-black text-lg">🧑‍💼 Agentes de Recarga</h3>
        <p className="text-white/80 text-xs mt-1">Gestiona vendedores regionales. Cada uno tiene su comisión individual.</p>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h4 className="text-yellow-400 font-bold text-sm mb-3">+ Nuevo Agente</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <input placeholder="Nombre (username)" value={form.username}
            data-testid="agent-username-input"
            onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
            className="bg-black border border-gray-700 rounded px-2 py-1 text-white" />
          <input placeholder="Región (país/ciudad)" value={form.region}
            data-testid="agent-region-input"
            onChange={e => setForm(p => ({ ...p, region: e.target.value }))}
            className="bg-black border border-gray-700 rounded px-2 py-1 text-white" />
          <input placeholder="Comisión (0.10 = 10%)" type="number" step="0.01" min="0" max="0.5"
            value={form.commission_rate}
            onChange={e => setForm(p => ({ ...p, commission_rate: parseFloat(e.target.value) || 0 }))}
            className="bg-black border border-gray-700 rounded px-2 py-1 text-white" />
          <input placeholder="Contacto" value={form.contact}
            onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
            className="bg-black border border-gray-700 rounded px-2 py-1 text-white" />
          <input placeholder="Notas" value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="bg-black border border-gray-700 rounded px-2 py-1 text-white col-span-2" />
        </div>
        <button onClick={create} data-testid="agent-create-btn"
          className="w-full mt-2 bg-blue-600 py-2 rounded-lg text-white font-bold text-sm">
          + Crear Agente
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h4 className="text-yellow-400 font-bold text-sm mb-3">📋 Agentes registrados ({agents.length})</h4>
        {agents.length === 0 && <p className="text-white/40 text-xs">Aún no hay agentes.</p>}
        <div className="space-y-2">
          {agents.map(a => (
            <div key={a.id} className="bg-black/40 rounded-lg p-2 border border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">{a.username} <span className="text-blue-300 text-[11px]">· {a.region}</span></p>
                  <p className="text-white/50 text-[11px]">Comisión: {(a.commission_rate * 100).toFixed(1)}% · Vendido: {(a.coins_sold_total || 0).toLocaleString()} 💰 · Ganado casa: {(a.revenue_generated || 0).toLocaleString()}</p>
                  {a.contact && <p className="text-white/40 text-[10px]">📞 {a.contact}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setSale(p => ({ ...p, agent_id: a.id }))} className="text-green-400 text-[11px]">💸 Registrar venta</button>
                  <button onClick={() => remove(a.id)} className="text-red-400 text-[11px]">🗑 Borrar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {sale.agent_id && (
        <div className="bg-gray-900 rounded-xl p-4 border border-green-800">
          <h4 className="text-green-400 font-bold text-sm mb-3">💸 Registrar venta del agente</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input placeholder="User ID comprador" value={sale.buyer_user_id}
              onChange={e => setSale(p => ({ ...p, buyer_user_id: e.target.value }))}
              className="bg-black border border-gray-700 rounded px-2 py-1 text-white col-span-2" />
            <input placeholder="Oros vendidos" type="number" value={sale.coins_sold || ''}
              onChange={e => setSale(p => ({ ...p, coins_sold: parseInt(e.target.value) || 0 }))}
              className="bg-black border border-gray-700 rounded px-2 py-1 text-white" />
            <input placeholder="Ref. pago" value={sale.payment_ref}
              onChange={e => setSale(p => ({ ...p, payment_ref: e.target.value }))}
              className="bg-black border border-gray-700 rounded px-2 py-1 text-white" />
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={recordSale} className="flex-1 bg-green-600 py-2 rounded text-white font-bold text-sm">Registrar</button>
            <button onClick={() => setSale({ agent_id: '', buyer_user_id: '', coins_sold: 0, payment_ref: '' })}
              className="bg-gray-700 py-2 px-3 rounded text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ========== DIAGNOSTICS TAB ==========
const DiagnosticsTab = ({ userId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const run = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const r = await axios.get(`${API}/diagnostics?user_id=${userId}`);
      setData(r.data);
    } catch (e) {
      setData({ error: e.response?.data?.detail || e.message });
    }
    setLoading(false);
  };

  const testPaypal = async () => {
    try {
      const r = await axios.post(`${API}/diagnostics/paypal/test-order?user_id=${userId}`);
      setTestResult({ ok: true, msg: JSON.stringify(r.data, null, 2) });
    } catch (e) {
      setTestResult({ ok: false, msg: e.response?.data?.detail || e.message });
    }
  };

  useEffect(() => { run(); }, []);

  const StatusBadge = ({ status }) => (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === 'ok' ? 'bg-green-700 text-green-200' : 'bg-red-700 text-red-200'}`}>
      {status === 'ok' ? '✅ OK' : '❌ ERROR'}
    </span>
  );

  return (
    <div className="space-y-4" data-testid="diagnostics-tab">
      <div className="bg-gradient-to-r from-cyan-900 to-teal-900 rounded-2xl p-4 border border-cyan-500/30 flex items-center justify-between">
        <div>
          <h3 className="text-white font-black text-lg">🔬 Diagnósticos del Sistema</h3>
          <p className="text-white/70 text-xs mt-1">PayPal · MongoDB · Disco · Variables de entorno · Servidor</p>
        </div>
        <button onClick={run} disabled={loading}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">
          {loading ? '⏳' : '↻ Actualizar'}
        </button>
      </div>

      {!data && loading && (
        <div className="text-white/50 text-center py-10">Ejecutando diagnósticos...</div>
      )}

      {data?.error && (
        <div className="bg-red-900/40 border border-red-600 rounded-xl p-4 text-red-300 text-sm">{data.error}</div>
      )}

      {data && !data.error && (
        <>
          {/* Server */}
          {data.server && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h4 className="text-white font-bold text-sm mb-2">🖥️ Servidor</h4>
              <div className="text-xs space-y-1 text-white/70">
                <div>Host: <span className="text-white font-mono">{data.server.hostname}</span></div>
                <div>Python: <span className="text-white font-mono">{data.server.python_version}</span></div>
                <div>Root: <span className="text-white font-mono">{data.server.backend_root}</span></div>
                <div className="text-white/40">Consultado: {new Date(data.timestamp * 1000).toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* MongoDB */}
          {data.mongo && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-bold text-sm">🍃 MongoDB</h4>
                <StatusBadge status={data.mongo.status} />
              </div>
              {data.mongo.status === 'ok' ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-black/40 rounded-lg p-2 text-center">
                    <div className="text-2xl font-black text-green-400">{data.mongo.users}</div>
                    <div className="text-white/50">Usuarios</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 text-center">
                    <div className="text-2xl font-black text-blue-400">{data.mongo.rooms}</div>
                    <div className="text-white/50">Salas</div>
                  </div>
                </div>
              ) : (
                <p className="text-red-300 text-xs font-mono">{data.mongo.error}</p>
              )}
            </div>
          )}

          {/* PayPal */}
          {data.paypal && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-bold text-sm">💳 PayPal</h4>
                <StatusBadge status={data.paypal.status} />
              </div>
              <div className="text-xs space-y-1 text-white/70">
                <div>Modo: <span className={`font-bold ${data.paypal.mode === 'live' ? 'text-green-400' : 'text-yellow-400'}`}>{(data.paypal.mode || '').toUpperCase()}</span></div>
                {data.paypal.client_id_prefix && <div>Client ID: <span className="font-mono text-white">{data.paypal.client_id_prefix}</span></div>}
                {data.paypal.latency_ms && <div>Latencia OAuth: <span className="text-white">{data.paypal.latency_ms} ms</span></div>}
                {data.paypal.error && <div className="text-red-300 font-mono">{data.paypal.error}</div>}
              </div>
              <button onClick={testPaypal}
                className="mt-3 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                🧪 Test: crear orden $1
              </button>
              {testResult && (
                <pre className={`mt-2 text-xs p-2 rounded-lg overflow-x-auto ${testResult.ok ? 'bg-green-950/50 text-green-300' : 'bg-red-950/50 text-red-300'}`}>
                  {testResult.msg}
                </pre>
              )}
            </div>
          )}

          {/* Disk */}
          {data.disk && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-bold text-sm">💾 Disco</h4>
                <StatusBadge status={data.disk.status} />
              </div>
              {data.disk.status === 'ok' && (
                <>
                  <div className="flex justify-between text-xs text-white/70 mb-1">
                    <span>Usado: {data.disk.used_gb} GB / {data.disk.total_gb} GB</span>
                    <span className={data.disk.used_pct > 85 ? 'text-red-400 font-bold' : 'text-white'}>{data.disk.used_pct}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${data.disk.used_pct > 85 ? 'bg-red-500' : data.disk.used_pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(data.disk.used_pct, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-white/50 mt-1">Libre: {data.disk.free_gb} GB</div>
                </>
              )}
            </div>
          )}

          {/* Env vars */}
          {data.env && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h4 className="text-white font-bold text-sm mb-2">🔑 Variables de Entorno</h4>
              <div className="space-y-1">
                {Object.entries(data.env).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-white/70 font-mono">{key}</span>
                    <span className={`font-bold ${val.set ? 'text-green-400' : 'text-red-400'}`}>
                      {val.set ? `✅ configurada (${val.length} chars)` : '❌ no configurada'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uploads */}
          {data.uploads && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-bold text-sm">📁 Uploads</h4>
                <StatusBadge status={data.uploads.status} />
              </div>
              <div className="text-xs space-y-1 text-white/70">
                <div>Directorio: <span className="font-mono text-white">{data.uploads.upload_dir}</span></div>
                {data.uploads.file_count !== undefined && <div>Archivos: <span className="text-white">{data.uploads.file_count}</span></div>}
                {data.uploads.mode_octal && <div>Permisos: <span className="font-mono text-white">{data.uploads.mode_octal}</span></div>}
                {data.uploads.error && <div className="text-red-300">{data.uploads.error}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

