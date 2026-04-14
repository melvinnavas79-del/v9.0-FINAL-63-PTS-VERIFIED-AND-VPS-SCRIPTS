import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

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
    } catch (err) { console.error(err); }
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
    try {
      let res;
      switch(action) {
        case 'give-coins':
          res = await axios.post(`${API}/admin/console/give-coins?admin_id=${user.id}&target_id=${target}&amount=${Number(consoleValue)}`);
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
      alert('Ejecutado');
      loadAll();
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
    if (!window.confirm('¿Repartir premios de clanes?')) return;
    try {
      const res = await axios.post(`${API}/events/clan-rewards?admin_id=${user.id}`);
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
    { id: 'bot', label: 'Bot IA', icon: '🤖' },
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
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
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
            <h3 className="text-lg font-bold text-yellow-400 mb-3">⚡ Acciones Rápidas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button onClick={distributeWeekly} className="bg-gradient-to-r from-yellow-600 to-amber-600 p-4 rounded-xl font-bold text-sm">
                🏆 Premios Semanales
              </button>
              <button onClick={distributeClanRewards} className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 rounded-xl font-bold text-sm">
                🏷️ Premios Clanes
              </button>
              <button onClick={triggerBabyRobot} className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 rounded-xl font-bold text-sm">
                🤖 Bebé Robot
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

        {/* EVENTS - now part of config */}
        {/* CONFIG - Events + Clanes + Rooms + Prizes */}
        {activeTab === 'config' && (
          <div>
            <h3 className="text-lg font-bold text-yellow-400 mb-4">⚙️ Configuracion General</h3>
            
            {/* Weekly */}
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

            {/* Clanes */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
              <h4 className="font-bold text-white mb-3">🏷️ Premios Clanes</h4>
              <p className="text-gray-400 text-sm mb-3">1° = 25M + Arist.6 | 2° = 20M + Arist.5 | 3° = 15M + Arist.4</p>
              <button onClick={distributeClanRewards}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 py-3 rounded-xl font-bold">
                🏷️ REPARTIR PREMIOS CLANES
              </button>
            </div>

            {/* Baby Robot */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
              <h4 className="font-bold text-white mb-3">🤖 Bebé Robot</h4>
              <p className="text-gray-400 text-sm mb-3">Meta global: 25M → Bono 15M repartido</p>
              <button onClick={triggerBabyRobot}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 py-3 rounded-xl font-bold">
                🤖 ACTIVAR BEBÉ ROBOT
              </button>
            </div>

            {/* History */}
            <h4 className="font-bold text-white mb-2">📜 Historial</h4>
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

        {/* CONFIG - System Config + Prices + Events + Rooms + Clanes + Prizes */}
        {activeTab === 'config' && (
          <div>
            <h3 className="text-lg font-bold text-yellow-400 mb-4">⚙️ Configuracion</h3>
            
            {/* System Config */}
            <div className="space-y-3 mb-6">
              {Object.entries(config).map(([key, value]) => (
                <div key={key} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                  <span className="text-gray-300 text-xs">{key.replace(/_/g, ' ').toUpperCase()}</span>
                  <input type="number" value={value}
                    onChange={e => setConfig(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-yellow-400 font-bold w-28 text-right text-sm" />
                </div>
              ))}
              <button onClick={saveConfig} className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 py-3 rounded-xl font-bold">Guardar Config</button>
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
              <button onClick={() => runConsole('give-coins')} className="bg-green-800 text-green-300 p-3 rounded-xl font-bold text-sm">💰 Dar Monedas</button>
              <button onClick={() => runConsole('set-level')} className="bg-blue-800 text-blue-300 p-3 rounded-xl font-bold text-sm">⬆️ Set Nivel</button>
              <button onClick={() => runConsole('set-aristocracy')} className="bg-purple-800 text-purple-300 p-3 rounded-xl font-bold text-sm">👑 Set Aristocracia</button>
              <button onClick={() => runConsole('verify')} className="bg-cyan-800 text-cyan-300 p-3 rounded-xl font-bold text-sm">✅ Verificar</button>
              <button onClick={() => runConsole('ban')} className="bg-red-800 text-red-300 p-3 rounded-xl font-bold text-sm">🚫 Banear</button>
              <button onClick={() => runConsole('unban')} className="bg-yellow-800 text-yellow-300 p-3 rounded-xl font-bold text-sm">🔓 Desbanear</button>
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
      </div>
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
    } catch (err) { console.error(err); }
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
        <p className="text-white/60 text-xs">Pregúntame lo que quieras o dame órdenes</p>
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


export default ControlPanel;
