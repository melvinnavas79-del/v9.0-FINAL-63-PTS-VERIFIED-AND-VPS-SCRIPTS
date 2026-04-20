/**
 * SystemHealthPanel — Panel visual de "Salud del Sistema".
 * Consume /api/bot/super/integrity + /api/bot/super/errors + /errors/stats.
 * Solo para dueño. Auto-refresh cada 20s.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const severityColor = (s) => ({
  high: 'bg-red-500 text-white',
  medium: 'bg-yellow-400 text-yellow-900',
  low: 'bg-blue-400 text-white',
}[s] || 'bg-gray-500 text-white');

const SystemHealthPanel = ({ userId }) => {
  const [integrity, setIntegrity] = useState(null);
  const [errors, setErrors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('integrity');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [i, e, s] = await Promise.all([
        axios.get(`${API}/bot/super/integrity?admin_id=${userId}`),
        axios.get(`${API}/bot/super/errors?admin_id=${userId}&resolved=false&limit=30`),
        axios.get(`${API}/bot/super/errors/stats?admin_id=${userId}`),
      ]);
      setIntegrity(i.data);
      setErrors(e.data || []);
      setStats(s.data);
    } catch (err) {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 20000);
    return () => clearInterval(t);
  }, [userId]);

  const resolveError = async (id) => {
    try {
      await axios.post(`${API}/bot/super/errors/${id}/resolve?admin_id=${userId}`);
      setErrors((prev) => prev.filter((e) => e.id !== id));
    } catch (e) { alert('Error al marcar como resuelto'); }
  };

  const isHealthy = integrity?.healthy && (stats?.unresolved || 0) === 0;

  return (
    <div className="p-4 space-y-4" data-testid="system-health-panel">
      {/* Semáforo */}
      <div className={`rounded-2xl p-4 border-2 ${isHealthy ? 'bg-green-900/30 border-green-500' : 'bg-red-900/30 border-red-500'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl ${isHealthy ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}>
            {isHealthy ? '✅' : '⚠️'}
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${isHealthy ? 'text-green-300' : 'text-red-300'}`}>
              {isHealthy ? 'Sistema Operativo' : 'Atención requerida'}
            </h3>
            <p className="text-gray-300 text-sm">
              {integrity?.issues_count || 0} problemas de integridad · {stats?.unresolved || 0} errores sin resolver
            </p>
          </div>
          <button data-testid="health-refresh-btn" onClick={loadAll} disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg px-3 py-2 font-semibold">
            {loading ? '…' : '↻'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {['integrity', 'errors', 'stats'].map((t) => (
          <button key={t} data-testid={`health-tab-${t}`} onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-bold transition ${tab === t ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-gray-400'}`}>
            {t === 'integrity' ? '🩺 Integridad' : t === 'errors' ? '🐛 Errores' : '📊 Estadísticas'}
          </button>
        ))}
      </div>

      {/* INTEGRITY */}
      {tab === 'integrity' && integrity && (
        <div className="space-y-2" data-testid="health-integrity-list">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800/80 rounded-lg p-3 text-center">
              <div className="text-cyan-300 text-xl font-bold">{(integrity.totals?.users || 0).toLocaleString()}</div>
              <div className="text-gray-400 text-[10px]">Usuarios</div>
            </div>
            <div className="bg-gray-800/80 rounded-lg p-3 text-center">
              <div className="text-amber-300 text-sm font-bold">{(integrity.totals?.coins_in_economy || 0).toLocaleString()}</div>
              <div className="text-gray-400 text-[10px]">Monedas</div>
            </div>
            <div className="bg-gray-800/80 rounded-lg p-3 text-center">
              <div className="text-sky-300 text-sm font-bold">{(integrity.totals?.diamonds_in_economy || 0).toLocaleString()}</div>
              <div className="text-gray-400 text-[10px]">Diamantes</div>
            </div>
          </div>
          {(integrity.issues || []).length === 0 ? (
            <div className="text-green-400 text-center py-6">Sin problemas de integridad 🎉</div>
          ) : (
            integrity.issues.map((i, idx) => (
              <div key={idx} data-testid={`integrity-issue-${idx}`} className="bg-gray-800/80 rounded-lg p-3 border-l-4 border-yellow-500">
                <div className="flex items-start gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${severityColor(i.severity)}`}>{(i.severity || '').toUpperCase()}</span>
                  <span className="text-gray-400 text-[10px] font-mono">{i.file}</span>
                </div>
                <p className="text-gray-200 text-xs">{i.bot_report || i.detail}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ERRORS */}
      {tab === 'errors' && (
        <div className="space-y-2" data-testid="health-errors-list">
          {errors.length === 0 ? (
            <div className="text-green-400 text-center py-6">Sin errores sin resolver 🎉</div>
          ) : (
            errors.map((e) => (
              <div key={e.id} data-testid={`error-item-${e.id}`} className="bg-gray-800/80 rounded-lg p-3 border-l-4 border-red-500">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-red-300 text-[11px] font-mono font-bold">{e.type}</div>
                    <div className="text-gray-400 text-[10px] font-mono truncate">{e.file}:{e.line} · {e.function}</div>
                  </div>
                  <button data-testid={`resolve-error-${e.id}`} onClick={() => resolveError(e.id)}
                    className="flex-shrink-0 bg-green-700 hover:bg-green-600 text-white text-[10px] rounded-md px-2 py-1 font-bold">
                    ✓ Resuelto
                  </button>
                </div>
                <p className="text-gray-200 text-xs mb-1">{e.bot_report}</p>
                {e.hint && <p className="text-cyan-300 text-[11px] italic">💡 {e.hint}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* STATS */}
      {tab === 'stats' && stats && (
        <div className="space-y-3" data-testid="health-stats">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/80 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-cyan-300">{stats.last_24h || 0}</div>
              <div className="text-gray-400 text-[10px]">Errores 24h</div>
            </div>
            <div className="bg-gray-800/80 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-red-400">{stats.unresolved || 0}</div>
              <div className="text-gray-400 text-[10px]">Sin resolver</div>
            </div>
          </div>

          {(stats.by_file || []).length > 0 && (
            <div>
              <h4 className="text-gray-300 text-xs font-bold mb-1">Top archivos con errores</h4>
              <div className="space-y-1">
                {stats.by_file.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-800/60 rounded px-2 py-1.5">
                    <div className="text-gray-300 text-[11px] font-mono truncate flex-1">{f.file}</div>
                    <div className="bg-red-600/30 text-red-300 text-[10px] rounded px-2 py-0.5 font-bold">{f.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(stats.by_type || []).length > 0 && (
            <div>
              <h4 className="text-gray-300 text-xs font-bold mb-1">Top tipos de error</h4>
              <div className="space-y-1">
                {stats.by_type.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-800/60 rounded px-2 py-1.5">
                    <div className="text-gray-300 text-[11px] font-mono truncate flex-1">{t.type}</div>
                    <div className="bg-yellow-600/30 text-yellow-300 text-[10px] rounded px-2 py-0.5 font-bold">{t.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemHealthPanel;
