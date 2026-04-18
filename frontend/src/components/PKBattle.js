import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const formatCoins = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : (n || 0).toLocaleString();

const PKBattle = ({ roomId, userId, onGift }) => {
  const [battle, setBattle] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    loadBattle();
    const i = setInterval(loadBattle, 2000);
    return () => clearInterval(i);
  }, [roomId]);

  useEffect(() => {
    if (!battle) return;
    const expires = new Date(battle.expires_at).getTime();
    const tick = setInterval(() => {
      const left = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) { endBattle(); clearInterval(tick); }
    }, 1000);
    return () => clearInterval(tick);
  }, [battle?.id]);

  const loadBattle = async () => {
    try {
      const r = await axios.get(`${API}/games/pk-battle/${roomId}`);
      if (r.data) setBattle(r.data);
      else setBattle(null);
    } catch (e) { setBattle(null); }
  };

  const endBattle = async () => {
    if (!battle) return;
    try { await axios.post(`${API}/games/pk-battle/${battle.id}/end`); loadBattle(); } catch (e) {}
  };

  if (!battle || battle.status !== 'active') return null;

  const total = (battle.challenger_gifts || 0) + (battle.opponent_gifts || 0) || 1;
  const cPct = Math.round(((battle.challenger_gifts || 0) / total) * 100);
  const oPct = 100 - cPct;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="mx-3 mb-2 bg-gradient-to-r from-blue-900/50 via-gray-900/80 to-red-900/50 rounded-2xl p-3 border border-white/10">
      {/* Timer */}
      <div className="text-center mb-2">
        <span className="text-yellow-400 text-xs font-bold tracking-wider">BATALLA PK</span>
        <div className="text-white font-mono text-lg font-bold">{minutes}:{seconds.toString().padStart(2, '0')}</div>
      </div>

      {/* Names */}
      <div className="flex justify-between mb-1">
        <span className="text-blue-400 text-xs font-bold truncate max-w-[100px]">{battle.challenger_name}</span>
        <span className="text-white/30 text-[10px]">vs</span>
        <span className="text-red-400 text-xs font-bold truncate max-w-[100px]">{battle.opponent_name}</span>
      </div>

      {/* Energy Bar */}
      <div className="relative h-6 bg-gray-800 rounded-full overflow-hidden border border-white/10">
        <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 ease-out"
          style={{width: `${cPct}%`}} />
        <div className="absolute right-0 top-0 h-full bg-gradient-to-l from-red-500 to-red-400 transition-all duration-500 ease-out"
          style={{width: `${oPct}%`}} />
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <span className="text-white text-[10px] font-bold z-10">{formatCoins(battle.challenger_gifts || 0)}</span>
          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white z-10">VS</div>
          <span className="text-white text-[10px] font-bold z-10">{formatCoins(battle.opponent_gifts || 0)}</span>
        </div>
      </div>

      {/* Score */}
      <div className="flex justify-between mt-1">
        <span className="text-blue-300/60 text-[9px]">{cPct}%</span>
        <span className="text-yellow-400/60 text-[9px]">Apuesta: {formatCoins(battle.bet_amount)}</span>
        <span className="text-red-300/60 text-[9px]">{oPct}%</span>
      </div>
    </div>
  );
};

export default PKBattle;
