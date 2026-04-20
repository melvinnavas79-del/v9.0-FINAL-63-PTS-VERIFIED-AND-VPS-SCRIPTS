import React, { useEffect, useState } from 'react';

// Animated entrance overlay - full screen
const EntryAnimation = ({ animation, username, onComplete }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Vibración: pattern TORMENTA más intenso y prolongado para el Dueño
    try {
      if (navigator.vibrate) {
        if (animation === 'storm') {
          navigator.vibrate([300, 120, 200, 80, 500, 100, 300, 120, 700]);
        } else if (['dragon', 'phoenix'].includes(animation)) {
          navigator.vibrate([200, 100, 400]);
        } else {
          navigator.vibrate(120);
        }
      }
    } catch (_) {}

    // Sonido de trueno (Web Audio API) sintético para que no dependa de archivos
    if (animation === 'storm') {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const playBoom = (offset = 0, duration = 1.4, peak = 0.9) => {
            const bufferSize = ctx.sampleRate * duration;
            const noise = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = noise.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            const src = ctx.createBufferSource();
            src.buffer = noise;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 160;
            const gain = ctx.createGain();
            gain.gain.value = 0;
            const start = ctx.currentTime + offset;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(peak, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            src.connect(lp).connect(gain).connect(ctx.destination);
            src.start(start);
            src.stop(start + duration);
          };
          // Doble trueno: relámpago corto + retumbe largo
          playBoom(0, 0.25, 1.0);
          playBoom(0.35, 1.8, 0.8);
          playBoom(2.2, 1.2, 0.5);
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 4500);
        }
      } catch (_) {}
    }

    const timer = setTimeout(() => {
      setVisible(false);
      if (onComplete) onComplete();
    }, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const animations = {
    storm: {
      bg: 'from-gray-900 via-blue-900 to-gray-900',
      emoji: '⛈️',
      icon: '☔',
      title: '¡LA TORMENTA HA LLEGADO!',
      subtitle: '☔ EL DUEÑO DE LLUVIA LIVE ☔',
      particles: ['⚡', '🌧️', '💨', '⛈️', '🌊'],
      borderColor: 'border-yellow-400',
      textColor: 'text-yellow-400',
      glowColor: 'shadow-yellow-500/50',
    },
    dragon: {
      bg: 'from-red-950 via-orange-950 to-red-950',
      emoji: '🐉',
      icon: '🔥',
      title: '¡EL DRAGÓN SUPREMO!',
      subtitle: '🔥 TIEMBLA LA SALA 🔥',
      particles: ['🔥', '🐉', '💎', '⚡', '🌋'],
      borderColor: 'border-red-500',
      textColor: 'text-red-400',
      glowColor: 'shadow-red-500/50',
    },
    phoenix: {
      bg: 'from-orange-950 via-red-900 to-yellow-950',
      emoji: '🔥',
      icon: '🦅',
      title: '¡EL FÉNIX RENACE!',
      subtitle: '🔥 DE LAS CENIZAS AL PODER 🔥',
      particles: ['🔥', '✨', '🌟', '💫', '⭐'],
      borderColor: 'border-orange-500',
      textColor: 'text-orange-400',
      glowColor: 'shadow-orange-500/50',
    },
    lion: {
      bg: 'from-amber-950 via-yellow-900 to-amber-950',
      emoji: '🦁',
      icon: '👑',
      title: '¡EL REY DE LA SELVA!',
      subtitle: '👑 EL LEÓN HA RUGIDO 👑',
      particles: ['🦁', '👑', '💛', '⭐', '🌟'],
      borderColor: 'border-amber-500',
      textColor: 'text-amber-400',
      glowColor: 'shadow-amber-500/50',
    },
    tiger: {
      bg: 'from-orange-950 via-amber-900 to-orange-950',
      emoji: '🐅',
      icon: '⚡',
      title: '¡EL TIGRE ATACA!',
      subtitle: '⚡ VA POR LA PELEA ⚡',
      particles: ['🐅', '⚡', '🔥', '💥', '🌟'],
      borderColor: 'border-orange-400',
      textColor: 'text-orange-300',
      glowColor: 'shadow-orange-400/50',
    },
    eagle: {
      bg: 'from-blue-950 via-cyan-900 to-blue-950',
      emoji: '🦅',
      icon: '🌊',
      title: '¡EL ÁGUILA ATERRIZA!',
      subtitle: '🦅 VOLANDO ALTO 🦅',
      particles: ['🦅', '💨', '☁️', '🌊', '✨'],
      borderColor: 'border-cyan-400',
      textColor: 'text-cyan-300',
      glowColor: 'shadow-cyan-400/50',
    },
  };

  const anim = animations[animation] || animations.storm;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className={`absolute inset-0 bg-gradient-to-b ${anim.bg} animate-pulse`}></div>

      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-4xl animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 2}s`,
              fontSize: `${20 + Math.random() * 40}px`,
              opacity: 0.6 + Math.random() * 0.4,
            }}
          >
            {anim.particles[i % anim.particles.length]}
          </div>
        ))}
      </div>

      {/* Center Content */}
      <div className="relative z-10 text-center px-8">
        {/* Main Emoji with Glow */}
        <div className={`text-[120px] mb-4 animate-bounce drop-shadow-2xl`}
          style={{filter: 'drop-shadow(0 0 40px rgba(255,200,0,0.8))'}}>
          {anim.emoji}
        </div>

        {/* Border Frame */}
        <div className={`border-4 ${anim.borderColor} rounded-3xl p-8 bg-black/50 backdrop-blur-lg shadow-2xl ${anim.glowColor}`}>
          <h1 className={`text-4xl font-black ${anim.textColor} mb-2`}
            style={{textShadow: '0 0 30px currentColor'}}>
            {anim.title}
          </h1>
          <p className="text-white text-2xl font-bold mb-3">{username}</p>
          <p className={`${anim.textColor} text-lg font-medium`}>{anim.subtitle}</p>
        </div>

        {/* Bottom Icon */}
        <div className="text-6xl mt-4 animate-spin" style={{animationDuration: '3s'}}>
          {anim.icon}
        </div>
      </div>
    </div>
  );
};

// Profile Frames
const ProfileFrame = ({ aristocracy, children }) => {
  const frames = {
    0: { border: 'border-gray-500', shadow: '', ring: '' },
    1: { border: 'border-gray-400', shadow: 'shadow-gray-400/30', ring: 'ring-2 ring-gray-400/30' },
    2: { border: 'border-blue-400', shadow: 'shadow-blue-400/30', ring: 'ring-2 ring-blue-400/30' },
    3: { border: 'border-green-400', shadow: 'shadow-green-400/40', ring: 'ring-4 ring-green-400/30' },
    4: { border: 'border-purple-400', shadow: 'shadow-purple-400/40', ring: 'ring-4 ring-purple-400/30' },
    5: { border: 'border-cyan-400', shadow: 'shadow-cyan-400/50', ring: 'ring-4 ring-cyan-400/40 animate-pulse' },
    6: { border: 'border-pink-400', shadow: 'shadow-pink-400/50', ring: 'ring-4 ring-pink-400/40 animate-pulse' },
    7: { border: 'border-orange-400', shadow: 'shadow-orange-400/60', ring: 'ring-[6px] ring-orange-400/40 animate-pulse' },
    8: { border: 'border-red-500', shadow: 'shadow-red-500/60 shadow-xl', ring: 'ring-[6px] ring-red-500/50 animate-pulse' },
    9: { border: 'border-yellow-400', shadow: 'shadow-yellow-400/70 shadow-2xl', ring: 'ring-[8px] ring-yellow-400/50 animate-pulse' },
    10: { border: 'border-yellow-300', shadow: 'shadow-yellow-300/80 shadow-2xl', ring: 'ring-[10px] ring-yellow-300/60 animate-pulse' },
  };

  const frame = frames[Math.min(aristocracy || 0, 10)] || frames[0];

  return (
    <div className={`relative inline-block rounded-full ${frame.ring}`}>
      <div className={`rounded-full border-4 ${frame.border} ${frame.shadow} overflow-hidden`}>
        {children}
      </div>
      {aristocracy >= 6 && (
        <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black text-white border-2 border-white">
          {aristocracy}
        </div>
      )}
    </div>
  );
};

// Mic Ring (glowing ring when speaking)
const MicRing = ({ aristocracy, speaking, children }) => {
  const colors = {
    0: 'ring-gray-400',
    1: 'ring-gray-400', 2: 'ring-blue-400', 3: 'ring-green-400',
    4: 'ring-purple-400', 5: 'ring-cyan-400', 6: 'ring-pink-400',
    7: 'ring-orange-400', 8: 'ring-red-500', 9: 'ring-yellow-400', 10: 'ring-yellow-300'
  };
  const color = colors[Math.min(aristocracy || 0, 10)] || 'ring-gray-400';

  return (
    <div className={`rounded-full ${speaking ? `ring-4 ${color} animate-pulse` : ''}`}>
      {children}
    </div>
  );
};

export { EntryAnimation, ProfileFrame, MicRing };
