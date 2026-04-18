import React, { useEffect, useState } from 'react';

const PremiumGiftAnimation = ({ giftType, senderName, onComplete }) => {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 300);
    const t2 = setTimeout(() => setPhase('exit'), 3500);
    const t3 = setTimeout(() => onComplete?.(), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const animations = {
    leon: {
      bg: 'from-amber-900/90 via-orange-900/80 to-yellow-900/90',
      emoji: '🦁',
      title: 'EL LEON HA RUGIDO!',
      particles: ['🔥', '✨', '⭐', '💫', '🌟'],
      color: 'text-amber-300',
      border: 'border-amber-500/50',
    },
    dragon: {
      bg: 'from-red-900/90 via-purple-900/80 to-red-900/90',
      emoji: '🐉',
      title: 'FUEGO DE DRAGON!',
      particles: ['🔥', '💥', '🌋', '✨', '🐲'],
      color: 'text-red-300',
      border: 'border-red-500/50',
    },
    castillo: {
      bg: 'from-purple-900/90 via-indigo-900/80 to-blue-900/90',
      emoji: '🏰',
      title: 'CASTILLO REAL!',
      particles: ['👑', '💎', '✨', '🌟', '💫'],
      color: 'text-purple-300',
      border: 'border-purple-500/50',
    },
    lluvia_oro: {
      bg: 'from-yellow-900/90 via-amber-900/80 to-yellow-900/90',
      emoji: '🌧️',
      title: 'LLUVIA DE ORO!',
      particles: ['🪙', '💰', '✨', '💎', '🌟'],
      color: 'text-yellow-300',
      border: 'border-yellow-500/50',
    },
    mega_crown: {
      bg: 'from-yellow-900/90 via-orange-900/80 to-red-900/90',
      emoji: '👑',
      title: 'CORONA SUPREMA!',
      particles: ['👑', '💎', '🌟', '✨', '💫'],
      color: 'text-yellow-200',
      border: 'border-yellow-400/50',
    },
  };

  const anim = animations[giftType] || animations.leon;

  return (
    <div className={`fixed inset-0 z-[100] pointer-events-none transition-opacity duration-500 ${phase === 'exit' ? 'opacity-0' : 'opacity-100'}`}>
      {/* Background overlay */}
      <div className={`absolute inset-0 bg-gradient-to-b ${anim.bg} backdrop-blur-sm`} />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({length: 20}).map((_, i) => (
          <div key={i} className="absolute text-2xl" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `particleFloat ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
            fontSize: `${16 + Math.random() * 24}px`,
          }}>
            {anim.particles[i % anim.particles.length]}
          </div>
        ))}
      </div>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-8xl mb-4 ${phase === 'show' ? 'animate-bounce' : 'scale-0'} transition-transform duration-500`}>
          {anim.emoji}
        </div>
        <div className={`${anim.color} text-2xl font-black tracking-wider mb-2 ${phase === 'show' ? 'scale-100' : 'scale-0'} transition-transform duration-700`}
          style={{textShadow: '0 0 20px currentColor'}}>
          {anim.title}
        </div>
        <div className={`bg-black/40 border ${anim.border} px-6 py-2 rounded-full ${phase === 'show' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} transition-all duration-500 delay-300`}>
          <span className="text-white text-sm font-bold">{senderName}</span>
          <span className="text-white/50 text-sm"> envio </span>
          <span className={`${anim.color} text-sm font-bold`}>{anim.emoji} {giftType?.replace('_', ' ')}</span>
        </div>
      </div>

      <style>{`
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
          50% { transform: translateY(-40px) rotate(180deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PremiumGiftAnimation;
