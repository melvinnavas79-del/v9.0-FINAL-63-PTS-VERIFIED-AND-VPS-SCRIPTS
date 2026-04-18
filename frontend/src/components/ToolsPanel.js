import React, { useState, useEffect } from 'react';

/**
 * ToolsPanel — Premium glass-morphism floating panel with 8 circular gradient icons.
 * Opens from the 4-squares button in the room bottom bar. Dark translucent background,
 * rounded corners, custom SVG icons with 3D relief (inner highlight + drop shadow),
 * smooth fade+slide-up animation. iPad-ready.
 */

// Custom SVG icon set — no emojis, pure vector with gradients and inner light
const GiftBagIcon = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <defs>
      <linearGradient id="gb1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
        <stop offset="0.6" stopColor="#ff2d87" />
        <stop offset="1" stopColor="#c81d6a" />
      </linearGradient>
    </defs>
    <path d="M12 16h24l-2 24H14z" fill="url(#gb1)" />
    <rect x="10" y="12" width="28" height="8" rx="2" fill="#fff" opacity="0.95" />
    <circle cx="24" cy="16" r="3" fill="#ff2d87" />
    <path d="M24 8c-3 0-5 2-5 4s2 4 5 4 5-2 5-4-2-4-5-4z" fill="none" stroke="#fff" strokeWidth="2" />
  </svg>
);

const DiceIcon = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <defs>
      <linearGradient id="d1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#c7d9ff" />
      </linearGradient>
    </defs>
    <rect x="10" y="10" width="28" height="28" rx="5" fill="url(#d1)" stroke="#5575b5" strokeWidth="1.5" />
    <circle cx="18" cy="18" r="2.3" fill="#3c4e80" />
    <circle cx="30" cy="18" r="2.3" fill="#3c4e80" />
    <circle cx="24" cy="24" r="2.3" fill="#3c4e80" />
    <circle cx="18" cy="30" r="2.3" fill="#3c4e80" />
    <circle cx="30" cy="30" r="2.3" fill="#3c4e80" />
  </svg>
);

const RouletteIcon = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <defs>
      <linearGradient id="r1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff8fa3" />
        <stop offset="1" stopColor="#c4002f" />
      </linearGradient>
    </defs>
    <rect x="8" y="10" width="32" height="28" rx="4" fill="url(#r1)" />
    <rect x="12" y="14" width="24" height="20" rx="2" fill="#fff" />
    <text x="24" y="29" fontSize="11" fontWeight="900" fill="#c4002f" textAnchor="middle" fontFamily="Arial">666</text>
  </svg>
);

const HandIcon = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <defs>
      <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe8a1" />
        <stop offset="1" stopColor="#e6a400" />
      </linearGradient>
    </defs>
    <path d="M16 14c0-2 2-3 3-3s3 1 3 3v8h2v-10c0-2 2-3 3-3s3 1 3 3v10h2v-6c0-2 2-3 3-3s3 1 3 3v14c0 6-4 10-10 10h-4c-5 0-9-4-9-9V18c0-2 1-4 3-4z" fill="url(#h1)" stroke="#fff" strokeWidth="1" />
  </svg>
);

const SwitchIdIcon = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <defs>
      <linearGradient id="s1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e0c3ff" />
        <stop offset="1" stopColor="#6b2db8" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="18" r="5" fill="url(#s1)" />
    <path d="M20 25c-5 0-9 3-9 7v2h18v-2c0-4-4-7-9-7z" fill="url(#s1)" />
    <path d="M32 12h6M32 12l2-2M32 12l2 2M38 22h-6M38 22l-2-2M38 22l-2 2" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="32" cy="8" r="2.5" fill="#fff" opacity="0.9" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <defs>
      <linearGradient id="t1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#cbe4ff" />
        <stop offset="1" stopColor="#4a90e2" />
      </linearGradient>
    </defs>
    <path d="M12 14h24l-2 24H14z" fill="url(#t1)" />
    <rect x="10" y="11" width="28" height="4" rx="1" fill="#fff" opacity="0.9" />
    <rect x="18" y="9" width="12" height="3" rx="1" fill="url(#t1)" />
    <path d="M19 20l10 10M29 20L19 30" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const MusicIcon = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <defs>
      <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a8f5d2" />
        <stop offset="1" stopColor="#12a86e" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="15" fill="url(#m1)" />
    <circle cx="24" cy="24" r="4" fill="#fff" />
    <path d="M28 16l6-2v10l-3 1M34 14l2-1" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <circle cx="30" cy="24" r="2" fill="#fff" />
  </svg>
);

const EffectIcon = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <defs>
      <linearGradient id="e1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d0e8ff" />
        <stop offset="1" stopColor="#5aa0f2" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="24" r="4" fill="url(#e1)" />
    <rect x="22" y="22" width="16" height="4" rx="1" fill="url(#e1)" />
    <circle cx="30" cy="34" r="4" fill="url(#e1)" />
    <rect x="10" y="32" width="14" height="4" rx="1" fill="url(#e1)" />
    <circle cx="34" cy="14" r="4" fill="url(#e1)" />
    <rect x="10" y="12" width="18" height="4" rx="1" fill="url(#e1)" />
    <path d="M8 8l2 2M40 40l2 2M40 8l-2 2M8 40l2-2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const BubbleCircle = ({ gradient, children }) => (
  <div
    className="relative w-[62px] h-[62px] rounded-full flex items-center justify-center"
    style={{
      background: gradient,
      boxShadow: '0 6px 14px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.2)',
    }}
  >
    {/* Inner top highlight for 3D relief */}
    <div
      className="absolute top-[3px] left-[8px] right-[8px] h-[20px] rounded-full pointer-events-none"
      style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), transparent)', filter: 'blur(2px)' }}
    />
    <div className="relative z-10">{children}</div>
  </div>
);

const ToolsPanel = ({ open, onClose, onAction }) => {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;

  const tools = [
    { id: 'sorpresa', label: 'Sorpresa', grad: 'linear-gradient(135deg,#ff6aa6 0%,#ff2d87 55%,#c81d6a 100%)', Icon: GiftBagIcon },
    { id: 'numero', label: 'Número', grad: 'linear-gradient(135deg,#ff9fb3 0%,#e91e63 55%,#9d0047 100%)', Icon: RouletteIcon },
    { id: 'dado', label: 'Dado', grad: 'linear-gradient(135deg,#b8cdff 0%,#6a93f2 55%,#3a67c7 100%)', Icon: DiceIcon },
    { id: 'mora', label: 'Mora', grad: 'linear-gradient(135deg,#ffe98a 0%,#ffc633 55%,#d99400 100%)', Icon: HandIcon },
    { id: 'switch', label: 'Conmutación\u00A0Id', grad: 'linear-gradient(135deg,#d9b8ff 0%,#9b5bef 55%,#6b2db8 100%)', Icon: SwitchIdIcon },
    { id: 'clear', label: 'Borrar todo', grad: 'linear-gradient(135deg,#cfe3ff 0%,#6fa7ef 55%,#3d7bcf 100%)', Icon: TrashIcon },
    { id: 'music', label: 'Música', grad: 'linear-gradient(135deg,#a8f5d2 0%,#2fd897 55%,#12a86e 100%)', Icon: MusicIcon },
    { id: 'effect', label: 'Efecto', grad: 'linear-gradient(135deg,#d0e8ff 0%,#79b3f7 55%,#4080d4 100%)', Icon: EffectIcon },
  ];

  return (
    <>
      <style>{`
        @keyframes tp-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tp-slide { from { opacity: 0; transform: translateY(40px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tp-fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes tp-slide-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(40px) scale(0.96); } }
        @keyframes tp-icon-in { from { opacity: 0; transform: translateY(12px) scale(0.85); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* Backdrop (glass-blurred darken) */}
      <div
        data-testid="tools-panel-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-[70]"
        style={{
          background: 'rgba(6, 8, 18, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: open ? 'tp-fade 0.22s ease-out forwards' : 'tp-fade-out 0.22s ease-in forwards',
        }}
      />

      {/* Panel */}
      <div
        data-testid="tools-panel"
        className="fixed left-0 right-0 z-[71] flex justify-center pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 12px) + 88px)' }}
      >
        <div
          className="pointer-events-auto w-[92%] max-w-[520px] rounded-[28px] px-5 py-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(22,24,44,0.88) 0%, rgba(14,16,30,0.92) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(120,140,255,0.08) inset',
            backdropFilter: 'blur(22px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(22px) saturate(1.3)',
            animation: open ? 'tp-slide 0.28s cubic-bezier(0.2,0.9,0.3,1) forwards' : 'tp-slide-out 0.22s ease-in forwards',
          }}
        >
          {/* Top ambient glow */}
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-[70%] h-[120px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(120,160,255,0.25), transparent 70%)', filter: 'blur(30px)' }}
          />

          {/* 4x2 grid of circular tools */}
          <div className="grid grid-cols-4 gap-x-3 gap-y-5 relative">
            {tools.map((t, i) => (
              <button
                key={t.id}
                data-testid={`tool-${t.id}`}
                onClick={() => { onAction(t.id); onClose(); }}
                className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
                style={{ animation: `tp-icon-in 0.35s ${i * 0.03}s ease-out both` }}
              >
                <BubbleCircle gradient={t.grad}>
                  <t.Icon />
                </BubbleCircle>
                <div className="text-white text-[11px] font-semibold leading-tight text-center px-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                  {t.label}
                </div>
              </button>
            ))}
          </div>

          {/* Page indicator dots (matches reference) */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/25" />
          </div>
        </div>
      </div>
    </>
  );
};

export default ToolsPanel;
