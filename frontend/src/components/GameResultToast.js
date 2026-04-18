import React, { useEffect, useState } from 'react';

/**
 * GameResultToast — Toast flotante premium para mostrar resultado de mini-juegos rápidos
 * (Ruleta, Dados, Mora, etc.) lanzados desde el ToolsPanel.
 *
 * Recibe `result` con forma flexible: { won, prize, multiplier?, result?, dice1?, dice2?, reels? }
 */
const GameResultToast = ({ result, onDone }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!result) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDone?.(), 300);
    }, 3200);
    return () => clearTimeout(t);
  }, [result, onDone]);

  if (!result) return null;

  const won = !!result.won || (result.multiplier && result.multiplier > 0);
  const prize = result.prize || result.winnings || 0;
  const title = won ? '¡GANASTE!' : 'Sin suerte';
  const subtitle = result.result || result.message || (won ? `+${prize.toLocaleString()} monedas` : 'Intenta otra vez');

  // Visual content depending on game data
  const visual = (() => {
    if (result.dice1 !== undefined && result.dice2 !== undefined) {
      return (
        <div className="flex gap-3 justify-center">
          <DiceFace value={result.dice1} />
          <DiceFace value={result.dice2} />
        </div>
      );
    }
    if (Array.isArray(result.reels) && result.reels.length) {
      return (
        <div className="flex gap-2 justify-center">
          {result.reels.map((r, i) => (
            <div key={i} className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/90 to-white/60 flex items-center justify-center text-3xl shadow-inner">
              {r}
            </div>
          ))}
        </div>
      );
    }
    if (result.multiplier && result.multiplier > 0) {
      return (
        <div className="text-center">
          <div className="text-5xl font-black text-yellow-300" style={{ textShadow: '0 0 20px rgba(255,215,0,0.8)' }}>
            x{result.multiplier}
          </div>
        </div>
      );
    }
    return null;
  })();

  return (
    <div
      data-testid="game-result-toast"
      className="fixed inset-0 z-[80] pointer-events-none flex items-start justify-center"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 40px) + 80px)' }}
    >
      <style>{`
        @keyframes grt-in  { from { opacity: 0; transform: translateY(-30px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes grt-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-30px) scale(0.9); } }
      `}</style>
      <div
        className="pointer-events-auto px-6 py-4 rounded-3xl border shadow-2xl min-w-[260px] max-w-[340px]"
        style={{
          background: won
            ? 'linear-gradient(180deg, rgba(48,20,72,0.95), rgba(24,10,40,0.97))'
            : 'linear-gradient(180deg, rgba(45,25,25,0.95), rgba(25,15,15,0.97))',
          borderColor: won ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.12)',
          boxShadow: won
            ? '0 20px 60px rgba(255,170,0,0.25), 0 0 0 1px rgba(255,215,0,0.12) inset'
            : '0 20px 40px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          animation: visible ? 'grt-in 0.35s cubic-bezier(0.2,0.9,0.3,1) forwards' : 'grt-out 0.3s ease-in forwards',
        }}
      >
        <div className="text-center mb-2">
          <div
            className={`text-lg font-black tracking-wide ${won ? 'text-yellow-300' : 'text-white/70'}`}
            style={won ? { textShadow: '0 2px 8px rgba(255,215,0,0.5)' } : {}}
          >
            {won ? '🏆 ' : ''}{title}{won ? ' 🏆' : ''}
          </div>
          <div className="text-white/70 text-xs mt-0.5">{subtitle}</div>
        </div>
        {visual && <div className="my-2">{visual}</div>}
        {won && prize > 0 && (
          <div className="mt-2 text-center">
            <div className="inline-flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-400/40 rounded-full px-3 py-1">
              <span className="text-yellow-200 text-sm font-black">+{prize.toLocaleString()}</span>
              <span className="text-yellow-200 text-xs">🪙</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DiceFace = ({ value }) => {
  // Render 1-6 dot pattern on a white dice face
  const dots = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  }[value] || [[50, 50]];
  return (
    <div className="relative w-14 h-14 rounded-xl" style={{
      background: 'linear-gradient(135deg, #ffffff, #d9e3f5)',
      boxShadow: '0 4px 10px rgba(0,0,0,0.4), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -3px 4px rgba(0,0,0,0.1)',
    }}>
      {dots.map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-gray-800"
          style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </div>
  );
};

export default GameResultToast;
