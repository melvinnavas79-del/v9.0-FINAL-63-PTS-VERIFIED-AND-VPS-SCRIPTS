import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ==================== TOOL CALL CARD ====================
const ToolCallCard = ({ call, index }) => {
  const [open, setOpen] = useState(false);
  const isError = call.result?.error;

  return (
    <div className={`rounded-xl border text-xs overflow-hidden transition-all ${isError ? 'border-red-500/40 bg-red-900/20' : 'border-purple-500/30 bg-purple-900/20'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className={`text-base ${isError ? '❌' : '🔧'}`}>{isError ? '❌' : '🔧'}</span>
        <span className={`font-mono font-bold flex-1 ${isError ? 'text-red-300' : 'text-purple-300'}`}>
          {call.tool}
        </span>
        {call.cost > 0 && (
          <span className="bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full text-[10px]">
            -{call.cost} 💰
          </span>
        )}
        <span className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5">
          {Object.keys(call.args || {}).length > 0 && (
            <div>
              <p className="text-gray-500 mt-2 mb-1">Args:</p>
              <pre className="bg-black/30 rounded p-2 overflow-x-auto text-green-300 whitespace-pre-wrap break-all">
                {JSON.stringify(call.args, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <p className="text-gray-500 mb-1">Resultado:</p>
            <pre className={`bg-black/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all ${isError ? 'text-red-300' : 'text-cyan-300'}`}>
              {JSON.stringify(call.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MESSAGE BUBBLE ====================
const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">{msg.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? '' : 'w-full'}`}>
        {!isUser && (
          <div className="space-y-2">
            {/* Tool calls ANTES del texto */}
            {(msg.tool_calls || []).map((call, i) => (
              <ToolCallCard key={i} call={call} index={i} />
            ))}
            {/* Texto de respuesta */}
            {msg.content && (
              <div className="bg-gray-800/80 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.total_cost > 0 && (
                  <p className="text-[10px] text-yellow-500/70 mt-1 text-right">-{msg.total_cost} 💰 · {msg.rounds || 1} ronda{msg.rounds !== 1 ? 's' : ''}</p>
                )}
              </div>
            )}
          </div>
        )}
        {isUser && (
          <div className="bg-blue-600/80 rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-white text-sm leading-relaxed">{msg.content}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== AGENT CARD ====================
const AgentCard = ({ agent, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(agent)}
      className="w-full text-left bg-gray-800/60 border border-white/10 rounded-2xl p-4 hover:border-white/30 hover:bg-gray-700/60 active:scale-95 transition-all"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg"
          style={{ background: `${agent.color}33`, border: `1px solid ${agent.color}55` }}
        >
          {agent.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm">{agent.name}</span>
            {agent.requires_admin && (
              <span className="text-[10px] bg-purple-600/30 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                ADMIN
              </span>
            )}
          </div>
          <p className="text-gray-400 text-xs mt-0.5 leading-snug">{agent.tagline}</p>
          {agent.tools_count > 0 && (
            <p className="text-[10px] text-gray-500 mt-1.5">
              🔧 {agent.tools_count} herramientas disponibles
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

// ==================== VPS PANEL ====================
const VPSPanel = ({ userId, onClose }) => {
  const [vpsList, setVpsList] = useState([]);
  const [form, setForm] = useState({ name: '', host: '', port: 22, ssh_user: 'root', key_path: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadVPS();
  }, []);

  const loadVPS = async () => {
    try {
      const res = await axios.get(`${API}/vps/list?user_id=${userId}`);
      setVpsList(res.data.vps || []);
    } catch (e) { /* silent */ }
  };

  const handleRegister = async () => {
    if (!form.name || !form.host) return setMsg('Nombre y host son requeridos');
    setSaving(true);
    setMsg('');
    try {
      await axios.post(`${API}/vps/register`, { ...form, user_id: userId, port: Number(form.port) });
      setMsg('✅ VPS registrado');
      setForm({ name: '', host: '', port: 22, ssh_user: 'root', key_path: '', notes: '' });
      loadVPS();
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Error al registrar');
    }
    setSaving(false);
  };

  const handleDelete = async (vpsId) => {
    try {
      await axios.delete(`${API}/vps/${vpsId}?user_id=${userId}`);
      loadVPS();
    } catch (e) { /* silent */ }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center pb-safe" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">🖥️ Mis VPS</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">✕</button>
        </div>

        {/* Lista */}
        {vpsList.length > 0 && (
          <div className="space-y-2">
            {vpsList.map(v => (
              <div key={v.id} className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-bold">{v.name}</p>
                  <p className="text-gray-400 text-xs">{v.ssh_user}@{v.host}:{v.port}</p>
                </div>
                <button onClick={() => handleDelete(v.id)} className="text-red-400 text-sm px-2 py-1 hover:bg-red-500/20 rounded-lg">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Formulario */}
        <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <p className="text-gray-300 text-sm font-bold">Registrar nuevo VPS</p>
          {[
            { key: 'name', label: 'Nombre', placeholder: 'Mi VPS Contabo' },
            { key: 'host', label: 'Host / IP', placeholder: '192.168.1.1' },
            { key: 'ssh_user', label: 'Usuario SSH', placeholder: 'root' },
            { key: 'port', label: 'Puerto', placeholder: '22', type: 'number' },
            { key: 'key_path', label: 'Ruta clave SSH (opcional)', placeholder: '/root/.ssh/id_rsa' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-gray-400 text-xs mb-1 block">{f.label}</label>
              <input
                type={f.type || 'text'}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
          {msg && <p className={`text-xs ${msg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
          <button
            onClick={handleRegister}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
          >
            {saving ? 'Registrando...' : '+ Registrar VPS'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN VIEW ====================
const AgentsView = ({ onBack }) => {
  const { user } = useUser();
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [showVPS, setShowVPS] = useState(false);
  const [provider, setProvider] = useState('auto');
  const [sessionId] = useState(() => `sess_${Date.now()}`);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const isAdmin = user?.role === 'dueño' || user?.is_super_admin;

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const res = await axios.get(`${API}/console/agents?user_id=${user?.id}&is_admin=${isAdmin}`);
      setAgents(res.data.agents || []);
    } catch (e) {
      setAgents([]);
    }
    setLoadingAgents(false);
  };

  const selectAgent = (agent) => {
    setSelectedAgent(agent);
    const stored = localStorage.getItem(`lluvia_agent_${agent.id}_history`);
    if (stored) {
      try { setMessages(JSON.parse(stored)); } catch { setMessages([]); }
    } else {
      setMessages([{
        role: 'system',
        content: `Conversación con ${agent.emoji} ${agent.name}`,
      }]);
    }
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const clearChat = () => {
    if (!selectedAgent) return;
    const welcome = [{ role: 'system', content: `Conversación con ${selectedAgent.emoji} ${selectedAgent.name}` }];
    setMessages(welcome);
    localStorage.removeItem(`lluvia_agent_${selectedAgent.id}_history`);
  };

  const saveHistory = useCallback((msgs, agentId) => {
    // Guardar solo los últimos 40 mensajes para no saturar localStorage
    const toSave = msgs.filter(m => m.role !== 'system').slice(-40);
    localStorage.setItem(`lluvia_agent_${agentId}_history`, JSON.stringify(toSave));
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || loading || !selectedAgent) return;
    setInput('');

    const userMsg = { role: 'user', content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    // Construir historial para la API (solo user/assistant, sin system markers)
    const apiHistory = nextMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const chatBody = {
        user_id: user.id,
        agent_id: selectedAgent.id,
        messages: apiHistory,
        session_id: sessionId,
      };
      if (provider !== 'auto') chatBody.provider = provider;

      const res = await axios.post(`${API}/console/chat`, chatBody);

      const assistantMsg = {
        role: 'assistant',
        content: res.data.text || '',
        tool_calls: res.data.tool_calls || [],
        total_cost: res.data.total_cost || 0,
        rounds: res.data.rounds || 1,
      };

      const updated = [...nextMessages, assistantMsg];
      setMessages(updated);
      saveHistory(updated, selectedAgent.id);
    } catch (e) {
      const errText = e.response?.data?.detail || 'Error al contactar al agente.';
      setMessages(prev => [...prev, {
        role: 'system',
        content: `⚠️ ${errText}`,
      }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ======= CHAT VIEW =======
  if (selectedAgent) {
    return (
      <div className="flex flex-col h-screen bg-gray-950 text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/90 border-b border-white/10 shrink-0">
          <button
            onClick={() => setSelectedAgent(null)}
            className="text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10"
          >
            ←
          </button>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: `${selectedAgent.color}33` }}
          >
            {selectedAgent.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm leading-none">{selectedAgent.name}</p>
            <p className="text-gray-400 text-[11px] truncate">{selectedAgent.tagline}</p>
          </div>
          <div className="flex gap-1 items-center">
            {/* Provider selector */}
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="bg-gray-800 border border-white/10 text-gray-300 text-xs rounded-lg px-2 py-1.5 outline-none"
              title="Proveedor LLM"
            >
              <option value="auto">🤖 Auto</option>
              <option value="gemini">🔵 Gemini</option>
              <option value="openai">🟢 GPT</option>
            </select>
            {selectedAgent.id === 'vps_ops' || selectedAgent.id === 'super_lluvia' ? (
              <button
                onClick={() => setShowVPS(true)}
                className="text-gray-400 hover:text-white text-sm px-2 py-1.5 rounded-lg hover:bg-white/10"
                title="Gestionar VPS"
              >
                🖥️
              </button>
            ) : null}
            <button
              onClick={clearChat}
              className="text-gray-400 hover:text-white text-sm px-2 py-1.5 rounded-lg hover:bg-white/10"
              title="Limpiar chat"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {loading && (
            <div className="flex justify-start mb-3">
              <div className="bg-gray-800/80 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        {messages.filter(m => m.role !== 'system').length === 0 && !loading && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
            {_quickActions(selectedAgent.id).map((qa, i) => (
              <button
                key={i}
                onClick={() => sendMessage(qa)}
                className="shrink-0 bg-gray-800 border border-white/10 text-gray-300 text-xs rounded-full px-3 py-1.5 hover:bg-gray-700 active:scale-95 transition-all"
              >
                {qa}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div
          className="shrink-0 px-4 py-3 bg-gray-900/80 border-t border-white/10"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={`Escribe a ${selectedAgent.name}...`}
              rows={1}
              className="flex-1 bg-gray-800 border border-white/10 text-white text-sm rounded-2xl px-4 py-3 outline-none focus:border-blue-500/50 resize-none placeholder-gray-500 transition-colors max-h-32 overflow-y-auto"
              style={{ minHeight: '44px' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all"
              style={{
                background: input.trim() && !loading
                  ? `linear-gradient(135deg, ${selectedAgent.color}, ${selectedAgent.color}99)`
                  : 'rgba(255,255,255,0.08)',
              }}
            >
              <span className="text-white text-lg">↑</span>
            </button>
          </div>
        </div>

        {showVPS && <VPSPanel userId={user.id} onClose={() => setShowVPS(false)} />}
      </div>
    );
  }

  // ======= AGENT SELECTION =======
  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/80 border-b border-white/10 shrink-0">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10"
        >
          ←
        </button>
        <div>
          <h1 className="font-bold text-white text-base leading-none">Agentes IA</h1>
          <p className="text-gray-400 text-xs">Elige un agente para comenzar</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowVPS(true)}
            className="ml-auto text-gray-400 hover:text-white text-sm flex items-center gap-1.5 bg-gray-800 border border-white/10 px-3 py-1.5 rounded-xl hover:bg-gray-700 transition-colors"
          >
            <span>🖥️</span>
            <span className="text-xs">VPS</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>

        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/20 rounded-2xl p-4">
          <p className="text-white font-bold text-sm">🤖 Agentes con function calling</p>
          <p className="text-gray-300 text-xs mt-1 leading-relaxed">
            Cada agente usa Gemini con herramientas reales: gestión de apps, VPS, WhatsApp, Stripe y más.
          </p>
        </div>

        {loadingAgents ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">🤖</p>
            <p>No hay agentes disponibles</p>
            <p className="text-xs mt-1">Verifica que GEMINI_API_KEY esté configurada</p>
          </div>
        ) : (
          <>
            {/* Agentes normales */}
            {agents.filter(a => !a.requires_admin).length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider px-1">Asistentes</p>
                {agents.filter(a => !a.requires_admin).map(agent => (
                  <AgentCard key={agent.id} agent={agent} onSelect={selectAgent} />
                ))}
              </div>
            )}

            {/* Agentes admin */}
            {isAdmin && agents.filter(a => a.requires_admin).length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider px-1">⚡ Admin / Super Agentes</p>
                {agents.filter(a => a.requires_admin).map(agent => (
                  <AgentCard key={agent.id} agent={agent} onSelect={selectAgent} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Historial reciente */}
        {agents.length > 0 && (
          <RecentHistory userId={user?.id} agents={agents} onSelect={selectAgent} />
        )}
      </div>

      {showVPS && <VPSPanel userId={user.id} onClose={() => setShowVPS(false)} />}
    </div>
  );
};

// ==================== RECENT HISTORY ====================
const RecentHistory = ({ userId, agents, onSelect }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/console/history?user_id=${userId}&limit=5`);
        setHistory(res.data.history || []);
      } catch { /* silent */ }
    };
    if (userId) load();
  }, [userId]);

  if (!history.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider px-1">Conversaciones recientes</p>
      {history.map((h, i) => {
        const agent = agents.find(a => a.id === h.agent_id);
        return (
          <button
            key={i}
            onClick={() => agent && onSelect(agent)}
            className="w-full text-left bg-gray-800/50 border border-white/5 rounded-xl p-3 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{agent?.emoji || '🤖'}</span>
              <span className="text-gray-300 text-xs font-bold">{agent?.name || h.agent_id}</span>
              <span className="text-gray-500 text-[10px] ml-auto">{_timeAgo(h.created_at)}</span>
            </div>
            <p className="text-gray-400 text-xs truncate">{h.user_message}</p>
            {h.assistant_reply && (
              <p className="text-gray-500 text-[11px] truncate mt-0.5">↳ {h.assistant_reply}</p>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ==================== HELPERS ====================
function _quickActions(agentId) {
  const map = {
    lluvia_asistente: ['¿Cómo subo de nivel?', '¿Cómo creo una sala?', 'Dime cuántos usuarios hay'],
    moderador: ['Analiza este texto: "me caes muy mal"', 'Analiza: "hola como estás?"'],
    studio_builder: ['Crea una app de audio room llamada MiApp', 'Lista mis VPS disponibles', '¿Qué apps puedes construir?'],
    vps_ops: ['Lista mis VPS', '¿Cómo conectar un VPS?'],
    super_lluvia: ['Lista archivos de backend/', 'Estado de los servicios', 'git status del proyecto'],
  };
  return map[agentId] || ['¿Qué puedes hacer?', 'Ayúdame'];
}

function _timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default AgentsView;
