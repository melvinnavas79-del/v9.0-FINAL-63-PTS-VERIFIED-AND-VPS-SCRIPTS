import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TIGER_IMG = 'https://images.unsplash.com/photo-1767814896543-e9a2da641c4f?w=300&h=300&fit=crop';
const LION_IMG = 'https://images.unsplash.com/photo-1629812456605-4a044aa38fbc?w=300&h=300&fit=crop';

const LionTigerGame = ({ userId, userCoins, onBalanceUpdate, onClose }) => {
  const [coins, setCoins] = useState(userCoins || 0);
  const [activeChip, setActiveChip] = useState(1000000);
  const [betTiger, setBetTiger] = useState(0);
  const [betDraw, setBetDraw] = useState(0);
  const [betLion, setBetLion] = useState(0);
  const [prevBets, setPrevBets] = useState({ tiger: 0, draw: 0, lion: 0 });
  const [seconds, setSeconds] = useState(15);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState('betting'); // betting, attacking, cloud, result, reset
  const [winner, setWinner] = useState(null);
  const [winAmount, setWinAmount] = useState(0);
  const [message, setMessage] = useState('');
  const timerRef = useRef(null);

  useEffect(() => { setCoins(userCoins); }, [userCoins]);

  // Start timer on mount and after each reset
  const startTimer = useCallback(() => {
    setSeconds(15);
    setLocked(false);
    setPhase('betting');
    setWinner(null);
    setMessage('');
    setWinAmount(0);
    setBetTiger(0);
    setBetDraw(0);
    setBetLion(0);

    if (timerRef.current) clearInterval(timerRef.current);
    let s = 15;
    timerRef.current = setInterval(() => {
      s--;
      setSeconds(s);
      if (s <= 0) {
        clearInterval(timerRef.current);
        ejecutarDuelo();
      }
    }, 1000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const ejecutarDuelo = async () => {
    setLocked(true);
    setPhase('attacking');

    // Wait for characters to move
    await new Promise(r => setTimeout(r, 600));
    setPhase('cloud');

    // Cloud impact
    await new Promise(r => setTimeout(r, 1200));

    // Determine winner
    const rand = Math.random();
    const w = rand < 0.45 ? 'tiger' : (rand < 0.9 ? 'lion' : 'draw');
    setWinner(w);
    setPhase('result');

    if (w === 'tiger') setMessage('TIGER WINS!');
    else if (w === 'lion') setMessage('LION WINS!');
    else setMessage('DRAW!');

    // Calculate and pay winnings using current bet state
    // We need to read the current bet values
    setBetTiger(prev => {
      setBetDraw(prevD => {
        setBetLion(prevL => {
          let won = 0;
          if (w === 'tiger' && prev > 0) won = prev * 2;
          if (w === 'lion' && prevL > 0) won = prevL * 2;
          if (w === 'draw' && prevD > 0) won = prevD * 8;

          if (won > 0) {
            setWinAmount(won);
            // Add coins via backend
            axios.post(`${API}/games/play`, { user_id: userId, game: 'lion_tiger', bet: 0 }).catch(() => {});
            setCoins(c => {
              const newBal = c + won;
              if (onBalanceUpdate) onBalanceUpdate(newBal);
              return newBal;
            });
          }

          // Save previous bets
          setPrevBets({ tiger: prev, draw: prevD, lion: prevL });
          return prevL;
        });
        return prevD;
      });
      return prev;
    });

    // Auto reset after 4 seconds
    setTimeout(() => {
      startTimer();
    }, 4000);
  };

  const apostar = async (lado) => {
    if (seconds <= 0 || locked) return;
    if (coins < activeChip) { alert('Monedas insuficientes'); return; }

    // Deduct coins
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: 'lion_tiger', bet: activeChip });
      if (r.data.new_balance !== undefined) {
        setCoins(r.data.new_balance);
        if (onBalanceUpdate) onBalanceUpdate(r.data.new_balance);
      }
    } catch (e) {
      // Deduct locally if API fails
      setCoins(c => c - activeChip);
    }

    if (lado === 'tiger') setBetTiger(b => b + activeChip);
    if (lado === 'draw') setBetDraw(b => b + activeChip);
    if (lado === 'lion') setBetLion(b => b + activeChip);
  };

  const repetir = async () => {
    if (seconds <= 0 || locked) return;
    const total = prevBets.tiger + prevBets.draw + prevBets.lion;
    if (total === 0) return;
    if (coins < total) { alert('Monedas insuficientes para repetir'); return; }

    try {
      if (total > 0) {
        const r = await axios.post(`${API}/games/play`, { user_id: userId, game: 'lion_tiger', bet: total });
        if (r.data.new_balance !== undefined) {
          setCoins(r.data.new_balance);
          if (onBalanceUpdate) onBalanceUpdate(r.data.new_balance);
        }
      }
    } catch (e) {
      setCoins(c => c - total);
    }

    setBetTiger(b => b + prevBets.tiger);
    setBetDraw(b => b + prevBets.draw);
    setBetLion(b => b + prevBets.lion);
  };

  const formatBet = (v) => {
    if (v === 0) return '0';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    return (v / 1e3).toFixed(0) + 'K';
  };

  const chips = [
    { value: 50000, label: '50K', color: '#2980b9' },
    { value: 1000000, label: '1M', color: '#c0392b' },
    { value: 10000000, label: '10M', color: '#f39c12', textColor: '#000' },
  ];

  // Character positions based on phase
  const tigerStyle = {
    left: phase === 'attacking' || phase === 'cloud' || phase === 'result' ? '30%' : '10%',
    transition: 'all 0.5s ease-in-out',
  };
  const lionStyle = {
    right: phase === 'attacking' || phase === 'cloud' || phase === 'result' ? '30%' : '10%',
    transition: 'all 0.5s ease-in-out',
  };

  const tigerClass = winner === 'tiger' ? 'win-glow' : winner === 'lion' ? 'lose-fade' : winner === 'draw' ? '' : '';
  const lionClass = winner === 'lion' ? 'win-glow' : winner === 'tiger' ? 'lose-fade' : winner === 'draw' ? '' : '';

  return (
    <div className="fixed inset-0 z-[58] flex flex-col" style={{ background: '#071f18', overflow: 'hidden' }}>
      <style>{`
        @keyframes shake { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(5px,5px) scale(1.1)} 100%{transform:translate(-5px,-5px) scale(1)} }
        .win-glow { filter: drop-shadow(0 0 20px #ffcc00); transform: scale(1.4) !important; z-index: 30 !important; }
        .lose-fade { opacity: 0.2; transform: scale(0.7) !important; }
        .chip-selected { border-color: #ffcc00 !important; transform: translateY(-5px); box-shadow: 0 0 10px #ffcc00; }
      `}</style>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2" style={{ background: '#000', borderBottom: '2px solid #ffcc00' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">💰</span>
          <span className="text-white font-bold text-sm">{coins.toLocaleString()}</span>
        </div>
        <span className="font-bold text-sm" style={{ color: '#ffcc00' }}>TIGER VS LION</span>
        <button onClick={onClose} data-testid="close-lion-tiger" className="text-white/60 text-lg w-8 h-8 flex items-center justify-center">✕</button>
      </div>

      {/* Timer bar */}
      <div className="flex-shrink-0" style={{ width: '100%', height: '5px', background: '#222' }}>
        <div style={{
          width: `${(seconds / 15) * 100}%`,
          height: '100%',
          background: seconds > 5 ? '#00ff00' : seconds > 2 ? '#ffcc00' : '#ff0000',
          transition: 'width 1s linear',
        }} />
      </div>

      {/* Arena */}
      <div className="flex-shrink-0 relative flex items-center justify-center" style={{
        height: '42vh',
        background: 'radial-gradient(circle, #1a5c48, #071f18)',
        overflow: 'hidden',
      }}>
        {/* Fight cloud - CSS based */}
        {phase === 'cloud' && (
          <div style={{
            position: 'absolute', width: '180px', height: '180px', zIndex: 20,
            background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,100,0.6) 30%, rgba(255,100,0,0.3) 60%, transparent 70%)',
            borderRadius: '50%',
            animation: 'shake 0.1s infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '4rem',
          }}>
            💥
          </div>
        )}

        {/* Message overlay */}
        {(phase === 'result' && message) && (
          <div style={{
            position: 'absolute', zIndex: 100,
            fontSize: '1.8rem', fontWeight: 'bold',
            textShadow: '2px 2px #000',
            color: winner === 'draw' ? '#ffcc00' : '#fff',
          }}>
            {message}
            {winAmount > 0 && (
              <div style={{ fontSize: '1.2rem', color: '#ffcc00', marginTop: '4px' }}>
                +{winAmount.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Tiger */}
        <div className={tigerClass} style={{ position: 'absolute', zIndex: 5, transition: 'all 0.5s ease-in-out', ...tigerStyle }}>
          <div style={{ width: '110px', height: '110px', borderRadius: '50%', overflow: 'hidden', border: '3px solid #ff6600', boxShadow: '0 0 15px rgba(255,102,0,0.5)' }}>
            <img src={TIGER_IMG} alt="Tiger" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ textAlign: 'center', color: '#ff6600', fontWeight: 'bold', fontSize: '0.75rem', marginTop: '4px', textShadow: '0 0 5px #000' }}>TIGER</div>
        </div>

        {/* Lion */}
        <div className={lionClass} style={{ position: 'absolute', zIndex: 5, transition: 'all 0.5s ease-in-out', ...lionStyle }}>
          <div style={{ width: '110px', height: '110px', borderRadius: '50%', overflow: 'hidden', border: '3px solid #ffcc00', boxShadow: '0 0 15px rgba(255,204,0,0.5)' }}>
            <img src={LION_IMG} alt="Lion" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ textAlign: 'center', color: '#ffcc00', fontWeight: 'bold', fontSize: '0.75rem', marginTop: '4px', textShadow: '0 0 5px #000' }}>LION</div>
        </div>

        {/* Timer display */}
        {phase === 'betting' && (
          <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
            <span className="text-white/80 text-lg font-bold" style={{ textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>{seconds}s</span>
          </div>
        )}
      </div>

      {/* Bet zones */}
      <div className="flex-shrink-0 flex justify-around gap-2 px-2 py-2">
        <button onClick={() => apostar('tiger')} data-testid="bet-tiger"
          className="flex-1 text-center py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #ffcc00' }}>
          <div className="text-white font-bold text-sm">TIGER</div>
          <div className="font-bold text-base" style={{ color: '#ffcc00' }}>{formatBet(betTiger)}</div>
        </button>
        <button onClick={() => apostar('draw')} data-testid="bet-draw"
          className="flex-1 text-center py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #ffcc00' }}>
          <div className="text-white font-bold text-sm">DRAW <span className="text-xs">(x8)</span></div>
          <div className="font-bold text-base" style={{ color: '#ffcc00' }}>{formatBet(betDraw)}</div>
        </button>
        <button onClick={() => apostar('lion')} data-testid="bet-lion"
          className="flex-1 text-center py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #ffcc00' }}>
          <div className="text-white font-bold text-sm">LION</div>
          <div className="font-bold text-base" style={{ color: '#ffcc00' }}>{formatBet(betLion)}</div>
        </button>
      </div>

      {/* Chips */}
      <div className="flex-shrink-0 flex justify-center gap-3 py-3" style={{ background: '#000' }}>
        {chips.map(c => (
          <button key={c.value} onClick={() => setActiveChip(c.value)}
            className={`flex items-center justify-center font-bold text-xs ${activeChip === c.value ? 'chip-selected' : ''}`}
            style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: c.color, color: c.textColor || '#fff',
              border: `3px solid ${activeChip === c.value ? '#ffcc00' : '#fff'}`,
              transition: 'all 0.2s',
              transform: activeChip === c.value ? 'translateY(-5px)' : 'none',
              boxShadow: activeChip === c.value ? '0 0 10px #ffcc00' : 'none',
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Repeat button */}
      <div className="flex-shrink-0 text-center py-2" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))' }}>
        <button onClick={repetir} data-testid="repeat-bet"
          style={{
            background: 'none', border: '1px solid #ffcc00', color: '#ffcc00',
            padding: '10px 40px', borderRadius: '25px', fontSize: '0.85rem', fontWeight: 'bold',
          }}
          className="active:scale-95 transition-transform">
          REPETIR APUESTA
        </button>
      </div>
    </div>
  );
};

export default LionTigerGame;
