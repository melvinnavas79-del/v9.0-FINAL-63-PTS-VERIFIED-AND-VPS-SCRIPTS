import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * LevelBadge — muestra nivel + barra de progreso XP compacta.
 * Hace polling cada 30s y se refresca cuando cambia el usuario.
 * Diseño premium con gradiente neón + glow.
 */
const LevelBadge = ({ userId, onClick }) => {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const load = async () => {
      try {
        const r = await axios.get(`${API}/levels/me/${userId}`);
        if (mounted) setInfo(r.data);
      } catch (e) {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, [userId]);

  if (!info) return null;

  const colors = info.level >= 50
    ? { from: '#ff4da6', to: '#ff9500', glow: 'rgba(255,77,166,0.5)' }
    : info.level >= 20
    ? { from: '#a855f7', to: '#6366f1', glow: 'rgba(168,85,247,0.4)' }
    : info.level >= 10
    ? { from: '#06b6d4', to: '#3b82f6', glow: 'rgba(6,182,212,0.4)' }
    : { from: '#64748b', to: '#475569', glow: 'rgba(100,116,139,0.3)' };

  return (
    <button
      data-testid="level-badge"
      onClick={onClick}
      className="flex items-center gap-2 bg-white/5 rounded-full px-2 py-1 active:scale-95 transition-transform"
      title={`Nivel ${info.level} · ${info.xp_into_level}/${info.xp_needed_for_next} XP`}
    >
      <div
        className="relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
          boxShadow: `0 0 10px ${colors.glow}, inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.2)`,
        }}
      >
        <span className="text-[11px] font-black text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
          {info.level}
        </span>
      </div>
      <div className="hidden sm:block w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${info.progress_pct}%`,
            background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
          }}
        />
      </div>
    </button>
  );
};

export default LevelBadge;
