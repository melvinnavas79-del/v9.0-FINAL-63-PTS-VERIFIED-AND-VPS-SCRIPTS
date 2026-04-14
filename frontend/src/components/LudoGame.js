import React, { useState, useCallback } from 'react';

// Board positions for each color's path (simplified 52-cell loop)
const PATH_LENGTH = 52;
const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];

const COLORS = {
  0: { name: 'Rojo', bg: '#ef4444', light: '#fca5a5', home: '#dc2626' },
  1: { name: 'Verde', bg: '#22c55e', light: '#86efac', home: '#16a34a' },
  2: { name: 'Amarillo', bg: '#eab308', light: '#fde047', home: '#ca8a04' },
  3: { name: 'Azul', bg: '#3b82f6', light: '#93c5fd', home: '#2563eb' },
};

// Board cell positions (15x15 grid, each cell ~22px)
const CELL_SIZE = 22;
const BOARD_SIZE = 15;

// Generate path coordinates for the 52-cell main track
const getPathCoords = () => {
  const coords = [];
  // Bottom path (left to right, row 7-8 area)
  // Starting from red's exit: going up
  for (let r = 13; r >= 9; r--) coords.push([r, 6]); // 0-4: up left column
  coords.push([8, 6]); // 5
  for (let c = 5; c >= 0; c--) coords.push([8, c]); // 6-11: left row
  coords.push([7, 0]); // 12
  coords.push([6, 0]); // 13: safe
  for (let c = 1; c <= 6; c++) coords.push([6, c]); // 14-19: right on top-left
  coords.push([6, 6]); // already counted
  // Adjust - let me use a simpler approach
  return coords;
};

// Simplified: use absolute pixel positions for the 52 path cells
// Going clockwise from red's start
const buildPathPixels = () => {
  const S = CELL_SIZE;
  const pts = [];
  // Red start (bottom-left) going UP
  for (let i = 0; i < 5; i++) pts.push({ x: 6*S, y: (13-i)*S }); // 0-4
  // Turn left
  for (let i = 0; i < 6; i++) pts.push({ x: (5-i)*S, y: 8*S }); // 5-10
  // Up
  pts.push({ x: 0, y: 7*S }); // 11
  pts.push({ x: 0, y: 6*S }); // 12
  // Right along top
  for (let i = 0; i < 6; i++) pts.push({ x: (i+1)*S, y: 6*S }); // 13-18  
  // Green start going RIGHT
  for (let i = 0; i < 5; i++) pts.push({ x: 6*S, y: (5-i)*S }); // 19-23
  // Turn right  
  for (let i = 0; i < 6; i++) pts.push({ x: (8+i)*S, y: 0 }); // 24 (skip center)
  // Hmm this is getting complex. Let me just hardcode key positions.
  return pts;
};

const LudoGame = ({ userId, userName, userAvatar, bet, onResult, onClose }) => {
  const [dice, setDice] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [turn, setTurn] = useState(0); // 0=player(red), 1=green bot, 2=yellow bot, 3=blue bot
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState('Toca GO para tirar los dados');
  
  // Pieces: each player has 4 pieces. Position: -1=home, 0-51=on board, 52=finished
  const [pieces, setPieces] = useState({
    0: [-1, -1, -1, -1], // Red (player)
    1: [-1, -1, -1, -1], // Green
    2: [-1, -1, -1, -1], // Yellow
    3: [-1, -1, -1, -1], // Blue
  });

  const [scores, setScores] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 });

  const rollDice = useCallback(async () => {
    if (rolling || gameOver) return;
    setRolling(true);
    
    // Animate dice
    let finalDice = 0;
    for (let i = 0; i < 8; i++) {
      const d = Math.floor(Math.random() * 6) + 1;
      setDice(d);
      finalDice = d;
      await new Promise(r => setTimeout(r, 100));
    }
    setRolling(false);
    
    if (turn === 0) {
      // Player's turn
      await movePlayerPiece(finalDice);
    }
  }, [rolling, gameOver, turn, pieces]);

  const movePlayerPiece = async (diceVal) => {
    const playerPieces = [...pieces[0]];
    let moved = false;

    if (diceVal === 6) {
      // Try to get a piece out of home first
      const homeIdx = playerPieces.findIndex(p => p === -1);
      if (homeIdx !== -1) {
        playerPieces[homeIdx] = 0;
        moved = true;
        setMessage('Sacaste una ficha!');
      }
    }

    if (!moved) {
      // Move the first piece that's on the board
      const onBoard = playerPieces.findIndex(p => p >= 0 && p < 52);
      if (onBoard !== -1) {
        let newPos = playerPieces[onBoard] + diceVal;
        if (newPos >= 52) newPos = 52; // Finished
        playerPieces[onBoard] = newPos;
        moved = true;
        if (newPos === 52) {
          const newScores = { ...scores, 0: scores[0] + 1 };
          setScores(newScores);
          setMessage('Ficha llego a la meta!');
          if (newScores[0] >= 4) {
            setGameOver(true);
            setWinner(0);
            if (onResult) onResult({ won: true, prize: bet * 3, multiplier: 3 });
            return;
          }
        } else {
          setMessage(`Moviste ${diceVal} casillas`);
        }
      } else if (diceVal !== 6) {
        setMessage('Necesitas un 6 para sacar ficha');
      }
    }

    const newPieces = { ...pieces, 0: playerPieces };
    setPieces(newPieces);

    // Bot turns
    if (diceVal !== 6) {
      await new Promise(r => setTimeout(r, 500));
      await botTurns(newPieces);
    } else {
      setMessage('Sacaste 6! Tira de nuevo');
    }
  };

  const botTurns = async (currentPieces) => {
    let cp = { ...currentPieces };
    for (let bot = 1; bot <= 3; bot++) {
      setTurn(bot);
      await new Promise(r => setTimeout(r, 400));
      const d = Math.floor(Math.random() * 6) + 1;
      setDice(d);
      await new Promise(r => setTimeout(r, 300));

      const botPieces = [...cp[bot]];
      if (d === 6) {
        const homeIdx = botPieces.findIndex(p => p === -1);
        if (homeIdx !== -1) {
          botPieces[homeIdx] = 0;
        } else {
          const onBoard = botPieces.findIndex(p => p >= 0 && p < 52);
          if (onBoard !== -1) {
            let np = botPieces[onBoard] + d;
            if (np >= 52) np = 52;
            botPieces[onBoard] = np;
            if (np === 52) {
              const ns = { ...scores, [bot]: scores[bot] + 1 };
              setScores(ns);
              if (ns[bot] >= 4) {
                setGameOver(true);
                setWinner(bot);
                if (onResult) onResult({ won: false, prize: 0 });
                return;
              }
            }
          }
        }
      } else {
        const onBoard = botPieces.findIndex(p => p >= 0 && p < 52);
        if (onBoard !== -1) {
          let np = botPieces[onBoard] + d;
          if (np >= 52) np = 52;
          botPieces[onBoard] = np;
          if (np === 52) {
            const ns = { ...scores, [bot]: scores[bot] + 1 };
            setScores(ns);
          }
        }
      }
      cp = { ...cp, [bot]: botPieces };
      setPieces(cp);
    }
    setTurn(0);
    setMessage('Tu turno! Toca GO');
  };

  const startGame = () => {
    setGameStarted(true);
    setMessage('Tu turno! Toca GO para tirar dados');
  };

  const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  // Render a home base with 4 piece slots
  const HomeBase = ({ color, playerIdx, label, avatar }) => {
    const c = COLORS[playerIdx];
    const pp = pieces[playerIdx];
    const homeCount = pp.filter(p => p === -1).length;
    const finished = pp.filter(p => p === 52).length;
    return (
      <div className="relative rounded-xl p-2 flex flex-col items-center justify-center" style={{ background: c.bg, minHeight: '110px' }}>
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-7 h-7 rounded-full border-2 border-white/50 flex items-center justify-center"
              style={{ background: pp[i] === -1 ? c.home : pp[i] === 52 ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
              {pp[i] === -1 && <div className="w-4 h-4 rounded-full" style={{ background: c.light }} />}
              {pp[i] === 52 && <span className="text-[8px]">⭐</span>}
            </div>
          ))}
        </div>
        <div className="text-white text-[9px] font-bold">{label}</div>
        {avatar && (
          <div className="absolute bottom-1 left-1 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold border border-white/50">
            {avatar}
          </div>
        )}
        {playerIdx === turn && !gameOver && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ animation: 'pulse 1s infinite' }}>GO</div>
        )}
        {finished > 0 && (
          <div className="absolute top-1 right-1 bg-yellow-400 rounded-full w-5 h-5 flex items-center justify-center text-[8px] font-bold text-black">{finished}</div>
        )}
      </div>
    );
  };

  // Board path cells (simplified visual)
  const PathRow = ({ cells, direction }) => (
    <div className={`flex ${direction === 'col' ? 'flex-col' : ''} gap-0`}>
      {cells.map((cell, i) => (
        <div key={i} className="w-[22px] h-[22px] border border-gray-400/30 flex items-center justify-center text-[6px]"
          style={{ background: cell.color || '#fff', ...cell.style }}>
          {cell.piece && <div className="w-4 h-4 rounded-full border border-white/80 shadow-sm" style={{ background: COLORS[cell.piece].bg }} />}
          {cell.star && <span className="text-[8px]">⭐</span>}
          {cell.arrow && <span className="text-[8px] text-gray-400">{cell.arrow}</span>}
        </div>
      ))}
    </div>
  );

  // Calculate which pieces are where on the board
  const getPiecesAt = (pos) => {
    const result = [];
    for (let p = 0; p < 4; p++) {
      for (let i = 0; i < 4; i++) {
        if (pieces[p][i] === pos) result.push(p);
      }
    }
    return result;
  };

  // Generate board cells
  const genCell = (pos, baseColor) => {
    const piecesHere = getPiecesAt(pos);
    return {
      color: baseColor || '#fff',
      piece: piecesHere.length > 0 ? piecesHere[0] : null,
      star: SAFE_SPOTS.includes(pos),
    };
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col" style={{ background: 'linear-gradient(180deg, #1a5c3a 0%, #0f3d24 100%)' }}>
      {/* Diamond pattern */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 21px)' }} />

      {/* Header */}
      <div className="relative flex-shrink-0 flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm border-2 border-yellow-400">
            {userName?.charAt(0) || 'U'}
          </div>
          <span className="text-yellow-400 text-xs font-bold">🪙 {bet?.toLocaleString() || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-3xl transition-all ${rolling ? 'animate-bounce' : ''}`}>{dice > 0 ? diceEmojis[dice] : '🎲'}</div>
          <button onClick={onClose} className="text-white/50 text-lg">✕</button>
        </div>
      </div>

      {/* Message */}
      <div className="relative flex-shrink-0 text-center px-3">
        <div className="bg-black/40 text-white text-[10px] px-3 py-1 rounded-full inline-block">{message}</div>
      </div>

      {/* BOARD */}
      <div className="relative flex-1 flex items-center justify-center px-2">
        <div className="bg-amber-800 rounded-2xl p-2 shadow-2xl border-4 border-amber-900/50" style={{ width: '340px', maxWidth: '95vw' }}>
          <div className="bg-white rounded-xl overflow-hidden" style={{ aspectRatio: '1/1' }}>
            {/* 3x3 grid: corners + paths + center */}
            <div className="grid grid-cols-3 h-full" style={{ gridTemplateRows: '1fr auto 1fr', gridTemplateColumns: '1fr auto 1fr' }}>
              
              {/* Top-Left: GREEN home */}
              <div className="p-1"><HomeBase color="green" playerIdx={1} label="Bot 1" avatar="🤖" /></div>
              
              {/* Top-Center: Vertical path (green home stretch) */}
              <div className="flex flex-col items-center justify-end py-1 gap-0">
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} className="flex gap-0">
                    <div className="w-[22px] h-[22px] border border-gray-300/50 flex items-center justify-center" style={{ background: i === 0 ? '#22c55e' : '#fff' }}>
                      {getPiecesAt(24+i).length > 0 && <div className="w-4 h-4 rounded-full" style={{ background: COLORS[getPiecesAt(24+i)[0]].bg }} />}
                    </div>
                    <div className="w-[22px] h-[22px] border border-gray-300/50" style={{ background: '#86efac' }}>
                      {i < 5 && <div className="w-full h-full flex items-center justify-center"><span className="text-[6px] text-green-800">▼</span></div>}
                    </div>
                    <div className="w-[22px] h-[22px] border border-gray-300/50 flex items-center justify-center" style={{ background: '#fff' }}>
                      {getPiecesAt(18-i).length > 0 && <div className="w-4 h-4 rounded-full" style={{ background: COLORS[getPiecesAt(18-i)[0]].bg }} />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Top-Right: YELLOW home */}
              <div className="p-1"><HomeBase color="yellow" playerIdx={2} label="Bot 2" avatar="🤖" /></div>

              {/* Middle-Left: Horizontal path (red home stretch) */}
              <div className="flex items-center justify-end px-1 gap-0">
                <div className="flex flex-col gap-0">
                  {[0,1,2].map(row => (
                    <div key={row} className="flex gap-0">
                      {[0,1,2,3,4,5].map(col => {
                        const isMiddle = row === 1;
                        const isTop = row === 0;
                        const bg = isMiddle ? '#fca5a5' : '#fff';
                        const pos = isTop ? 5 - col : row === 2 ? 7 + col : -1;
                        return (
                          <div key={col} className="w-[22px] h-[22px] border border-gray-300/50 flex items-center justify-center" style={{ background: bg }}>
                            {isMiddle && col < 5 && <span className="text-[6px] text-red-800">►</span>}
                            {!isMiddle && pos >= 0 && getPiecesAt(pos).length > 0 && <div className="w-4 h-4 rounded-full" style={{ background: COLORS[getPiecesAt(pos)[0]].bg }} />}
                            {isTop && col === 0 && <span className="text-[8px]">⭐</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* CENTER: 4 colored triangles */}
              <div className="flex items-center justify-center">
                <div className="w-[66px] h-[66px] relative overflow-hidden">
                  <div className="absolute inset-0" style={{
                    background: `conic-gradient(from 45deg, #ef4444 0deg 90deg, #22c55e 90deg 180deg, #eab308 180deg 270deg, #3b82f6 270deg 360deg)`
                  }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-[6px]">⭐</div>
                  </div>
                </div>
              </div>

              {/* Middle-Right: Horizontal path (yellow home stretch) */}
              <div className="flex items-center justify-start px-1 gap-0">
                <div className="flex flex-col gap-0">
                  {[0,1,2].map(row => (
                    <div key={row} className="flex gap-0">
                      {[0,1,2,3,4,5].map(col => {
                        const isMiddle = row === 1;
                        const bg = isMiddle ? '#fde047' : '#fff';
                        const pos = row === 0 ? 31 + col : row === 2 ? 43 - col : -1;
                        return (
                          <div key={col} className="w-[22px] h-[22px] border border-gray-300/50 flex items-center justify-center" style={{ background: bg }}>
                            {isMiddle && col < 5 && <span className="text-[6px] text-yellow-800">◄</span>}
                            {!isMiddle && pos >= 0 && pos < 52 && getPiecesAt(pos).length > 0 && <div className="w-4 h-4 rounded-full" style={{ background: COLORS[getPiecesAt(pos)[0]].bg }} />}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom-Left: RED home (PLAYER) */}
              <div className="p-1"><HomeBase color="red" playerIdx={0} label={userName || 'Tu'} avatar={userName?.charAt(0)} /></div>

              {/* Bottom-Center: Vertical path (blue home stretch) */}
              <div className="flex flex-col items-center justify-start py-1 gap-0">
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} className="flex gap-0">
                    <div className="w-[22px] h-[22px] border border-gray-300/50 flex items-center justify-center" style={{ background: '#fff' }}>
                      {getPiecesAt(44+i).length > 0 && i + 44 < 52 && <div className="w-4 h-4 rounded-full" style={{ background: COLORS[getPiecesAt(44+i)[0]].bg }} />}
                    </div>
                    <div className="w-[22px] h-[22px] border border-gray-300/50" style={{ background: '#93c5fd' }}>
                      {i < 5 && <div className="w-full h-full flex items-center justify-center"><span className="text-[6px] text-blue-800">▲</span></div>}
                    </div>
                    <div className="w-[22px] h-[22px] border border-gray-300/50 flex items-center justify-center" style={{ background: i === 5 ? '#3b82f6' : '#fff' }}>
                      {getPiecesAt(38-i).length > 0 && <div className="w-4 h-4 rounded-full" style={{ background: COLORS[getPiecesAt(38-i)[0]].bg }} />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom-Right: BLUE home */}
              <div className="p-1"><HomeBase color="blue" playerIdx={3} label="Bot 3" avatar="🤖" /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Over overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
          <div className="bg-gray-900 rounded-3xl p-6 text-center max-w-xs mx-4">
            <div className="text-5xl mb-3">{winner === 0 ? '🏆' : '💔'}</div>
            <h2 className={`text-2xl font-black mb-2 ${winner === 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {winner === 0 ? 'VICTORIA!' : `${COLORS[winner].name} Gano`}
            </h2>
            {winner === 0 && <p className="text-yellow-300 text-lg font-bold mb-1">+{(bet * 3).toLocaleString()} monedas</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setPieces({0:[-1,-1,-1,-1],1:[-1,-1,-1,-1],2:[-1,-1,-1,-1],3:[-1,-1,-1,-1]}); setScores({0:0,1:0,2:0,3:0}); setGameOver(false); setWinner(null); setDice(0); setTurn(0); setGameStarted(true); setMessage('Tu turno! Toca GO'); }}
                className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-bold active:scale-95">Otra vez</button>
              <button onClick={onClose} className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-bold active:scale-95">Salir</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom: GO button */}
      <div className="relative flex-shrink-0 px-4 pb-3 pt-1">
        {!gameStarted ? (
          <button onClick={startGame} data-testid="ludo-start-btn"
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl py-3 shadow-xl active:scale-95">
            <span className="text-white font-bold">El juego comienza ahora!</span>
            <span className="bg-yellow-400 text-black font-black px-3 py-1 rounded-lg">GO</span>
          </button>
        ) : (
          <button onClick={rollDice} disabled={rolling || turn !== 0 || gameOver} data-testid="ludo-roll-btn"
            className={`w-full flex items-center justify-center gap-3 rounded-2xl py-3 shadow-xl active:scale-95 transition-all ${
              turn === 0 && !rolling ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gray-600 opacity-50'
            }`}>
            <span className="text-3xl">{rolling ? '🎲' : diceEmojis[dice] || '🎲'}</span>
            <span className="text-white font-bold text-lg">Girar</span>
            <span className="bg-yellow-400 text-black font-black px-4 py-1 rounded-lg text-lg">GO</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default LudoGame;
