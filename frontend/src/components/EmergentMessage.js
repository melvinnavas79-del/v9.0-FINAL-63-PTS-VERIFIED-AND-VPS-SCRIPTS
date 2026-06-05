import React from 'react';
import EmergentToolCard from './EmergentToolCard';

export default function EmergentMessage({ msg, agentEmoji, agentColor }) {
  const isUser  = msg.role === 'user';
  const isTyping = msg.typing;

  const avatarBg = isUser
    ? 'linear-gradient(135deg,#5B8DEF,#A855F7)'
    : `linear-gradient(135deg,${agentColor || '#A855F7'},#5B8DEF)`;

  const avatarLabel = isUser ? 'U' : (agentEmoji || '🤖');

  return (
    <div className="em-msg">
      <div className="em-msg-avatar" style={{ background: avatarBg }}>
        {avatarLabel}
      </div>
      <div className="em-msg-content">
        <div className={`em-msg-author ${isUser ? 'user' : 'agent'}`}>
          {isUser ? 'Tú' : (msg.agent_name || 'Agente')}
        </div>

        {isTyping ? (
          <div className="em-typing">
            <span /><span /><span />
          </div>
        ) : (
          <>
            {msg.content && (
              <div
                className="em-msg-body"
                dangerouslySetInnerHTML={{ __html: _renderMarkdown(msg.content) }}
              />
            )}
            {Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {msg.tool_calls.map((tc, i) => (
                  <EmergentToolCard key={i} tool={tc} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Minimal markdown: bold, inline code, code blocks, links */
function _renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // code blocks
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g,
    (_, code) => `<pre>${code.trimEnd()}</pre>`);
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // newlines → <br> (outside pre tags — handled by white-space:pre-wrap via CSS)

  return html;
}
