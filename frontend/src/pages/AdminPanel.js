import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLES = ['dueño', 'admin', 'moderador', 'supervisor', 'usuario'];
const ROLE_COLORS = {
  'dueño': 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
  'admin': 'bg-gradient-to-r from-red-500 to-pink-500 text-white',
  'moderador': 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
  'supervisor': 'bg-gradient-to-r from-green-500 to-emerald-500 text-white',
  'usuario': 'bg-gray-200 text-gray-700'
};
const ROLE_ICONS = {
  'dueño': '👑',
  'admin': '⭐',
  'moderador': '🛡️',
  'supervisor': '👁️',
  'usuario': '👤'
};

const AdminPanel = ({ onBack }) => {
  const { user, updateUser } = useUser();
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [isOwner, setIsOwner] = useState(user?.role === 'dueño');
  const [isAdmin, setIsAdmin] = useState(user?.is_admin || user?.role === 'dueño');
  const [ownerKey, setOwnerKey] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [activeTab, setActiveTab] = useState('staff');

  useEffect(() => {
    if (isAdmin || isOwner) {
      loadData();
    }
  }, [isAdmin, isOwner]);

  const loadData = async () => {
    try {
      const [usersRes, roomsRes] = await Promise.all([
        axios.get(`${API}/admin/users?admin_id=${user.id}`),
        axios.get(`${API}/rooms`)
      ]);
      setUsers(usersRes.data);
      setRooms(roomsRes.data);

      // Get staff
      try {
        const staffRes = await axios.get(`${API}/admin/staff?admin_id=${user.id}`);
        setStaff(staffRes.data);
      } catch (e) { /* staff endpoint opcional */ }
    } catch (err) { /* silent */ }
  };

  const activateOwner = async () => {
    try {
      const res = await axios.post(`${API}/admin/set-owner?user_id=${user.id}&owner_key=${ownerKey}`);
      updateUser(res.data);
      setIsOwner(true);
      setIsAdmin(true);
      setOwnerKey('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Clave inválida');
    }
  };

  const activateAdmin = async () => {
    try {
      const res = await axios.post(`${API}/admin/set-admin?user_id=${user.id}&admin_key=${adminKey}`);
      updateUser(res.data);
      setIsAdmin(true);
      setAdminKey('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Clave inválida');
    }
  };

  const setRole = async (userId, role) => {
    try {
      await axios.post(`${API}/admin/set-role?user_id=${userId}&admin_id=${user.id}&role=${role}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error asignando rol');
    }
  };

  const updateUserData = async (userId, updates) => {
    try {
      await axios.put(`${API}/admin/users/${userId}?admin_id=${user.id}`, updates);
      loadData();
    } catch (err) {
      alert('Error actualizando usuario');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('¿Eliminar este usuario?')) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}?admin_id=${user.id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error eliminando');
    }
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm('¿Eliminar esta sala?')) return;
    try {
      await axios.delete(`${API}/admin/rooms/${roomId}?admin_id=${user.id}`);
      loadData();
    } catch (err) {
      alert('Error eliminando sala');
    }
  };

  // Not authorized yet - SECURITY LOCK
  if (!isAdmin && !isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <button onClick={onBack} className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-2 rounded-full mb-6">
            ← Volver
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Restringido</h2>
            <p className="text-gray-500 mb-6">Solo el dueño de la aplicación puede acceder a este panel.</p>
            
            <input
              type="password"
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
              placeholder="🔑 Clave del dueño"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-yellow-500 text-center"
            />
            <button onClick={activateOwner}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 rounded-xl font-bold mb-6">
              👑 Acceder como Dueño
            </button>

            <div className="border-t pt-4">
              <p className="text-gray-400 text-xs mb-3">¿Eres staff autorizado?</p>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Clave de admin"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-pink-500 text-center text-sm"
              />
              <button onClick={activateAdmin}
                className="w-full bg-gray-800 text-white py-2 rounded-xl font-bold text-sm">
                ⭐ Acceder como Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const staffCounts = {
    dueño: users.filter(u => u.role === 'dueño').length,
    admin: users.filter(u => u.role === 'admin').length,
    moderador: users.filter(u => u.role === 'moderador').length,
    supervisor: users.filter(u => u.role === 'supervisor').length,
    usuario: users.filter(u => !u.role || u.role === 'usuario').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="bg-pink-500 text-white px-5 py-2 rounded-full text-sm">← Volver</button>
          <h1 className="text-xl font-bold text-gray-800">👑 Panel de Control</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${ROLE_COLORS[user.role || 'usuario']}`}>
            {ROLE_ICONS[user.role || 'usuario']} {(user.role || 'usuario').toUpperCase()}
          </span>
        </div>

        {/* Role Stats */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {ROLES.map(role => (
            <div key={role} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
              <div className="text-2xl mb-1">{ROLE_ICONS[role]}</div>
              <div className="text-2xl font-bold text-gray-800">{staffCounts[role]}</div>
              <div className="text-gray-500 text-xs capitalize">{role}s</div>
            </div>
          ))}
        </div>

        {/* Total Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl p-4 text-center text-white">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm opacity-80">Total Usuarios</div>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl p-4 text-center text-white">
            <div className="text-2xl font-bold">{rooms.length}</div>
            <div className="text-sm opacity-80">Total Salas</div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 text-center text-white">
            <div className="text-2xl font-bold">{users.reduce((a, u) => a + (u.coins || 0), 0).toLocaleString()}</div>
            <div className="text-sm opacity-80">Total Monedas</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {['staff', 'users', 'rooms'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full font-medium text-sm whitespace-nowrap ${
                activeTab === tab ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 border'
              }`}
            >
              {tab === 'staff' ? '👥 Staff' : tab === 'users' ? '🧑 Usuarios' : '🏠 Salas'}
            </button>
          ))}
        </div>

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Equipo de Staff</h3>
            {ROLES.filter(r => r !== 'usuario').map(role => (
              <div key={role} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{ROLE_ICONS[role]}</span>
                  <h4 className="font-bold text-gray-700 capitalize">{role}s ({staffCounts[role]})</h4>
                </div>
                {users.filter(u => u.role === role).map(u => (
                  <div key={u.id} className="bg-white rounded-xl p-3 mb-2 flex items-center justify-between border border-gray-100">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt="" className="w-10 h-10 rounded-full" />
                      <div>
                        <span className="font-bold text-gray-800">{u.username}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[u.role]}`}>
                          {u.role?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {staffCounts[role] === 0 && (
                  <p className="text-gray-400 text-sm ml-8">Sin {role}s asignados</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-xl p-3 flex items-center justify-between border border-gray-100">
                <div className="flex items-center gap-3">
                  <img src={u.avatar} alt="" className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{u.username}</div>
                    <div className="text-gray-400 text-xs">Lv.{u.level} | 💰{u.coins?.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[u.role || 'usuario']}`}>
                    {ROLE_ICONS[u.role || 'usuario']} {(u.role || 'usuario')}
                  </span>
                  {(user.role === 'dueño' || user.role === 'admin') && u.role !== 'dueño' && (
                    <select
                      value={u.role || 'usuario'}
                      onChange={(e) => setRole(u.id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 bg-gray-50"
                    >
                      {ROLES.filter(r => r !== 'dueño').map(r => (
                        <option key={r} value={r}>{ROLE_ICONS[r]} {r}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => updateUserData(u.id, { coins: (u.coins || 0) + 10000 })}
                    className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold"
                  >
                    +10K
                  </button>
                  {u.role !== 'dueño' && (user.role === 'dueño' || user.role === 'admin') && (
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-xs font-bold"
                    >
                      X
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="space-y-2">
            {rooms.map(r => (
              <div key={r.id} className="bg-white rounded-xl p-3 flex items-center justify-between border border-gray-100">
                <div>
                  <div className="font-bold text-gray-800">{r.name}</div>
                  <div className="text-gray-400 text-xs">Dueño: {r.owner_name} | {r.active_users} usuarios</div>
                </div>
                <button
                  onClick={() => deleteRoom(r.id)}
                  className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold"
                >
                  Eliminar
                </button>
              </div>
            ))}
            {rooms.length === 0 && (
              <p className="text-center py-8 text-gray-400">No hay salas</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
