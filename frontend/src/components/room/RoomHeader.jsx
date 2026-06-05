import React, { memo } from 'react';
import { Z } from '../../design/tokens';

function RoomHeader({ room, userCount = 0, onBack, onShare, onInvite, onSettings }) {
  const name = room?.name || 'Sala';
  const id   = (room?.id || '').slice(0, 6).toUpperCase();

  return (
    <div
      className="flex items-center gap-2 px-3 safe-top"
      style={{
        position: 'relative',
        zIndex: Z.header,
        height: 52,
        background: 'linear-gradient(180deg, rgba(10,11,15,0.92) 0%, rgba(10,11,15,0.6) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}
    >
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center justify-center active:scale-90 transition-transform"
        style={{
          width: 34, height: 34, borderRadius: 11,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.8)', fontSize: 15,
          flexShrink: 0,
        }}
        data-testid="room-back-btn"
      >
        ←
      </button>

      {/* Room info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          {/* Live dot */}
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"
            style={{ animation: 'badge-pulse 1.5s ease-in-out infinite' }} />
          <span className="truncate" style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {name}
          </span>
        </div>
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
          ID: {id}
        </span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* User count */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
          <span className="w-1 h-1 rounded-full bg-green-400" />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            {userCount > 999 ? `${(userCount / 1000).toFixed(1)}K` : userCount}
          </span>
        </div>

        {/* Share */}
        {onShare && (
          <button onClick={onShare}
            className="flex items-center justify-center active:scale-90 transition-transform"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              fontSize: 13,
            }}>
            🔗
          </button>
        )}

        {/* Settings (⚙️ — opens host tools or tools panel) */}
        {onSettings && (
          <button onClick={onSettings}
            className="flex items-center justify-center active:scale-90 transition-transform"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              fontSize: 13,
            }}>
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(RoomHeader);
