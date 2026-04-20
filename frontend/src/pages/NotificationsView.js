import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_CONFIG = {
  regalo_global: { icon: '🐉', color: 'from-yellow-500/20 to-orange-500/20', border: 'border-yellow-500/30', label: 'Regalo Global' },
  evento_cp: { icon: '💖', color: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/30', label: 'Evento CP' },
  alerta_conexion: { icon: '🟢', color: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', label: 'Conexion' },
  invitacion: { icon: '🎤', color: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/30', label: 'Invitacion' },
};

const NotificationsView = ({ onBack, onNavigate }) => {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState({ regalos_globales: true, eventos_cp: true, alertas_conexion: true });
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/notifications/${user.id}?limit=30`);
      setNotifications(res.data);
    } catch (err) { /* silent */ }
    setLoading(false);
  }, [user.id]);

  const loadPrefs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/notifications/${user.id}/preferences`);
      setPrefs(res.data);
    } catch (err) { /* silent */ }
  }, [user.id]);

  useEffect(() => {
    loadNotifications();
    loadPrefs();
    axios.post(`${API}/notifications/${user.id}/mark-read`).catch(() => {});
  }, [loadNotifications, loadPrefs, user.id]);

  const togglePref = async (key) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    try {
      await axios.put(`${API}/notifications/${user.id}/preferences`, newPrefs);
      loadNotifications();
    } catch (err) { /* silent */ }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const handleNotifClick = (notif) => {
    if (notif.category === 'invitacion' && notif.data?.room_id && onNavigate) {
      onNavigate('room', notif.data.room_id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button data-testid="notif-back-btn" onClick={onBack} className="bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur border border-white/20">← Volver</button>
          <h1 className="text-xl font-bold text-white">Notificaciones</h1>
          <button data-testid="notif-settings-btn" onClick={() => setShowSettings(!showSettings)} className={`px-4 py-2 rounded-full text-sm font-bold border ${showSettings ? 'bg-cyan-500 text-white border-cyan-400' : 'bg-white/10 text-white border-white/20'}`}>
            {showSettings ? '✕ Cerrar' : '⚙ Ajustes'}
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 mb-4 space-y-3">
            <h3 className="text-white font-bold mb-2">Configurar Notificaciones</h3>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🐉</span>
                <div>
                  <div className="text-white font-bold text-sm">Regalos Globales</div>
                  <div className="text-white/50 text-xs">Ver quien tira leones y fenix</div>
                </div>
              </div>
              <button
                data-testid="toggle-regalos-globales"
                onClick={() => togglePref('regalos_globales')}
                className={`w-12 h-7 rounded-full relative transition-colors ${prefs.regalos_globales ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${prefs.regalos_globales ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💖</span>
                <div>
                  <div className="text-white font-bold text-sm">Eventos de CP/Batallas</div>
                  <div className="text-white/50 text-xs">Competencias en tiempo real</div>
                </div>
              </div>
              <button
                data-testid="toggle-eventos-cp"
                onClick={() => togglePref('eventos_cp')}
                className={`w-12 h-7 rounded-full relative transition-colors ${prefs.eventos_cp ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${prefs.eventos_cp ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🟢</span>
                <div>
                  <div className="text-white font-bold text-sm">Alertas de Conexion</div>
                  <div className="text-white/50 text-xs">Saber quien entro a la app</div>
                </div>
              </div>
              <button
                data-testid="toggle-alertas-conexion"
                onClick={() => togglePref('alertas_conexion')}
                className={`w-12 h-7 rounded-full relative transition-colors ${prefs.alertas_conexion ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${prefs.alertas_conexion ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎤</span>
                <div>
                  <div className="text-white font-bold text-sm">Invitaciones de Estrategia</div>
                  <div className="text-cyan-400 text-xs">Automatico - "Fulano esta en live!"</div>
                </div>
              </div>
              <span className="bg-cyan-500/30 text-cyan-300 text-xs px-3 py-1 rounded-full font-bold">AUTO</span>
            </div>
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="text-center py-12 text-white/40">Cargando...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <div className="text-5xl mb-3">🔔</div>
            <p>No hay notificaciones</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(notif => {
              const cfg = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.invitacion;
              const isClickable = notif.category === 'invitacion' && notif.data?.room_id;
              return (
                <button
                  key={notif.id}
                  data-testid={`notif-item-${notif.id}`}
                  onClick={() => handleNotifClick(notif)}
                  disabled={!isClickable}
                  className={`w-full text-left bg-gradient-to-r ${cfg.color} backdrop-blur border ${cfg.border} rounded-xl p-3 transition-all ${isClickable ? 'hover:scale-[1.01] cursor-pointer' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0 mt-0.5">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-white font-bold text-sm">{notif.title}</span>
                        <span className="text-white/40 text-xs flex-shrink-0 ml-2">{timeAgo(notif.created_at)}</span>
                      </div>
                      <p className="text-white/70 text-xs">{notif.message}</p>
                      {isClickable && (
                        <span className="text-cyan-400 text-xs font-bold mt-1 inline-block">Entrar a la sala →</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
