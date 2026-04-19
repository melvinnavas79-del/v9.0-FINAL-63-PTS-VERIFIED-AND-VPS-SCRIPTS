import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * GiftRanking — podio global de top gifters con 3 ventanas temporales:
 *   - Diario (desde 00:00 UTC)
 *   - Semanal (desde lunes 00:00 UTC)
 *   - Mensual (desde día 1 del mes)
 * El #1 lleva 👑 corona animada, top 3 tienen medallas, resto lista compacta.
 * Auto-refresh cada 30 s.
 */
const GiftRanking = ({ roomId = null, onClose }) => {
  const [window, setWindow] = useState('daily');
  const [data, setData] = useState({ leaderboard: [] });
  const [loading, setLoading] = useState(false);

  const load = async (w) => {
    setLoading(true);
    try {
      const url = roomId
        ? `${API}/rankings/gifts/room/${roomId}?window=${w}&limit=20`
        : `${API}/rankings/gifts?window=${w}&limit=20`;
      const r = await axios.get(url);
      setData(r.data);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(window); }, [window, roomId]);
  useEffect(() => {
    const t = setInterval(() => load(window), 30000);
    return () => clearInterval(t);
  }, [window]);

  const tabs = [
    { id: 'daily', label: 'Hoy' },
    { id: 'weekly', label: 'Semana' },
    { id: 'monthly', label: 'Mes' },
  ];

  return (
    <div className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" data-testid="gift-ranking-modal"
      onClick={onClose}
      style={{ paddingTop: 'env(safe-area-inset-top, 20px)', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
      <div className="bg-gradient-to-b from-[#2a0f3c] to-[#0f0620] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-hidden border-t border-yellow-400/20 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20">
          <div>
            <h3 className="text-white font-black text-base flex items-center gap-2">
              👑 Top Gifters
            </h3>
            <p className="text-yellow-200/70 text-[10px]">{roomId ? 'Esta sala' : 'Global'}</p>
          </div>
          <button data-testid="gift-ranking-close" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 text-white text-lg">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-3 bg-black/20">
          {tabs.map(t => (
            <button key={t.id} data-testid={`gift-rank-tab-${t.id}`} onClick={() => setWindow(t.id)}
              className={`flex-1 text-xs font-bold py-2 rounded-t-xl transition-colors ${
                window === t.id ? 'bg-gradient-to-b from-yellow-500/30 to-transparent text-yellow-300 border-b-2 border-yellow-400' : 'text-white/50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
          {/* Podium top 3 */}
          {data.leaderboard.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4 items-end">
              {[1, 0, 2].map(idx => {
                const p = data.leaderboard[idx];
                if (!p) return <div key={idx} className="h-24" />;
                const heights = { 0: 'h-32', 1: 'h-28', 2: 'h-24' };
                const emojis = { 0: '🥇', 1: '🥈', 2: '🥉' };
                const grads = {
                  0: 'from-yellow-400 to-amber-600',
                  1: 'from-gray-300 to-slate-500',
                  2: 'from-orange-400 to-amber-700',
                };
                return (
                  <div key={idx} className={`bg-white/5 rounded-xl ${heights[idx]} p-2 flex flex-col items-center justify-between border border-white/10 relative`}>
                    {idx === 0 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl" style={{ animation: 'crownBob 2s ease-in-out infinite' }}>
                        👑
                      </div>
                    )}
                    <div className="text-xl mt-1">{emojis[idx]}</div>
                    <img src={p.avatar} alt="" className={`w-10 h-10 rounded-full border-2 ${idx === 0 ? 'border-yellow-300' : 'border-white/30'} object-cover`}
                      style={idx === 0 ? { boxShadow: '0 0 12px rgba(255,215,0,0.6)' } : {}} />
                    <div className="text-white text-[10px] font-bold truncate w-full text-center leading-tight">{p.username}</div>
                    <div className={`text-transparent bg-clip-text bg-gradient-to-r ${grads[idx]} text-[10px] font-black`}>
                      {(p.total_spent || 0) >= 1e6 ? `${(p.total_spent / 1e6).toFixed(1)}M` : (p.total_spent || 0).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rest of leaderboard */}
          <div className="space-y-1.5">
            {data.leaderboard.slice(3).map((p) => (
              <div key={p.user_id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-white/50 text-xs font-bold w-6">#{p.rank}</span>
                <img src={p.avatar} alt="" className="w-7 h-7 rounded-full" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-bold truncate">{p.username}</div>
                  <div className="text-white/40 text-[10px]">{p.gift_count} regalos enviados</div>
                </div>
                <span className="text-yellow-300 text-xs font-bold">
                  {(p.total_spent || 0) >= 1e6 ? `${(p.total_spent / 1e6).toFixed(1)}M` : (p.total_spent || 0).toLocaleString()}
                </span>
              </div>
            ))}
            {data.leaderboard.length === 0 && (
              <div className="text-white/40 text-xs text-center py-12">
                {loading ? 'Cargando…' : 'Aún no hay regalos en este período. ¡Sé el primero en llevar la corona! 👑'}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes crownBob {
          0%,100% { transform: translate(-50%, 0) rotate(-4deg); }
          50%     { transform: translate(-50%, -4px) rotate(4deg); }
        }
      `}</style>
    </div>
  );
};

export default GiftRanking;
