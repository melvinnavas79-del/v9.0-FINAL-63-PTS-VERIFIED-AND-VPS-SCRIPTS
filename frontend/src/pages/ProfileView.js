import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ProfileView = ({ onBack, onNavigate }) => {
  const { user, logout, updateUser } = useUser();
  const [ghostMode, setGhostMode] = useState(user?.ghost_mode || false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

        <h2 className="text-3xl font-bold text-white text-center mb-3">{user.username}</h2>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {(user.badges || []).map((badge, i) => (
            <span key={i} className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-bold backdrop-blur">
              {badge}
            </span>
          ))}
          {user.role === 'dueño' && (
            <span className="bg-yellow-500/80 text-white text-xs px-3 py-1 rounded-full font-bold">👑 Dueño</span>
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
            <div className="text-2xl font-bold text-gray-800">{(user.coins || 0).toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl mb-1">💎</div>
            <div className="text-gray-500 text-sm">Diamantes</div>
            <div className="text-2xl font-bold text-gray-800">{(user.diamonds || 0).toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl mb-1">💸</div>
            <div className="text-gray-500 text-sm">Total Gastado</div>
            <div className="text-2xl font-bold text-gray-800">{(user.total_spent || 0).toLocaleString()}</div>
          </div>
        </div>

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

        {/* Config */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Configuracion</h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-gray-700 font-medium">Modo Fantasma</span>
              {ghostMode && <p className="text-green-500 text-xs">Oculto de rankings y busquedas</p>}
            </div>
            <button onClick={toggleGhostMode}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold ${ghostMode ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              {ghostMode ? 'Activado' : 'Desactivado'}
            </button>
          </div>
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
            <button onClick={() => onNavigate('admin')}
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
