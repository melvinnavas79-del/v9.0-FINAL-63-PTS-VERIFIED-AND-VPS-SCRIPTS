import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LudoGame from './LudoGame';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GAME_IMAGES = {
  tablita: '/api/uploads/game_tablita.png',
  pk: '/api/uploads/game_pk.png',
  ludo: '/api/uploads/game_ludo.png',
  uno: '/api/uploads/game_uno.png',
  domino: 'https://images.unsplash.com/photo-1603290989526-572939369f38?w=400&h=200&fit=crop',
  monster: '/api/uploads/game_monster.png',
  corona: 'https://images.unsplash.com/photo-1617300067484-314ed2cfd9a6?w=400&h=200&fit=crop',
  jackaroo: 'https://images.unsplash.com/photo-1723688958678-6c471759df97?w=400&h=200&fit=crop',
};

const GAME_BG = {
  tablita:  'linear-gradient(180deg, #1a472a 0%, #0d2818 100%)',
  ludo:     'linear-gradient(180deg, #1a5c3a 0%, #0f3d24 100%)',
  uno:      'linear-gradient(180deg, #2d1b4e 0%, #1a0f30 100%)',
  domino:   'linear-gradient(180deg, #3d2b1f 0%, #2a1a10 100%)',
  monster:  'linear-gradient(180deg, #2d1040 0%, #1a0828 100%)',
  corona:   'linear-gradient(180deg, #4a1c1c 0%, #2d0f0f 100%)',
  jackaroo: 'linear-gradient(180deg, #1a3d2e 0%, #0d2818 100%)',
  pk:       'linear-gradient(180deg, #3d1c1c 0%, #2d0f0f 100%)',
};

const GAMES = [
  { id: 'tablita', name: 'Tablita', backendId: 'yacaro', players: 6, type: 'multi' },
  { id: 'pk', name: 'PK', backendId: 'rps', players: 2, type: 'vs', isPK: true },
  { id: 'ludo', name: 'LUDO', backendId: 'ludo', players: 4, type: 'multi' },
  { id: 'uno', name: 'UNO', backendId: 'carta', players: 4, type: 'multi' },
  { id: 'domino', name: 'Domino', backendId: 'domino', players: 2, type: 'vs' },
  { id: 'monster', name: 'Eliminacion', backendId: 'monster', players: 4, type: 'multi' },
  { id: 'corona', name: 'Corona', backendId: 'pool', players: 2, type: 'vs' },
  { id: 'jackaroo', name: 'Jackaroo', backendId: 'yacaro', players: 4, type: 'multi' },
];

// ========== GAME LOBBY (Full overlay like screenshot) ==========
const GameLobby = ({ game, userId, userAvatar, userName, onClose, onResult }) => {
  const [bet, setBet] = useState(5000);
  const [phase, setPhase] = useState('lobby'); // lobby, waiting, playing, result
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const betPresets = [0, 1000, 5000, 10000, 50000, 100000, 500000];

  const startGame = async () => {
    setPhase('waiting');
    // Simulate matchmaking countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 800));
    }
    setPhase('playing');
    // Play the actual game
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: game.backendId, bet });
      await new Promise(r => setTimeout(r, 1500));
      setResult(r.data);
      setPhase('result');
      onResult(r.data);
    } catch (e) {
      alert(e.response?.data?.detail || 'Error');
      setPhase('lobby');
    }
  };

  const playAgain = () => {
    setResult(null);
    setPhase('lobby');
  };

  // Generate bot players
  const botNames = ['Jugador2', 'Jugador3', 'Jugador4', 'Jugador5', 'Jugador6'];
  const playerCount = game.type === 'vs' ? 2 : game.players;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col" style={{background: GAME_BG[game.id] || GAME_BG.ludo}}>
      {/* Diamond pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 21px)'}} />

      {/* Header with coins */}
      <div className="relative flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg border-2 border-yellow-400">
            {userName?.charAt(0) || 'U'}
          </div>
          <div className="flex items-center bg-black/30 rounded-full px-3 py-1 gap-1">
            <span className="text-yellow-400 text-sm">🪙</span>
            <span className="text-yellow-400 text-xs font-bold">{bet.toLocaleString()}</span>
            <button onClick={() => {
              const idx = betPresets.indexOf(bet);
              const next = betPresets[(idx + 1) % betPresets.length];
              setBet(next);
            }} className="w-5 h-5 bg-green-500 rounded-full text-white text-xs font-bold ml-1">+</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 bg-yellow-500/80 rounded-full flex items-center justify-center text-sm">🔑</button>
          <button className="w-8 h-8 bg-yellow-500/80 rounded-full flex items-center justify-center text-sm">❓</button>
          <button className="w-8 h-8 bg-yellow-500/80 rounded-full flex items-center justify-center text-sm">🎯</button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">

        {/* LOBBY PHASE */}
        {phase === 'lobby' && (
          <>
            {/* Game logo */}
            <img src={GAME_IMAGES[game.id]} alt={game.name}
              className="w-48 h-48 object-contain mb-2 drop-shadow-2xl" />

            {/* Game config bar */}
            <div className="w-full max-w-sm bg-gradient-to-r from-amber-700 to-amber-600 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between shadow-lg border border-amber-500/30">
              <span className="text-white font-bold text-sm">
                {game.name}, apuesta {bet.toLocaleString()} oros
              </span>
              <button onClick={() => {
                const idx = betPresets.indexOf(bet);
                setBet(betPresets[(idx + 1) % betPresets.length]);
              }} className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs">✏️</span>
              </button>
            </div>

            {/* Player slots */}
            {game.type === 'vs' ? (
              // VS layout (2 players)
              <div className="flex items-center gap-4 mb-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-2xl border-4 border-yellow-400 shadow-lg">
                    {userName?.charAt(0) || 'U'}
                  </div>
                  <span className="text-white text-xs font-medium mt-1 block">{userName}</span>
                </div>
                <div className="text-yellow-400 font-black text-2xl italic" style={{textShadow: '0 0 10px rgba(234,179,8,0.5)'}}>VS</div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-400/30 flex items-center justify-center border-4 border-white/20 shadow-lg">
                    <span className="text-3xl">👥</span>
                  </div>
                  <span className="text-white/60 text-xs mt-1 block">Jugador</span>
                </div>
              </div>
            ) : (
              // Multi player layout
              <div className="flex items-center gap-3 mb-6 flex-wrap justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl border-3 border-yellow-400">
                    {userName?.charAt(0) || 'U'}
                  </div>
                  <span className="text-white text-[10px] mt-1 block">{userName}</span>
                </div>
                {botNames.slice(0, playerCount - 1).map((name, i) => (
                  <div key={i} className="text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-100/20 flex items-center justify-center border-3 border-white/20">
                      <span className="text-2xl">👥</span>
                    </div>
                    <span className="text-white/60 text-[10px] mt-1 block">{name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Waiting indicator */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⏳</span>
              <span className="text-white/80 text-sm">esperando para empezar</span>
            </div>
            <p className="text-white/40 text-[10px] mb-6">No cambie el fondo durante la formacion del equipo</p>

            {/* Close button */}
            <button onClick={onClose} data-testid="close-game-lobby"
              className="bg-gradient-to-b from-gray-300 to-gray-400 text-gray-800 px-8 py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-95">
              cerrar el juego
            </button>
          </>
        )}

        {/* WAITING PHASE */}
        {phase === 'waiting' && (
          <div className="text-center">
            <img src={GAME_IMAGES[game.id]} alt={game.name} className="w-36 h-36 object-contain mx-auto mb-4 drop-shadow-2xl" />
            <div className="text-white text-6xl font-black mb-2" style={{animation: 'pulse 0.5s infinite'}}>{countdown}</div>
            <p className="text-white/60 text-sm">Preparando partida...</p>
          </div>
        )}

        {/* PLAYING PHASE */}
        {phase === 'playing' && (
          <div className="text-center">
            <img src={GAME_IMAGES[game.id]} alt={game.name} className="w-28 h-28 object-contain mx-auto mb-4" />
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4" style={{animation: 'spin 1s linear infinite'}} />
            <p className="text-white font-bold">Jugando {game.name}...</p>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* RESULT PHASE */}
        {phase === 'result' && result && (
          <div className="text-center w-full max-w-sm">
            <img src={GAME_IMAGES[game.id]} alt={game.name} className="w-28 h-28 object-contain mx-auto mb-3" />

            {/* Result banner */}
            <div className={`rounded-2xl p-6 mb-4 ${result.won ? 'bg-gradient-to-b from-yellow-500/30 to-amber-600/30 border-2 border-yellow-400/50' : 'bg-gradient-to-b from-red-500/30 to-rose-600/30 border-2 border-red-400/50'}`}>
              <div className="text-5xl mb-2">{result.won ? '🏆' : '💔'}</div>
              <div className={`text-2xl font-black mb-1 ${result.won ? 'text-yellow-300' : 'text-red-300'}`}>
                {result.won ? 'VICTORIA!' : 'Derrota'}
              </div>
              {result.won && (
                <div className="text-yellow-400 text-lg font-bold">+{(result.prize || 0).toLocaleString()} monedas</div>
              )}
              {result.won && (
                <div className="text-white/50 text-xs mt-1">Multiplicador x{result.multiplier}</div>
              )}

              {/* Game specific results */}
              {result.game_data && (
                <div className="mt-3 bg-black/20 rounded-xl p-3">
                  {result.game_data.dice && result.game_data.player_score !== undefined && (
                    <div className="flex justify-center gap-4">
                      <div><span className="text-white/50 text-[10px]">TU</span><div className="text-yellow-400 font-bold">{result.game_data.player_score}</div></div>
                      <div><span className="text-white/50 text-[10px]">BOT</span><div className="text-red-400 font-bold">{result.game_data.bot_score}</div></div>
                    </div>
                  )}
                  {result.game_data.score !== undefined && (
                    <div className="text-white font-bold">Puntos: {result.game_data.score}</div>
                  )}
                  {result.game_data.player && result.game_data.enemy && (
                    <div className="flex justify-center gap-4">
                      <div><span className="text-yellow-400">{result.game_data.player.name}</span><div className="text-white/60 text-xs">⚡{result.game_data.player.power}</div></div>
                      <span className="text-red-400 font-bold">vs</span>
                      <div><span className="text-red-400">{result.game_data.enemy.name}</span><div className="text-white/60 text-xs">⚡{result.game_data.enemy.power}</div></div>
                    </div>
                  )}
                  {result.game_data.player_sunk !== undefined && (
                    <div className="flex justify-center gap-4">
                      <div><span className="text-white/50 text-[10px]">TU</span><div className="text-yellow-400 font-bold">{result.game_data.player_sunk}/7</div></div>
                      <div><span className="text-white/50 text-[10px]">RIVAL</span><div className="text-red-400 font-bold">{result.game_data.opponent_sunk}/7</div></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button onClick={playAgain}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95">
                Jugar de nuevo
              </button>
              <button onClick={onClose}
                className="flex-1 bg-gradient-to-b from-gray-300 to-gray-400 text-gray-800 py-3 rounded-2xl font-bold shadow-lg active:scale-95">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom GO banner (in lobby phase) */}
      {phase === 'lobby' && (
        <div className="relative flex-shrink-0 px-4 pb-4">
          <button onClick={startGame} data-testid="game-go-btn"
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl py-3.5 shadow-xl active:scale-95 transition-transform">
            <img src={GAME_IMAGES[game.id]} alt="" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-white font-bold text-sm">El juego comienza ahora!</span>
            <span className="bg-yellow-400 text-black font-black px-3 py-1 rounded-lg text-sm">GO</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ========== GAME GRID (Selection screen) ==========
const RoomGames = ({ userId, userAvatar, userName, userCoins, onResult, onClose, onStartPK, onOpenLionTiger }) => {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame) {
    const game = GAMES.find(g => g.id === activeGame);
    if (!game) { setActiveGame(null); return null; }
    
    // LUDO gets the real board game
    if (game.id === 'ludo') {
      return (
        <LudoGame
          userId={userId}
          userName={userName}
          userAvatar={userAvatar}
          bet={5000}
          onResult={onResult}
          onClose={() => setActiveGame(null)}
        />
      );
    }
    
    return (
      <GameLobby
        game={game}
        userId={userId}
        userAvatar={userAvatar}
        userName={userName}
        onClose={() => setActiveGame(null)}
        onResult={onResult}
      />
    );
  }

  return (
    <div>
      {/* Lion vs Tiger - Featured Game */}
      <button data-testid="game-lion-tiger" onClick={() => onOpenLionTiger && onOpenLionTiger()}
        className="w-full mb-4 bg-gradient-to-r from-amber-700 to-red-700 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform border border-yellow-500/30 shadow-lg">
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-red-500 rounded-xl flex items-center justify-center text-3xl shadow-inner">
          🦁
        </div>
        <div className="flex-1 text-left">
          <div className="text-white font-bold text-base">Lion vs Tiger</div>
          <div className="text-yellow-300/80 text-xs">Casino en vivo - Apuesta y gana!</div>
        </div>
        <div className="text-3xl">🐯</div>
      </button>

      <h4 className="text-white font-bold text-sm mb-3">Juegos de sociedad</h4>
      <div className="grid grid-cols-4 gap-3">
        {GAMES.map(g => (
          <button key={g.id} data-testid={`game-${g.id}`}
            onClick={() => {
              if (g.isPK && onStartPK) { onStartPK(); return; }
              setActiveGame(g.id);
            }}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden shadow-lg shadow-black/30 border-2 border-white/10">
              <img src={GAME_IMAGES[g.id]} alt={g.name} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <span className="text-white text-[10px] font-medium">{g.name}</span>
          </button>
        ))}
      </div>
      <p className="text-yellow-400/40 text-[9px] text-center mt-3">Tus monedas: {(userCoins || 0).toLocaleString()}</p>
    </div>
  );
};

export default RoomGames;
