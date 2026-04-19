import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * CrownBadge — pequeña corona animada al lado del username
 * si ese usuario es actualmente Daily/Weekly/Monthly King de regalos.
 * Auto-refresh cada 60 s; pasa el userId y se oculta si no aplica.
 */
const CrownBadge = ({ userId, size = 14 }) => {
  const [kingType, setKingType] = useState(null); // 'monthly' | 'weekly' | 'daily' | null

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const check = async () => {
      try {
        const r = await axios.get(`${API}/rankings/gifts/crown`);
        if (!mounted) return;
        const d = r.data || {};
        if (d.monthly_king?.user_id === userId) setKingType('monthly');
        else if (d.weekly_king?.user_id === userId) setKingType('weekly');
        else if (d.daily_king?.user_id === userId) setKingType('daily');
        else setKingType(null);
      } catch (e) { /* silent */ }
    };
    check();
    const t = setInterval(check, 60000);
    return () => { mounted = false; clearInterval(t); };
  }, [userId]);

  if (!kingType) return null;

  // Color intensity per tier
  const config = {
    monthly: { color: '#ffd700', glow: '0 0 6px #ffd700cc', title: 'Rey de Regalos del Mes' },
    weekly:  { color: '#ff9500', glow: '0 0 5px #ff950099', title: 'Rey de Regalos de la Semana' },
    daily:   { color: '#ffb86b', glow: '0 0 4px #ffb86b88', title: 'Rey de Regalos del Día' },
  }[kingType];

  return (
    <span
      data-testid={`crown-badge-${kingType}`}
      title={config.title}
      className="inline-block align-middle"
      style={{ fontSize: size, filter: `drop-shadow(${config.glow})`, animation: 'crownPulse 2s ease-in-out infinite' }}
    >
      👑
      <style>{`
        @keyframes crownPulse {
          0%,100% { transform: rotate(-6deg) scale(1); }
          50%     { transform: rotate(6deg) scale(1.1); }
        }
      `}</style>
    </span>
  );
};

export default CrownBadge;
