import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, formatError } from '../api';
import EmergentSidebar from './EmergentSidebar';
import EmergentMessage from './EmergentMessage';
import '../styles/emergent.css';

const SUGGESTIONS = {
  lluvia_asistente: [
    { title: '¿Qué puedes hacer?', text: '¿Qué puedes hacer por mí en Lluvia?' },
    { title: 'Estadísticas', text: 'Muéstrame las estadísticas de la plataforma' },
    { title: 'Ayuda con salas', text: '¿Cómo creo una sala de audio exitosa?' },
  ],
  studio_builder: [
    { title: 'Crear app audio', text: 'Quiero generar una app de salas de audio' },
    { title: 'Clonar TikTok', text: 'Genera una app estilo TikTok para mi marca' },
    { title: 'Ver workspace', text: 'Lista mis archivos en el workspace' },
  ],
  vps_ops: [
    { title: 'Mis VPS', text: 'Lista mis servidores VPS registrados' },
    { title: 'Deploy app', text: 'Quiero desplegar mi app en un VPS' },
    { title: 'Ver logs', text: 'Muéstrame los últimos logs de mi servicio' },
  ],
  moderador: [
    { title: 'Info usuario', text: 'Busca información de un usuario' },
    { title: 'Salas activas', text: 'Lista las salas activas ahora mismo' },
    { title: 'Enviar notif', text: 'Envía una notificación a un usuario' },
  ],
  super_lluvia: [
    { title: 'Estado sistema', text: 'Dame un resumen completo del estado del sistema' },
    { title: 'Ejecutar bash', text: 'Ejecuta: ls /root/lluvia-v9/backend' },
    { title: 'Ver archivos', text: 'Muéstrame los archivos del backend' },
  ],
};

export default function EmergentChat({ user }) {
  const [agents, setAgents]           = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [threads, setThreads]         = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [balance, setBalance]         = useState(user?.coins ?? 0);
  const [error, setError]             = useState('');
  const [provider, setProvider]       = useState('auto'); // 'auto' | 'openai' | 'gemini'
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  /* ── Load agents ── */
  useEffect(() => {
    api.get('/console/agents')
      .then(r => {
        const list = r.data.agents || [];
        setAgents(list);
        if (list.length > 0) setSelectedAgent(list[0]);
      })
      .catch(() => {});
  }, []);

  /* ── Load threads when agent changes ── */
  useEffect(() => {
    if (!selectedAgent) return;
    setActiveThread(null);
    setMessages([]);
    api.get('/console/threads')
      .then(r => setThreads((r.data.threads || []).filter(t => t.agent_id === selectedAgent.id)))
      .catch(() => {});
  }, [selectedAgent]);

  /* ── Load messages when thread changes ── */
  useEffect(() => {
    if (!activeThread) return;
    api.get(`/console/threads/${activeThread.id}/messages`)
      .then(r => {
        const msgs = r.data.messages || [];
        setMessages(msgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          tool_calls: m.tool_calls || [],
          agent_name: m.agent_name,
        })));
      })
      .catch(() => {});
  }, [activeThread]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !selectedAgent) return;
    setInput('');
    setError('');

    const userMsg = { id: Date.now(), role: 'user', content: text, tool_calls: [] };
    const typingMsg = { id: 'typing', role: 'assistant', typing: true, tool_calls: [],
      agent_name: selectedAgent.name };

    setMessages(prev => [...prev, userMsg, typingMsg]);
    setLoading(true);

    try {
      const body = {
        agent_id: selectedAgent.id,
        message: text,
      };
      if (activeThread) body.thread_id = activeThread.id;
      if (provider !== 'auto') body.provider = provider;

      const r = await api.post('/console/chat', body);
      const data = r.data;

      if (data.balance !== undefined) setBalance(data.balance);

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.text || '',
        tool_calls: data.tool_calls || [],
        agent_name: selectedAgent.name,
      };

      setMessages(prev => prev.filter(m => m.id !== 'typing').concat(assistantMsg));

      // Update or create thread in sidebar
      if (data.thread_id && !activeThread) {
        const newThread = {
          id: data.thread_id,
          agent_id: selectedAgent.id,
          title: text.slice(0, 60) + (text.length > 60 ? '…' : ''),
          updated_at: new Date().toISOString(),
        };
        setActiveThread(newThread);
        setThreads(prev => [newThread, ...prev]);
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== 'typing'));
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [input, loading, selectedAgent, activeThread]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewThread = () => {
    setActiveThread(null);
    setMessages([]);
    setError('');
  };

  const handleDeleteThread = async (threadId) => {
    try {
      await api.delete(`/console/threads/${threadId}`);
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThread?.id === threadId) {
        setActiveThread(null);
        setMessages([]);
      }
    } catch (e) {
      setError(formatError(e));
    }
  };

  const handleSelectAgent = (ag) => {
    setSelectedAgent(ag);
    setActiveThread(null);
    setMessages([]);
    setError('');
  };

  const suggestions = selectedAgent ? (SUGGESTIONS[selectedAgent.id] || []) : [];
  const showEmpty = messages.length === 0 && !loading;

  return (
    <div className="em-chat">
      <EmergentSidebar
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={handleSelectAgent}
        threads={threads}
        activeThread={activeThread}
        onSelectThread={(t) => { setActiveThread(t); setError(''); }}
        onDeleteThread={handleDeleteThread}
        onNewThread={handleNewThread}
      />

      <div className="em-main">
        {/* Header */}
        <div className="em-header">
          {selectedAgent && (
            <>
              <div
                className="em-agent-avatar"
                style={{ background: `${selectedAgent.color || '#5B8DEF'}22` }}
              >
                {selectedAgent.emoji || '🤖'}
              </div>
              <div>
                <div className="em-agent-name">{selectedAgent.name}</div>
                <div className="em-agent-tagline">{selectedAgent.tagline}</div>
              </div>
            </>
          )}
          {/* LLM provider selector */}
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            style={{
              marginLeft: 'auto',
              marginRight: 8,
              background: 'var(--em-panel)',
              color: 'var(--em-text)',
              border: '1px solid var(--em-border)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 13,
              cursor: 'pointer',
              outline: 'none',
            }}
            title="Proveedor LLM"
          >
            <option value="auto">🤖 Auto</option>
            <option value="openai">🟢 GPT</option>
            <option value="gemini">🔵 Gemini</option>
          </select>

          <div className="em-balance">
            🪙 {balance.toLocaleString()} monedas
          </div>
        </div>

        {/* Messages */}
        <div className="em-messages">
          {showEmpty ? (
            <div className="em-empty">
              <div className="em-empty-icon">{selectedAgent?.emoji || '🤖'}</div>
              <div className="em-empty-title">
                {selectedAgent ? `Hola, soy ${selectedAgent.name}` : 'Selecciona un agente'}
              </div>
              <div className="em-empty-sub">
                {selectedAgent?.tagline || 'Elige un agente para comenzar.'}
              </div>
              {suggestions.length > 0 && (
                <div className="em-suggestions">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      className="em-suggestion"
                      onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}
                    >
                      <div className="em-suggestion-title">{s.title}</div>
                      <div>{s.text}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, i) => (
              <EmergentMessage
                key={msg.id || i}
                msg={msg}
                agentEmoji={selectedAgent?.emoji}
                agentColor={selectedAgent?.color}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 22px', color: 'var(--em-err)', fontSize: 13,
            background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Composer */}
        <div className="em-composer">
          <div className="em-composer-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={selectedAgent
                ? `Mensaje a ${selectedAgent.name}…`
                : 'Selecciona un agente primero…'}
              disabled={loading || !selectedAgent}
            />
            <button
              className="em-send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim() || !selectedAgent}
            >
              {loading ? '…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
