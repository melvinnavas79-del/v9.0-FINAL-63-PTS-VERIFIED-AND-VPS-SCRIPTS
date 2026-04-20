/**
 * FriendsActiveStrip — tira horizontal con amigos actualmente en salas.
 * Click → navega directo a la sala del amigo. Auto-refresh cada 15s.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FriendsActiveStrip = ({ userId, onEnterRoom }) => {
  const [friends, setFriends] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const r = await axios.get(`${API}/social/friends-active/${userId}`);
      setFriends(r.data || []);
    } catch (e) {
      setFriends([]);
    }
    setLoaded(true);
  };

  useEffect(() => {
    if (!userId) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [userId]);

  if (!loaded) return null;
  if (friends.length === 0) {
    return (
      <div data-testid="friends-active-empty" className="bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-2xl px-4 py-3 border border-emerald-100 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🟢</span>
          <div className="flex-1 text-xs text-emerald-700">
            Sigue a otros usuarios para ver cuándo entran a una sala
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="friends-active-strip" className="mb-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          Amigos activos ahora
        </h3>
        <span className="text-[11px] text-emerald-600 font-semibold">{friends.length}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1" style={{ scrollbarWidth: 'none' }}>
        {friends.map((f) => (
          <button
            key={f.user_id}
            data-testid={`friend-active-${f.user_id}`}
            onClick={() => onEnterRoom?.(f.room_id)}
            className="flex-shrink-0 flex flex-col items-center gap-1 group"
            title={`${f.username} en ${f.room_name}`}
          >
            <div className="relative">
              <img
                src={f.avatar}
                alt={f.username}
                className="w-14 h-14 rounded-full object-cover border-2 border-emerald-400 group-active:scale-95 transition-transform"
              />
              <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 border-2 border-white rounded-full w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-white rounded-full text-[10px] px-1 font-bold text-emerald-700 shadow-sm">
                🎤
              </span>
            </div>
            <span className="text-[10px] text-gray-700 font-semibold truncate w-16 text-center">
              {f.username}
            </span>
            <span className="text-[9px] text-emerald-600 truncate w-16 text-center">
              {f.room_name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FriendsActiveStrip;
