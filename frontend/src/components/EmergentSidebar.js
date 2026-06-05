import React from 'react';

export default function EmergentSidebar({
  agents, selectedAgent, onSelectAgent,
  threads, activeThread, onSelectThread, onDeleteThread,
  onNewThread,
}) {
  return (
    <div className="em-sidebar">
      <div className="em-sidebar-header">
        <span>🌧</span> Lluvia Agentes
      </div>

      {/* Agent picker */}
      <div className="em-agent-picker-wrap">
        <select
          value={selectedAgent?.id || ''}
          onChange={e => {
            const ag = agents.find(a => a.id === e.target.value);
            if (ag) onSelectAgent(ag);
          }}
        >
          {agents.map(ag => (
            <option key={ag.id} value={ag.id}>
              {ag.emoji} {ag.name}
            </option>
          ))}
        </select>
      </div>

      <button className="em-new-btn" onClick={onNewThread}>
        ✏️ Nueva conversación
      </button>

      <div className="em-section-label">Recientes</div>

      <div className="em-thread-list">
        {threads.length === 0 && (
          <div style={{ padding: '12px', fontSize: 12, color: 'var(--em-text-3)' }}>
            Sin conversaciones aún
          </div>
        )}
        {threads.map(t => (
          <div
            key={t.id}
            className={`em-thread-item${activeThread?.id === t.id ? ' active' : ''}`}
            onClick={() => onSelectThread(t)}
          >
            <span style={{ fontSize: 14 }}>
              {agents.find(a => a.id === t.agent_id)?.emoji || '🤖'}
            </span>
            <span className="em-thread-title">{t.title || 'Conversación'}</span>
            <button
              className="em-thread-delete"
              onClick={e => { e.stopPropagation(); onDeleteThread(t.id); }}
              title="Eliminar"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
