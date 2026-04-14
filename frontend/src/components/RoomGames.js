import React, { useState } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ========== GAME IMAGES ==========
const GAME_IMAGES = {
  tablita: 'https://static.prod-images.emergentagent.com/jobs/99d578fb-5926-4256-87ab-1ac36cc938b1/images/c3d50fb7daef574602dfa808b3ca651d9a893d98df30968efca120046da02cc3.png',
  pk: 'https://static.prod-images.emergentagent.com/jobs/99d578fb-5926-4256-87ab-1ac36cc938b1/images/c2bf374aeac7beb5bee0543eecea7c123ec2ca0258f80994073aef7ad0d4dfa6.png',
  ludo: 'https://static.prod-images.emergentagent.com/jobs/99d578fb-5926-4256-87ab-1ac36cc938b1/images/e6db59d2ec0616f95209ba1899746a1e15b0aef0b9edbe045e5c095a7eec169c.png',
  uno: 'https://static.prod-images.emergentagent.com/jobs/99d578fb-5926-4256-87ab-1ac36cc938b1/images/bce1ce156d3a4d9f804f706a166433de1d6aa440b50c9b9461515a976f79538e.png',
  domino: 'https://images.unsplash.com/photo-1603290989526-572939369f38?w=200&h=200&fit=crop',
  monster: 'https://static.prod-images.emergentagent.com/jobs/99d578fb-5926-4256-87ab-1ac36cc938b1/images/c12cd7f0f3ed3d00f61156fbbc1e0a136731d693b1b60c1c8f965c99a0cca0f2.png',
  corona: 'https://images.unsplash.com/photo-1617300067484-314ed2cfd9a6?w=200&h=200&fit=crop',
  jackaroo: 'https://images.unsplash.com/photo-1723688958678-6c471759df97?w=200&h=200&fit=crop',
};

// ========== BET SELECTOR ==========
const BetSelector = ({ bet, setBet }) => {
  const presets = [1000, 5000, 10000, 50000, 100000, 500000];
  return (
    <div className="flex gap-1 flex-wrap justify-center">
      {presets.map(p => (
        <button key={p} onClick={() => setBet(p)}
          className={`px-2 py-1 rounded-lg text-[9px] font-bold ${bet === p ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white/60'}`}>
          {p >= 1000000 ? `${p/1000000}M` : `${p/1000}K`}
        </button>
      ))}
    </div>
  );
};

// ========== GAME PLAY SCREEN (reusable) ==========
const GamePlayScreen = ({ gameId, gameName, gameEmoji, userId, onResult, onBack }) => {
  const [bet, setBet] = useState(5000);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);

  const play = async () => {
    setPlaying(true); setResult(null);
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: gameId, bet });
      await new Promise(res => setTimeout(res, 1200));
      setResult(r.data);
      onResult(r.data);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setPlaying(false);
  };

  const gd = result?.game_data || {};

  return (
    <div className="text-center">
      <button onClick={onBack} className="text-white/40 text-xs mb-2 hover:text-white block">← Volver</button>
      <img src={GAME_IMAGES[gameId] || ''} alt="" className="w-20 h-20 rounded-2xl mx-auto mb-2 object-cover" />
      <h3 className="text-white font-bold text-lg mb-1">{gameName}</h3>

      {/* Game visual area */}
      <div className="bg-white/5 rounded-2xl p-4 mb-3 border border-white/10 min-h-[120px] flex items-center justify-center">
        {playing && (
          <div className="text-center">
            <div className="text-4xl mb-2" style={{animation: 'pulse 0.5s infinite'}}>{gameEmoji}</div>
            <div className="text-white/50 text-xs">Jugando...</div>
          </div>
        )}
        {!playing && !result && (
          <div className="text-4xl opacity-30">{gameEmoji}</div>
        )}
        {result && !playing && (
          <div className="w-full">
            {/* Ludo */}
            {gameId === 'ludo' && gd.dice && (
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-white/50 text-[10px]">TU</div>
                  <div className="flex justify-center gap-1">{gd.dice.slice(0,2).map((d,i) => <div key={i} className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-xl font-black">{d}</div>)}</div>
                  <div className="text-yellow-400 font-bold">{gd.player_score}</div>
                </div>
                <div><div className="text-white/50 text-[10px]">BOT</div>
                  <div className="flex justify-center gap-1">{gd.dice.slice(2).map((d,i) => <div key={i} className="w-10 h-10 bg-red-500/30 rounded-lg flex items-center justify-center text-xl font-black text-red-300">{d}</div>)}</div>
                  <div className="text-red-400 font-bold">{gd.bot_score}</div>
                </div>
              </div>
            )}
            {/* Yacaro/Tablita */}
            {(gameId === 'yacaro' || gameId === 'tablita') && gd.dice && (
              <div>
                <div className="flex justify-center gap-1 mb-2">{gd.dice.map((d,i) => <div key={i} className={`w-9 h-9 bg-white rounded-lg flex items-center justify-center text-lg font-black ${d===1?'ring-2 ring-yellow-400':d===5?'ring-2 ring-green-400':''}`}>{['','⚀','⚁','⚂','⚃','⚄','⚅'][d]}</div>)}</div>
                <div className="text-white font-bold">Puntos: {gd.score}</div>
              </div>
            )}
            {/* Carreras */}
            {gameId === 'carreras' && gd.cars && (
              <div className="space-y-1">{gd.cars.map((c,i) => (
                <div key={i} className="flex items-center gap-2"><span className="text-[9px] text-white/40 w-12">{c.name}</span>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${i===gd.winner?'bg-green-500':'bg-white/20'}`} style={{width:`${c.speed}%`}} /></div>
                  {i===gd.winner && <span className="text-[9px]">🏆</span>}
                </div>
              ))}</div>
            )}
            {/* Pool/Corona */}
            {(gameId === 'pool' || gameId === 'corona') && gd.player_sunk !== undefined && (
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-white/50 text-[10px]">TU</div><div className="text-yellow-400 font-bold text-2xl">{gd.player_sunk}/7</div></div>
                <div><div className="text-white/50 text-[10px]">RIVAL</div><div className="text-red-400 font-bold text-2xl">{gd.opponent_sunk}/7</div></div>
              </div>
            )}
            {/* Domino */}
            {gameId === 'domino' && gd.hand && (
              <div>
                <div className="flex flex-wrap justify-center gap-1 mb-2">{gd.hand.slice(0,7).map((t,i) => (
                  <div key={i} className="bg-white text-black rounded w-8 h-12 flex flex-col items-center justify-center text-[10px] font-bold border border-gray-300">
                    <span>{t[0]}</span><div className="w-5 h-px bg-gray-400" /><span>{t[1]}</span>
                  </div>
                ))}</div>
                <div className="text-white text-sm">Tu: <span className="text-yellow-400 font-bold">{gd.player_total}</span> | Bot: <span className="text-red-400 font-bold">{gd.bot_total}</span></div>
              </div>
            )}
            {/* Monster/Eliminacion */}
            {(gameId === 'monster' || gameId === 'eliminacion') && gd.player && (
              <div className="flex items-center justify-center gap-4">
                <div className="text-center"><div className="text-3xl">{{'Dragon':'🐉','Fenix':'🦅','Kraken':'🐙','Golem':'🗿','Hidra':'🐍','Quimera':'🦁'}[gd.player.name]||'👹'}</div><div className="text-white text-[10px]">{gd.player.name}</div><div className="text-yellow-400 text-xs font-bold">⚡{gd.player.power}</div></div>
                <div className="text-red-400 font-black text-xl">VS</div>
                <div className="text-center"><div className="text-3xl">{{'Dragon':'🐉','Fenix':'🦅','Kraken':'🐙','Golem':'🗿','Hidra':'🐍','Quimera':'🦁'}[gd.enemy.name]||'👹'}</div><div className="text-white text-[10px]">{gd.enemy.name}</div><div className="text-red-400 text-xs font-bold">⚡{gd.enemy.power}</div></div>
              </div>
            )}
            {/* UNO / Jackaroo - card games */}
            {(gameId === 'uno' || gameId === 'jackaroo') && !gd.dice && !gd.cars && !gd.hand && !gd.player && (
              <div className="text-white/60 text-sm">
                {result.won ? '🏆 Tu mano fue mejor!' : '💨 La casa gano esta vez'}
              </div>
            )}
            {/* Result banner */}
            <div className={`mt-3 p-2 rounded-xl ${result.won ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} font-bold text-sm`}>
              {result.won ? `GANASTE! +${(result.prize||0).toLocaleString()} (x${result.multiplier})` : 'Perdiste!'}
            </div>
          </div>
        )}
      </div>

      <BetSelector bet={bet} setBet={setBet} />
      <button onClick={play} disabled={playing}
        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black py-3 rounded-xl font-bold mt-2 disabled:opacity-50 active:scale-95 text-sm">
        {playing ? 'Jugando...' : `Apostar ${bet.toLocaleString()}`}
      </button>
    </div>
  );
};

// ========== MAIN GAMES HUB ==========
const GAMES = [
  { id: 'tablita', name: 'Tablita', backendId: 'yacaro' },
  { id: 'pk', name: 'PK', backendId: 'rps', isPK: true },
  { id: 'ludo', name: 'LUDO', backendId: 'ludo' },
  { id: 'uno', name: 'UNO', backendId: 'carta' },
  { id: 'domino', name: 'Domino', backendId: 'domino' },
  { id: 'monster', name: 'Eliminacion', backendId: 'monster' },
  { id: 'corona', name: 'Corona', backendId: 'pool' },
  { id: 'jackaroo', name: 'Jackaroo', backendId: 'yacaro' },
];

const EMOJIS = { tablita: '🎯', pk: '⚔️', ludo: '🎲', uno: '🃏', domino: '🁞', monster: '👹', corona: '🎱', jackaroo: '🎯' };

const RoomGames = ({ userId, userCoins, onResult, onClose, onPlayClassic, onStartPK }) => {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame) {
    const game = GAMES.find(g => g.id === activeGame);
    if (!game) { setActiveGame(null); return null; }
    return (
      <GamePlayScreen
        gameId={game.backendId}
        gameName={game.name}
        gameEmoji={EMOJIS[game.id]}
        userId={userId}
        onResult={onResult}
        onBack={() => setActiveGame(null)}
      />
    );
  }

  return (
    <div>
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
              <img src={GAME_IMAGES[g.id]} alt={g.name} className="w-full h-full object-cover" />
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
