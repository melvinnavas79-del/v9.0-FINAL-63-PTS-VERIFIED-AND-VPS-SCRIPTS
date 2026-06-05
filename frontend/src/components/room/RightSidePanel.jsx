import React, { memo } from 'react';
import { COLORS, Z } from '../../design/tokens';

const QUICK_BUTTONS = [
  { id: 'events',     icon: '⚡', label: 'Eventos',  color: 'rgba(245,158,11,0.25)', border: 'rgba(245,158,11,0.4)' },
  { id: 'ranking',    icon: '🏆', label: 'Ranking',  color: 'rgba(239,68,68,0.2)',   border: 'rgba(239,68,68,0.4)'  },
  { id: 'games',      icon: '🎮', label: 'Juegos',   color: 'rgba(99,102,241,0.2)',  border: 'rgba(99,102,241,0.4)' },
  { id: 'vip',        icon: '👑', label: 'VIP',      color: 'rgba(124,58,237,0.2)',  border: 'rgba(124,58,237,0.4)' },
  { id: 'activities', icon: '🎪', label: 'Activ.',   color: 'rgba(16,185,129,0.2)',  border: 'rgba(16,185,129,0.4)' },
];

function QuickButton({ btn, onClick, badge }) {
  return (
    <button
      onClick={() => onClick?.(btn.id)}
      className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform relative"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      title={btn.label}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 40, height: 40,
          borderRadius: 14,
          background: btn.color,
          border: `1.5px solid ${btn.border}`,
          fontSize: 18,
          boxShadow: `0 2px 12px ${btn.color}`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {btn.icon}
        {badge > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center"
            style={{
              width: 14, height: 14,
              background: '#EF4444',
              borderRadius: '50%',
              fontSize: 8,
              fontWeight: 800,
              color: '#fff',
              animation: 'badge-pulse 2s infinite',
            }}
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: 8, color: COLORS.white40, fontWeight: 600, lineHeight: 1 }}>
        {btn.label}
      </span>
    </button>
  );
}

function RightSidePanel({ onAction, badges = {}, visible = true }) {
  if (!visible) return null;

  return (
    <div
      className="flex flex-col items-center gap-3"
      style={{
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: Z.rightPanel,
        animation: 'fade-in 0.3s ease-out',
      }}
    >
      {QUICK_BUTTONS.map(btn => (
        <QuickButton
          key={btn.id}
          btn={btn}
          onClick={onAction}
          badge={badges[btn.id] || 0}
        />
      ))}
    </div>
  );
}

export default memo(RightSidePanel);
