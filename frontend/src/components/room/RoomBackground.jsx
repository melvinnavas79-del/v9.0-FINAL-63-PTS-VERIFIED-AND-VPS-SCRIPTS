import React, { memo } from 'react';

const THEMES = {
  default: { from: '#14063a', via: '#0d1117', to: '#07111f', glow1: 'rgba(124,58,237,0.28)', glow2: 'rgba(236,72,153,0.16)', mid: 'rgba(99,38,180,0.12)' },
  purple:  { from: '#1e0540', via: '#110628', to: '#0a0b0f', glow1: 'rgba(139,92,246,0.32)', glow2: 'rgba(236,72,153,0.18)', mid: 'rgba(109,40,217,0.14)' },
  blue:    { from: '#040f22', via: '#061428', to: '#0a0b0f', glow1: 'rgba(59,130,246,0.28)', glow2: 'rgba(14,165,233,0.16)', mid: 'rgba(37,99,235,0.12)' },
  rose:    { from: '#220518', via: '#140312', to: '#0a0b0f', glow1: 'rgba(236,72,153,0.28)', glow2: 'rgba(244,63,94,0.18)', mid: 'rgba(190,18,60,0.12)' },
  gold:    { from: '#1c1003', via: '#0f0a02', to: '#0a0b0f', glow1: 'rgba(245,158,11,0.26)', glow2: 'rgba(249,115,22,0.16)', mid: 'rgba(180,83,9,0.12)' },
};

function RoomBackground({ theme = 'default', photo = null }) {
  const t = THEMES[theme] || THEMES.default;

  return (
    <div className="fixed inset-0 w-full h-full" style={{ zIndex: 0, pointerEvents: 'none' }}>

      {/* Base gradient */}
      <div className="absolute inset-0" style={{
        background: `linear-gradient(170deg, ${t.from} 0%, ${t.via} 48%, ${t.to} 100%)`,
      }} />

      {/* Photo layer */}
      {photo && (
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${photo})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.15,
          filter: 'blur(14px) saturate(0.9)',
        }} />
      )}

      {/* Top-left primary glow */}
      <div className="absolute" style={{
        top: '-8vh', left: '-12vw',
        width: '75vw', height: '55vw',
        background: `radial-gradient(ellipse at center, ${t.glow1} 0%, transparent 65%)`,
        filter: 'blur(22px)',
      }} />

      {/* Bottom-right accent glow */}
      <div className="absolute" style={{
        bottom: '5vh', right: '-10vw',
        width: '60vw', height: '50vw',
        background: `radial-gradient(ellipse at center, ${t.glow2} 0%, transparent 68%)`,
        filter: 'blur(26px)',
      }} />

      {/* Mid-center depth layer */}
      <div className="absolute" style={{
        top: '25vh', left: '15vw',
        width: '70vw', height: '50vw',
        background: `radial-gradient(ellipse at center, ${t.mid} 0%, transparent 72%)`,
        filter: 'blur(32px)',
      }} />

      {/* Vignette — darkness at corners for depth */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 90% 70% at 50% 38%, transparent 45%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* Subtle top darkening for header readability */}
      <div className="absolute top-0 left-0 right-0" style={{
        height: '18%',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 100%)',
      }} />

      {/* Subtle bottom darkening for bottom bar readability */}
      <div className="absolute bottom-0 left-0 right-0" style={{
        height: '20%',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
      }} />
    </div>
  );
}

export default memo(RoomBackground);
