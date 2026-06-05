import React, { useEffect, useRef, memo } from 'react';

function formatCoins(n) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}

/* ─── Message types ─────────────────────────────────── */

function JoinMsg({ msg }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 mx-1 rounded-xl chat-message-enter"
      style={{
        background: 'rgba(10,10,18,0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.05)',
        maxWidth: '75%',
      }}>
      <span style={{ fontSize: 10, opacity: 0.7 }}>✨</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
        <span style={{ color: 'rgba(167,139,250,0.85)', fontWeight: 600 }}>{msg.username}</span>
        {' '}entró
      </span>
    </div>
  );
}

function GiftMsg({ msg }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 mx-1 rounded-xl chat-message-enter"
      style={{
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.2)',
      }}>
      <span style={{ fontSize: 13 }}>🎁</span>
      <span style={{ fontSize: 11 }}>
        <span style={{ color: 'rgba(251,191,36,0.9)', fontWeight: 700 }}>{msg.username}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}> → </span>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{msg.gift_target || msg.target}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}> {msg.gift_name} ×{msg.gift_count || 1}</span>
      </span>
    </div>
  );
}

function EventMsg({ msg }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 mx-1 rounded-xl chat-message-enter"
      style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
      <span style={{ fontSize: 12 }}>⚡</span>
      <span style={{ fontSize: 11, color: 'rgba(167,139,250,0.9)', fontWeight: 600 }}>{msg.text}</span>
    </div>
  );
}

function NormalMsg({ msg }) {
  const isVIP = (msg.aristocracy || 0) >= 5 || msg.role === 'dueño';
  const nameColor = isVIP ? 'rgba(251,191,36,0.95)' : 'rgba(167,139,250,0.9)';

  return (
    <div className="flex items-start gap-1.5 px-2.5 py-1.5 mx-1 rounded-2xl chat-message-enter"
      style={{
        background: 'rgba(10,10,18,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.07)',
        maxWidth: '88%',
      }}>
      {msg.avatar && (
        <img src={msg.avatar} alt="" className="flex-shrink-0 rounded-full mt-0.5"
          style={{ width: 16, height: 16, objectFit: 'cover' }} />
      )}
      <div className="flex-1 min-w-0">
        <span style={{ fontSize: 11, fontWeight: 700, color: nameColor, marginRight: 4 }}>
          {isVIP && '👑'}{msg.username}
        </span>
        {(msg.level > 0) && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginRight: 4 }}>
            Lv.{msg.level}
          </span>
        )}
        <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)', wordBreak: 'break-word', lineHeight: 1.35 }}>
          {msg.text}
        </span>
      </div>
    </div>
  );
}

function ChatItem({ msg, i }) {
  if (msg.type === 'join')  return <JoinMsg  msg={msg} key={i} />;
  if (msg.type === 'gift')  return <GiftMsg  msg={msg} key={i} />;
  if (msg.type === 'event') return <EventMsg msg={msg} key={i} />;
  return <NormalMsg msg={msg} key={i} />;
}

/* ─── FloatingChat ──────────────────────────────────── */
function FloatingChat({ messages = [], maxVisible = 4 }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const visible = messages.slice(-maxVisible);

  return (
    <div className="pointer-events-none select-none px-1 pb-2"
      style={{ minHeight: 60 }}>
      <div className="flex flex-col gap-0.5">
        {visible.map((msg, i) => (
          <ChatItem key={msg.id || i} msg={msg} i={i} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export default memo(FloatingChat);
