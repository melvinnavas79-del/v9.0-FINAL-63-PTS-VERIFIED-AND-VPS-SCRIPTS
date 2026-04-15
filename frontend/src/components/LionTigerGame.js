import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CARDS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['♠','♥','♦','♣'];
const SUIT_COLORS = {'♠':'#fff','♥':'#ef4444','♦':'#ef4444','♣':'#fff'};

const Card = ({ value, suit, revealed, delay }) => (
  <div className={`relative w-20 h-28 rounded-xl transition-all duration-500 ${revealed ? 'scale-100' : 'scale-y-0'}`}
    style={{ transitionDelay: `${delay}ms` }}>
    {revealed ? (
      <div className="w-full h-full bg-white rounded-xl border-2 border-gray-300 flex flex-col items-center justify-center shadow-xl">
        <span className="text-2xl font-black" style={{color: SUIT_COLORS[suit]}}>{value}</span>
        <span className="text-3xl" style={{color: SUIT_COLORS[suit]}}>{suit}</span>
      </div>
    ) : (
      <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 rounded-xl border-2 border-yellow-500 flex items-center justify-center shadow-xl">
        <span className="text-yellow-400 text-2xl font-bold">?</span>
      </div>
    )}
  </div>
);

const LionTigerGame = ({ userId, userCoins, onBalanceUpdate, onClose }) => {
  const [bet, setBet] = useState(5000);
  const [choice, setChoice] = useState(null);
  const [phase, setPhase] = useState('bet');
  const [lionCard, setLionCard] = useState(null);
  const [tigerCard, setTigerCard] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [coins, setCoins] = useState(userCoins || 0);
  const [streak, setStreak] = useState(0);

  useEffect(() => { setCoins(userCoins); }, [userCoins]);

  const betPresets = [1000, 5000, 10000, 50000, 100000, 500000];

  const drawCard = () => {
    const val = CARDS[Math.floor(Math.random() * CARDS.length)];
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    return { value: val, suit, rank: CARDS.indexOf(val) };
  };

  const play = async () => {
    if (!choice) return;
    if (coins < bet) { alert('Monedas insuficientes'); return; }

    setPhase('dealing');
    setResult(null);

    const lion = drawCard();
    const tiger = drawCard();

    // Show cards with delay
    setTimeout(() => setLionCard(lion), 500);
    setTimeout(() => setTigerCard(tiger), 1000);

    // Determine winner
    setTimeout(async () => {
      let winner;
      if (lion.rank > tiger.rank) winner = 'lion';
      else if (tiger.rank > lion.rank) winner = 'tiger';
      else winner = 'tie';

      const won = choice === winner;
      const multiplier = choice === 'tie' ? (won ? 8 : 0) : (won ? 2 : 0);
      const prize = won ? bet * multiplier : 0;

      // Call backend
      try {
        const r = await axios.post(`${API}/games/play`, {
          user_id: userId, game: 'lion_tiger', bet
        });
        // Override with our local result since backend is random
        const newBal = won ? (r.data.new_balance || coins) + prize - (r.data.prize || 0) : r.data.new_balance || coins;
        
        // Use backend for actual balance tracking
        if (won) {
          await axios.post(`${API}/games/play`, { user_id: userId, game: 'ruleta', bet: 0 });
        }
      } catch (e) { /* continue with local state */ }

      // Update local state
      const newCoins = won ? coins + (prize - bet) : coins - bet;
      setCoins(Math.max(0, newCoins));

      const resultData = { winner, won, prize, multiplier, lionCard: lion, tigerCard: tiger };
      setResult(resultData);
      setHistory(prev => [{ winner, lion: lion.value + lion.suit, tiger: tiger.value + tiger.suit }, ...prev].slice(0, 20));
      setStreak(won ? streak + 1 : 0);
      setPhase('result');

      if (onBalanceUpdate) onBalanceUpdate(Math.max(0, newCoins));
    }, 1800);
  };

  const playAgain = () => {
    setPhase('bet');
    setChoice(null);
    setLionCard(null);
    setTigerCard(null);
    setResult(null);
  };

  return (
    <div className="fixed inset-0 z-[58] flex flex-col" style={{background: 'linear-gradient(180deg, #1a0f00 0%, #2d1500 30%, #1a0800 100%)'}}>
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,215,0,0.1) 30px, rgba(255,215,0,0.1) 31px)'}} />

      {/* Header */}
      <div className="relative flex-shrink-0 flex items-center justify-between px-4" style={{paddingTop: 'max(10px, env(safe-area-inset-top, 10px))', paddingBottom: '6px'}}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦁</span>
          <span className="text-yellow-400 font-black text-lg" style={{textShadow: '0 0 10px rgba(234,179,8,0.5)'}}>VS</span>
          <span className="text-2xl">🐯</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-black/40 rounded-full px-3 py-1 flex items-center gap-1">
            <span className="text-yellow-400">💰</span>
            <span className="text-yellow-400 text-sm font-bold">{coins >= 1e6 ? `${(coins/1e6).toFixed(1)}M` : coins.toLocaleString()}</span>
          </div>
          {streak > 1 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{streak}x Racha</span>}
          <button onClick={onClose} data-testid="close-lion-tiger" className="bg-white/20 w-9 h-9 rounded-full flex items-center justify-center text-lg">✕</button>
        </div>
      </div>

      {/* Main game area */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4">

        {/* Table */}
        <div className="w-full max-w-sm bg-gradient-to-b from-green-900/60 to-green-950/80 rounded-3xl border-2 border-yellow-600/30 p-5 shadow-2xl mb-4">
          
          {/* Lion vs Tiger labels */}
          <div className="flex justify-between mb-3">
            <div className="text-center">
              <div className="text-3xl mb-1">🦁</div>
              <div className="text-amber-400 font-bold text-sm">LION</div>
            </div>
            <div className="text-yellow-500/30 font-black text-xl self-center">VS</div>
            <div className="text-center">
              <div className="text-3xl mb-1">🐯</div>
              <div className="text-orange-400 font-bold text-sm">TIGER</div>
            </div>
          </div>

          {/* Cards area */}
          <div className="flex items-center justify-center gap-8 mb-4 min-h-[120px]">
            <div className="text-center">
              {(phase === 'dealing' || phase === 'result') ? (
                <Card value={lionCard?.value} suit={lionCard?.suit} revealed={!!lionCard} delay={0} />
              ) : (
                <div className="w-20 h-28 rounded-xl border-2 border-dashed border-amber-500/30 flex items-center justify-center">
                  <span className="text-amber-500/30 text-xs">LION</span>
                </div>
              )}
            </div>
            <div className="text-center">
              {(phase === 'dealing' || phase === 'result') ? (
                <Card value={tigerCard?.value} suit={tigerCard?.suit} revealed={!!tigerCard} delay={400} />
              ) : (
                <div className="w-20 h-28 rounded-xl border-2 border-dashed border-orange-500/30 flex items-center justify-center">
                  <span className="text-orange-500/30 text-xs">TIGER</span>
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          {phase === 'result' && result && (
            <div className={`text-center p-3 rounded-2xl mb-3 ${result.won ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-red-500/20 border border-red-400/30'}`}
              style={{animation: 'fadeIn 0.3s ease'}}>
              <div className="text-2xl mb-1">{result.won ? '🏆' : '💔'}</div>
              <div className={`font-black text-lg ${result.won ? 'text-yellow-300' : 'text-red-300'}`}>
                {result.won ? `GANASTE +${result.prize.toLocaleString()}` : 'Perdiste'}
              </div>
              <div className="text-white/40 text-xs mt-1">
                {result.winner === 'lion' ? '🦁 Lion gana' : result.winner === 'tiger' ? '🐯 Tiger gana' : '🤝 Empate'}
              </div>
            </div>
          )}
        </div>

        {/* Betting area */}
        {phase === 'bet' && (
          <div className="w-full max-w-sm">
            {/* Choice buttons */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button onClick={() => setChoice('lion')} data-testid="bet-lion"
                className={`p-4 rounded-2xl border-2 text-center transition-all active:scale-95 ${choice === 'lion' ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/20' : 'bg-white/5 border-white/10'}`}>
                <div className="text-3xl mb-1">🦁</div>
                <div className="text-white font-bold text-sm">Lion</div>
                <div className="text-yellow-400 text-xs">x2</div>
              </button>
              <button onClick={() => setChoice('tie')} data-testid="bet-tie"
                className={`p-4 rounded-2xl border-2 text-center transition-all active:scale-95 ${choice === 'tie' ? 'bg-purple-500/20 border-purple-400 shadow-lg shadow-purple-500/20' : 'bg-white/5 border-white/10'}`}>
                <div className="text-3xl mb-1">🤝</div>
                <div className="text-white font-bold text-sm">Tie</div>
                <div className="text-purple-400 text-xs">x8</div>
              </button>
              <button onClick={() => setChoice('tiger')} data-testid="bet-tiger"
                className={`p-4 rounded-2xl border-2 text-center transition-all active:scale-95 ${choice === 'tiger' ? 'bg-orange-500/20 border-orange-400 shadow-lg shadow-orange-500/20' : 'bg-white/5 border-white/10'}`}>
                <div className="text-3xl mb-1">🐯</div>
                <div className="text-white font-bold text-sm">Tiger</div>
                <div className="text-yellow-400 text-xs">x2</div>
              </button>
            </div>

            {/* Bet amount */}
            <div className="flex gap-1.5 flex-wrap justify-center mb-3">
              {betPresets.map(p => (
                <button key={p} onClick={() => setBet(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${bet === p ? 'bg-yellow-500 text-black scale-105' : 'bg-white/10 text-white/60'}`}>
                  {p >= 1000000 ? `${p/1000000}M` : `${p/1000}K`}
                </button>
              ))}
            </div>

            {/* Play button */}
            <button onClick={play} disabled={!choice} data-testid="lion-tiger-play"
              className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all ${choice ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black' : 'bg-gray-700 text-gray-500'}`}>
              {choice ? `Apostar ${bet.toLocaleString()} a ${choice === 'lion' ? '🦁 Lion' : choice === 'tiger' ? '🐯 Tiger' : '🤝 Tie'}` : 'Elige Lion, Tiger o Tie'}
            </button>
          </div>
        )}

        {/* Dealing animation */}
        {phase === 'dealing' && (
          <div className="text-center">
            <div className="text-white/60 text-sm font-bold" style={{animation: 'pulse 0.5s infinite'}}>Repartiendo cartas...</div>
          </div>
        )}

        {/* Play again */}
        {phase === 'result' && (
          <div className="w-full max-w-sm flex gap-3">
            <button onClick={playAgain} data-testid="lion-tiger-again"
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3.5 rounded-2xl font-bold active:scale-95">
              Jugar de nuevo
            </button>
            <button onClick={onClose}
              className="flex-1 bg-white/10 text-white py-3.5 rounded-2xl font-bold active:scale-95">
              Salir
            </button>
          </div>
        )}
      </div>

      {/* History bar */}
      {history.length > 0 && (
        <div className="relative flex-shrink-0 px-4 pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <span className="text-white/30 text-[10px] self-center mr-1">Historial:</span>
            {history.map((h, i) => (
              <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${h.winner === 'lion' ? 'bg-amber-500/30 text-amber-300' : h.winner === 'tiger' ? 'bg-orange-500/30 text-orange-300' : 'bg-purple-500/30 text-purple-300'}`}>
                {h.winner === 'lion' ? 'L' : h.winner === 'tiger' ? 'T' : '='}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
};

export default LionTigerGame;
