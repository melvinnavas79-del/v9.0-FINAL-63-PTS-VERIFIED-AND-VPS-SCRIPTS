import React, { memo } from 'react';
import { Z } from '../../design/tokens';

function GiftButton({ onClick, coinsBalance }) {
  const formatCoins = (n) => {
    if (!n && n !== 0) return '';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return String(n);
  };

  return (
    <button
      onClick={onClick}
      className="active:scale-90 transition-transform"
      style={{
        position: 'absolute',
        bottom: 80,
        right: 12,
        zIndex: Z.giftButton,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        WebkitTapHighlightColor: 'transparent',
      }}
      data-testid="gift-fab-btn"
    >
      <div
        style={{
          width: 52, height: 52,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)',
          boxShadow: '0 4px 20px rgba(236,72,153,0.5), 0 0 0 1px rgba(255,255,255,0.15) inset',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          animation: 'gift-float 3s ease-in-out infinite',
        }}
      >
        🎁
      </div>
      {coinsBalance !== undefined && coinsBalance !== null && (
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(253,230,138,0.9)',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            padding: '1px 5px',
            borderRadius: 6,
            border: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          💰{formatCoins(coinsBalance)}
        </div>
      )}
    </button>
  );
}

export default memo(GiftButton);
