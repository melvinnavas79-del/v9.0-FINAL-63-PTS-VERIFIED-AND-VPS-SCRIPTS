import React, { memo } from 'react';
import { Z } from '../../design/tokens';

/* ─── Chat input ────────────────────────────────────── */
function ChatInput({ value, onChange, onSend }) {
  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };
  return (
    <div className="flex items-center gap-2 px-3 pt-2 pb-1">
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey} placeholder="Escribe un mensaje..."
        maxLength={200}
        className="flex-1 outline-none"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '8px 14px',
          fontSize: 13, color: 'rgba(255,255,255,0.85)',
        }}
        data-testid="chat-input"
      />
      <button onClick={onSend} disabled={!value.trim()}
        className="flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: value.trim() ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'rgba(255,255,255,0.06)',
          border: 'none', fontSize: 14,
        }}
        data-testid="send-chat-btn">
        ➤
      </button>
    </div>
  );
}

/* ─── Single action button ──────────────────────────── */
function ActionBtn({ icon, label, onClick, active, accent, badge, testId, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-1 relative active:scale-90 transition-transform"
      style={{ minWidth: 48, padding: '2px 4px', opacity: disabled ? 0.4 : 1,
        WebkitTapHighlightColor: 'transparent' }}
      data-testid={testId}>
      <div className="flex items-center justify-center relative"
        style={{
          width: 42, height: 42, borderRadius: 15,
          background: accent
            ? 'linear-gradient(135deg,#7c3aed,#ec4899)'
            : active
            ? 'rgba(124,58,237,0.25)'
            : 'rgba(255,255,255,0.07)',
          border: active
            ? '1.5px solid rgba(124,58,237,0.5)'
            : accent
            ? 'none'
            : '1.5px solid rgba(255,255,255,0.09)',
          boxShadow: accent
            ? '0 4px 16px rgba(124,58,237,0.4)'
            : active
            ? '0 0 10px rgba(124,58,237,0.2)'
            : 'none',
          fontSize: 18,
        }}>
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center"
            style={{
              minWidth: 15, height: 15, background: '#ef4444',
              borderRadius: 8, fontSize: 7.5, fontWeight: 800,
              color: '#fff', padding: '0 2px',
            }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: 9, color: active ? 'rgba(167,139,250,0.95)' : 'rgba(255,255,255,0.4)', fontWeight: 600, lineHeight: 1 }}>
        {label}
      </span>
    </button>
  );
}

/* ─── Mic center button ─────────────────────────────── */
function MicBtn({ isMuted, isConnected, inSeat, onToggle, onRequest }) {
  if (!isConnected) return (
    <ActionBtn icon="⬆️" label="Subir" onClick={onRequest} accent testId="request-seat-btn" />
  );

  if (!inSeat) return (
    <ActionBtn icon="⬆️" label="Subir" onClick={onRequest} accent testId="request-seat-btn" />
  );

  const speaking = !isMuted;
  return (
    <button onClick={onToggle}
      className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      data-testid="mic-btn">
      <div className="flex items-center justify-center"
        style={{
          width: 50, height: 50, borderRadius: 16,
          background: speaking
            ? 'linear-gradient(135deg,#10b981,#059669)'
            : 'rgba(239,68,68,0.18)',
          border: speaking
            ? '2px solid rgba(52,211,153,0.7)'
            : '2px solid rgba(239,68,68,0.45)',
          boxShadow: speaking
            ? '0 0 18px rgba(52,211,153,0.45)'
            : '0 0 10px rgba(239,68,68,0.25)',
          fontSize: 20,
          animation: speaking ? 'mic-speaking 1.8s ease-in-out infinite' : 'mic-active 2.5s ease-in-out infinite',
        }}>
        {speaking ? '🎙️' : '🔇'}
      </div>
      <span style={{ fontSize: 8.5, fontWeight: 700,
        color: speaking ? 'rgba(110,231,183,0.9)' : 'rgba(252,165,165,0.7)' }}>
        {speaking ? 'Hablando' : 'Silencio'}
      </span>
    </button>
  );
}

/* ─── Main BottomBar ────────────────────────────────── */
function BottomBar({
  chatInput, onChatChange, onSendChat,
  showChatInput, onToggleChat,
  isMuted, audioStatus, onToggleMic,
  mySeat, onRequestSeat,
  onOpenGifts, onOpenMusic, onOpenGames, onOpenMore,
  isHost, onHostTools,
  unreadCount = 0,
}) {
  const isConnected = audioStatus === 'on';
  const inSeat      = mySeat !== null && mySeat !== undefined;

  return (
    <div className="safe-bottom" style={{
      position: 'relative', zIndex: Z.bottomBar, flexShrink: 0,
      background: 'linear-gradient(0deg, rgba(8,9,14,0.98) 0%, rgba(10,11,15,0.75) 100%)',
      backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
    }}>

      {/* Chat input (collapsible) */}
      {showChatInput && (
        <ChatInput value={chatInput} onChange={onChatChange} onSend={onSendChat} />
      )}

      {/* Action row */}
      <div className="flex items-center justify-around px-2 py-2" style={{ minHeight: 66 }}>

        {/* Chat */}
        <ActionBtn icon="💬" label="Chat"
          onClick={onToggleChat} active={showChatInput}
          badge={!showChatInput ? unreadCount : 0}
          testId="bottom-chat-btn" />

        {/* Music */}
        <ActionBtn icon="🎵" label="Música"
          onClick={onOpenMusic} testId="music-btn" />

        {/* Mic CENTER — largest */}
        <MicBtn
          isMuted={isMuted} isConnected={isConnected}
          inSeat={inSeat} onToggle={onToggleMic} onRequest={onRequestSeat}
        />

        {/* Gifts */}
        <ActionBtn icon="🎁" label="Regalos"
          onClick={onOpenGifts} accent testId="gifts-btn" />

        {/* More / Host tools */}
        {isHost
          ? <ActionBtn icon="⚡" label="Control" onClick={onHostTools} active testId="host-tools-btn" />
          : <ActionBtn icon="✦" label="Más" onClick={onOpenMore} testId="more-btn" />
        }
      </div>
    </div>
  );
}

export default memo(BottomBar);
