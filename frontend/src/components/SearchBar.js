/**
 * SearchBar — búsqueda de usuarios por username o ID numérico (6 dígitos).
 * Al seleccionar un resultado, muestra una tarjeta con botón "Seguir" y
 * "Entrar a su sala" si está activo.
 */
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SearchBar = ({ onEnterRoom }) => {
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null); // usuario seleccionado
  const [following, setFollowing] = useState(false);
  const timerRef = useRef(null);

  const performSearch = async (q) => {
    if (!q || q.trim().length < 2) { setResult(null); setError(''); return; }
    setLoading(true);
    setError('');
    try {
      const isNumeric = /^\d{3,10}$/.test(q.trim());
      const url = isNumeric
        ? `${API}/social/search-by-id/${encodeURIComponent(q.trim())}`
        : `${API}/users/search/${encodeURIComponent(q.trim())}`;
      const r = await axios.get(url);
      setResult(r.data);
    } catch (e) {
      setResult(null);
      setError('Usuario no encontrado');
    }
    setLoading(false);
  };

  const onChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => performSearch(v), 350);
  };

  const openDetail = async (u) => {
    setDetail(u);
    setOpen(false);
    try {
      const s = await axios.get(`${API}/social/follow-status?follower_id=${user.id}&target_id=${u.id}`);
      setFollowing(s.data?.following || false);
    } catch (e) { setFollowing(false); }
  };

  const toggleFollow = async () => {
    if (!detail) return;
    try {
      if (following) {
        await axios.delete(`${API}/social/follow`, { data: { follower_id: user.id, target_id: detail.id } });
        setFollowing(false);
      } else {
        await axios.post(`${API}/social/follow`, { follower_id: user.id, target_id: detail.id });
        setFollowing(true);
      }
    } catch (e) { alert('Error al actualizar'); }
  };

  const closeDetail = () => {
    setDetail(null);
    setQuery('');
    setResult(null);
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 bg-white/80 backdrop-blur rounded-full border border-gray-200 px-3 py-2 shadow-sm">
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          data-testid="search-user-input"
          type="text"
          value={query}
          onChange={onChange}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por usuario o ID (6 dígitos)"
          className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResult(null); setError(''); }}
            className="text-gray-400 text-sm hover:text-gray-600">✕</button>
        )}
      </div>

      {open && query.length >= 2 && !detail && (
        <div data-testid="search-user-dropdown" className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-80 overflow-y-auto">
          {loading && <div className="px-4 py-3 text-gray-400 text-sm">Buscando…</div>}
          {!loading && error && <div className="px-4 py-3 text-gray-400 text-sm">{error}</div>}
          {!loading && result && (
            <button
              data-testid={`search-result-${result.id}`}
              onClick={() => openDetail(result)}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 active:bg-gray-100 text-left transition"
            >
              <img src={result.avatar} alt="" className="w-11 h-11 rounded-full border-2 border-blue-200 object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 text-sm truncate">{result.username}</div>
                <div className="text-gray-400 text-[11px]">
                  ID: <span className="font-mono text-gray-600">{result.numeric_id || '—'}</span>
                  {result.level ? <span className="ml-2">Nivel {result.level}</span> : null}
                </div>
              </div>
              <div className="text-cyan-500 text-xs font-semibold">Ver →</div>
            </button>
          )}
        </div>
      )}

      {detail && (
        <div data-testid="user-detail-modal" className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <img src={detail.avatar} alt="" className="w-16 h-16 rounded-full border-2 border-cyan-300 object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 truncate">{detail.username}</div>
                <div className="text-gray-500 text-xs">ID: <span className="font-mono">{detail.numeric_id || '—'}</span></div>
                <div className="text-[11px] text-gray-400">Nivel {detail.level || 1} · SVIP {detail.svip_level || 0}</div>
              </div>
              <button onClick={closeDetail} className="text-gray-300 text-xl">✕</button>
            </div>
            {detail.id !== user.id && (
              <button
                data-testid="toggle-follow-btn"
                onClick={toggleFollow}
                className={`w-full rounded-full py-2.5 font-bold text-sm transition-all ${
                  following
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:shadow-lg'
                }`}
              >
                {following ? '✓ Siguiendo (tocar para dejar)' : '+ Seguir'}
              </button>
            )}
            {detail.id === user.id && (
              <div className="text-center text-xs text-gray-400">Eres tú mismo 🙂</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
