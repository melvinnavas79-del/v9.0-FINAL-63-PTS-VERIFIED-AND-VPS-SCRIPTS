import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ========== INDIVIDUAL GAME COMPONENTS ==========

const LudoGame = ({ userId, onResult, onClose }) => {
  const [bet, setBet] = useState(5000);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [dice, setDice] = useState([0, 0, 0, 0]);
  const [animStep, setAnimStep] = useState(0);

  const play = async () => {
    setPlaying(true); setResult(null); setAnimStep(0);
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: 'ludo', bet });
      const gd = r.data.game_data || {};
      // Animate dice one by one
      for (let i = 0; i < 4; i++) {
        await new Promise(res => setTimeout(res, 400));
        setDice(prev => { const n = [...prev]; n[i] = gd.dice?.[i] || 0; return n; });
        setAnimStep(i + 1);
      }
      await new Promise(res => setTimeout(res, 600));
      setResult(r.data);
      onResult(r.data);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setPlaying(false);
  };

  return (
    <div className="text-center">
      <div className="text-3xl mb-2">🎲</div>
      <h3 className="text-white font-bold mb-3">LUDO - Batalla de Dados</h3>
      <p className="text-white/40 text-[10px] mb-3">Tu: 2 dados vs Bot: 2 dados. Mayor suma gana x2-x3</p>
      {/* Board visual */}
      <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-2xl p-4 mb-3 border border-white/10">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-white/60 text-[10px] mb-1">TU</div>
            <div className="flex justify-center gap-2">
              {[0,1].map(i => (
                <div key={i} className={`w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl font-black transition-all ${animStep > i ? 'scale-100 opacity-100' : 'scale-50 opacity-30'}`}>
                  {animStep > i ? dice[i] : '?'}
                </div>
              ))}
            </div>
            {result && <div className="text-yellow-400 font-bold mt-1">{result.game_data?.player_score}</div>}
          </div>
          <div className="text-center">
            <div className="text-white/60 text-[10px] mb-1">BOT</div>
            <div className="flex justify-center gap-2">
              {[2,3].map(i => (
                <div key={i} className={`w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center text-2xl font-black text-red-300 transition-all ${animStep > i ? 'scale-100 opacity-100' : 'scale-50 opacity-30'}`}>
                  {animStep > i ? dice[i] : '?'}
                </div>
              ))}
            </div>
            {result && <div className="text-red-400 font-bold mt-1">{result.game_data?.bot_score}</div>}
          </div>
        </div>
      </div>
      {result && (
        <div className={`p-3 rounded-xl mb-3 ${result.won ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} font-bold`}>
          {result.won ? `GANASTE! +${result.prize?.toLocaleString()} (x${result.multiplier})` : 'Perdiste!'}
        </div>
      )}
      <BetSelector bet={bet} setBet={setBet} />
      <button onClick={play} disabled={playing} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-bold mt-2 disabled:opacity-50 active:scale-95">
        {playing ? 'Tirando dados...' : `Jugar ${bet.toLocaleString()}`}
      </button>
    </div>
  );
};

const YacaroGame = ({ userId, onResult, onClose }) => {
  const [bet, setBet] = useState(5000);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [dice, setDice] = useState([0,0,0,0,0,0]);
  const [revealed, setRevealed] = useState(0);

  const play = async () => {
    setPlaying(true); setResult(null); setRevealed(0); setDice([0,0,0,0,0,0]);
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: 'yacaro', bet });
      const gd = r.data.game_data || {};
      for (let i = 0; i < 6; i++) {
        await new Promise(res => setTimeout(res, 300));
        setDice(prev => { const n = [...prev]; n[i] = gd.dice?.[i] || 0; return n; });
        setRevealed(i + 1);
      }
      await new Promise(res => setTimeout(res, 500));
      setResult(r.data);
      onResult(r.data);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setPlaying(false);
  };

  const diceEmoji = (n) => ['','⚀','⚁','⚂','⚃','⚄','⚅'][n] || '?';

  return (
    <div className="text-center">
      <div className="text-3xl mb-2">🎯</div>
      <h3 className="text-white font-bold mb-3">YACARO - Greedy Dice</h3>
      <p className="text-white/40 text-[10px] mb-3">6 dados: Unos=100pts, Cincos=50pts, Triples=bonus. 350+ pts para ganar</p>
      <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-2xl p-4 mb-3 border border-white/10">
        <div className="flex justify-center gap-2 mb-3">
          {dice.map((d, i) => (
            <div key={i} className={`w-11 h-11 bg-white rounded-lg flex items-center justify-center text-xl transition-all duration-300 ${revealed > i ? 'scale-100 rotate-0' : 'scale-0 rotate-180'} ${d === 1 ? 'ring-2 ring-yellow-400' : d === 5 ? 'ring-2 ring-green-400' : ''}`}>
              {revealed > i ? diceEmoji(d) : ''}
            </div>
          ))}
        </div>
        {result && (
          <div className="text-white text-sm">
            <span className="text-yellow-400">Unos: {result.game_data?.ones}</span> |
            <span className="text-green-400"> Cincos: {result.game_data?.fives}</span> |
            <span className="text-purple-400"> Triples: {result.game_data?.triples}</span>
            <div className="text-white font-bold text-lg mt-1">Total: {result.game_data?.score} pts</div>
          </div>
        )}
      </div>
      {result && (
        <div className={`p-3 rounded-xl mb-3 ${result.won ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} font-bold`}>
          {result.won ? `GANASTE! +${result.prize?.toLocaleString()} (x${result.multiplier})` : 'Menos de 350 pts. Perdiste!'}
        </div>
      )}
      <BetSelector bet={bet} setBet={setBet} />
      <button onClick={play} disabled={playing} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-bold mt-2 disabled:opacity-50 active:scale-95">
        {playing ? 'Lanzando...' : `Jugar ${bet.toLocaleString()}`}
      </button>
    </div>
  );
};

const CarrerasGame = ({ userId, onResult, onClose }) => {
  const [bet, setBet] = useState(5000);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedCar, setSelectedCar] = useState(0);
  const [positions, setPositions] = useState([0,0,0,0,0]);
  const [racing, setRacing] = useState(false);
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-gray-800'];
  const names = ['Rojo', 'Azul', 'Verde', 'Dorado', 'Negro'];

  const play = async () => {
    setPlaying(true); setResult(null); setPositions([0,0,0,0,0]); setRacing(true);
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: 'carreras', bet });
      const gd = r.data.game_data || {};
      // Animate race
      const speeds = gd.cars?.map(c => c.speed) || [70,70,70,70,70];
      for (let step = 0; step < 20; step++) {
        await new Promise(res => setTimeout(res, 150));
        setPositions(prev => prev.map((p, i) => Math.min(100, p + speeds[i] / 20 + (Math.random() * 3 - 1))));
      }
      // Set final positions
      setPositions(speeds);
      await new Promise(res => setTimeout(res, 500));
      setRacing(false);
      setResult({...r.data, selectedCar});
      onResult(r.data);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setPlaying(false);
  };

  return (
    <div className="text-center">
      <div className="text-3xl mb-2">🏎️</div>
      <h3 className="text-white font-bold mb-3">CARRERAS - Race Betting</h3>
      <p className="text-white/40 text-[10px] mb-3">Elige tu carro y gana x5 si llega primero</p>
      {/* Car selection */}
      {!racing && !result && (
        <div className="flex gap-2 justify-center mb-3">
          {names.map((n, i) => (
            <button key={i} onClick={() => setSelectedCar(i)}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold border-2 transition-all ${selectedCar === i ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300' : 'border-white/10 bg-white/5 text-white/60'}`}>
              🏎️ {n}
            </button>
          ))}
        </div>
      )}
      {/* Race track */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-3 mb-3 border border-white/10">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] text-white/40 w-10">{names[i]}</span>
            <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden relative">
              <div className={`h-full ${colors[i]} rounded-full transition-all duration-300 flex items-center justify-end pr-1 ${i === selectedCar ? 'ring-2 ring-yellow-400' : ''}`}
                style={{width: `${Math.max(5, positions[i])}%`}}>
                <span className="text-[10px]">🏎️</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {result && (
        <div className={`p-3 rounded-xl mb-3 ${result.won ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} font-bold`}>
          {result.won ? `TU CARRO GANO! +${result.prize?.toLocaleString()} (x5)` : `Gano ${names[result.game_data?.winner || 0]}. Perdiste!`}
        </div>
      )}
      <BetSelector bet={bet} setBet={setBet} />
      <button onClick={play} disabled={playing} className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-3 rounded-xl font-bold mt-2 disabled:opacity-50 active:scale-95">
        {playing ? 'Corriendo...' : `Apostar ${bet.toLocaleString()} a ${names[selectedCar]}`}
      </button>
    </div>
  );
};

const PoolGame = ({ userId, onResult, onClose }) => {
  const [bet, setBet] = useState(5000);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [playerBalls, setPlayerBalls] = useState(0);
  const [opponentBalls, setOpponentBalls] = useState(0);

  const play = async () => {
    setPlaying(true); setResult(null); setPlayerBalls(0); setOpponentBalls(0);
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: 'pool', bet });
      const gd = r.data.game_data || {};
      // Animate ball sinking
      for (let i = 0; i < Math.max(gd.player_sunk || 0, gd.opponent_sunk || 0); i++) {
        await new Promise(res => setTimeout(res, 400));
        if (i < (gd.player_sunk || 0)) setPlayerBalls(i + 1);
        if (i < (gd.opponent_sunk || 0)) setOpponentBalls(i + 1);
      }
      await new Promise(res => setTimeout(res, 500));
      setResult(r.data);
      onResult(r.data);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setPlaying(false);
  };

  const ballColors = ['🔴','🟡','🔵','🟢','🟠','🟣','⚫'];

  return (
    <div className="text-center">
      <div className="text-3xl mb-2">🎱</div>
      <h3 className="text-white font-bold mb-3">POOL - Billar</h3>
      <p className="text-white/40 text-[10px] mb-3">Embola mas bolas que tu oponente. x2 si ganas.</p>
      <div className="bg-gradient-to-br from-green-800/60 to-green-900/60 rounded-2xl p-4 mb-3 border-4 border-amber-800/50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-white/60 text-[10px] mb-2">TU</div>
            <div className="flex flex-wrap justify-center gap-1">
              {Array.from({length: 7}).map((_, i) => (
                <span key={i} className={`text-lg transition-all ${i < playerBalls ? 'opacity-100 scale-100' : 'opacity-20 scale-75'}`}>
                  {ballColors[i]}
                </span>
              ))}
            </div>
            <div className="text-yellow-400 font-bold text-lg mt-1">{playerBalls}/7</div>
          </div>
          <div>
            <div className="text-white/60 text-[10px] mb-2">RIVAL</div>
            <div className="flex flex-wrap justify-center gap-1">
              {Array.from({length: 7}).map((_, i) => (
                <span key={i} className={`text-lg transition-all ${i < opponentBalls ? 'opacity-100 scale-100' : 'opacity-20 scale-75'}`}>
                  {ballColors[i]}
                </span>
              ))}
            </div>
            <div className="text-red-400 font-bold text-lg mt-1">{opponentBalls}/7</div>
          </div>
        </div>
      </div>
      {result && (
        <div className={`p-3 rounded-xl mb-3 ${result.won ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} font-bold`}>
          {result.won ? `GANASTE! +${result.prize?.toLocaleString()} (x${result.multiplier})` : 'Perdiste!'}
        </div>
      )}
      <BetSelector bet={bet} setBet={setBet} />
      <button onClick={play} disabled={playing} className="w-full bg-gradient-to-r from-green-700 to-teal-700 text-white py-3 rounded-xl font-bold mt-2 disabled:opacity-50 active:scale-95">
        {playing ? 'Jugando...' : `Jugar ${bet.toLocaleString()}`}
      </button>
    </div>
  );
};

const DominoGame = ({ userId, onResult, onClose }) => {
  const [bet, setBet] = useState(5000);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [hand, setHand] = useState([]);
  const [revealed, setRevealed] = useState(0);

  const play = async () => {
    setPlaying(true); setResult(null); setHand([]); setRevealed(0);
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: 'domino', bet });
      const gd = r.data.game_data || {};
      const h = gd.hand || [];
      setHand(h);
      for (let i = 0; i < h.length; i++) {
        await new Promise(res => setTimeout(res, 250));
        setRevealed(i + 1);
      }
      await new Promise(res => setTimeout(res, 600));
      setResult(r.data);
      onResult(r.data);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setPlaying(false);
  };

  return (
    <div className="text-center">
      <div className="text-3xl mb-2">🁞</div>
      <h3 className="text-white font-bold mb-3">DOMINO Profesional</h3>
      <p className="text-white/40 text-[10px] mb-3">Menor puntaje gana. 7 fichas. x2 si ganas.</p>
      <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-4 mb-3 border border-white/10">
        <div className="flex flex-wrap justify-center gap-1 mb-3">
          {hand.map((tile, i) => (
            <div key={i} className={`bg-white text-black rounded-lg w-10 h-16 flex flex-col items-center justify-center text-sm font-bold border-2 border-gray-300 transition-all ${i < revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <span>{tile[0]}</span>
              <div className="w-6 h-0.5 bg-gray-400 my-0.5" />
              <span>{tile[1]}</span>
            </div>
          ))}
        </div>
        {result && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-white/60">Tu total:</span> <span className="text-yellow-400 font-bold">{result.game_data?.player_total}</span></div>
            <div><span className="text-white/60">Bot total:</span> <span className="text-red-400 font-bold">{result.game_data?.bot_total}</span></div>
          </div>
        )}
      </div>
      {result && (
        <div className={`p-3 rounded-xl mb-3 ${result.won ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} font-bold`}>
          {result.won ? `GANASTE! +${result.prize?.toLocaleString()} (x${result.multiplier})` : 'Perdiste! Tu puntaje fue mayor.'}
        </div>
      )}
      <BetSelector bet={bet} setBet={setBet} />
      <button onClick={play} disabled={playing} className="w-full bg-gradient-to-r from-amber-700 to-orange-700 text-white py-3 rounded-xl font-bold mt-2 disabled:opacity-50 active:scale-95">
        {playing ? 'Repartiendo...' : `Jugar ${bet.toLocaleString()}`}
      </button>
    </div>
  );
};

const MonsterGame = ({ userId, onResult, onClose }) => {
  const [bet, setBet] = useState(5000);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle, summoning, battle, done
  const monsters = {Dragon:'🐉', Fenix:'🦅', Kraken:'🐙', Golem:'🗿', Hidra:'🐍', Quimera:'🦁'};

  const play = async () => {
    setPlaying(true); setResult(null); setPhase('summoning');
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: userId, game: 'monster', bet });
      await new Promise(res => setTimeout(res, 1000));
      setPhase('battle');
      await new Promise(res => setTimeout(res, 1500));
      setPhase('done');
      setResult(r.data);
      onResult(r.data);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    setPlaying(false);
  };

  const pData = result?.game_data?.player || {};
  const eData = result?.game_data?.enemy || {};

  return (
    <div className="text-center">
      <div className="text-3xl mb-2">👹</div>
      <h3 className="text-white font-bold mb-3">MONSTER Battle</h3>
      <p className="text-white/40 text-[10px] mb-3">Invoca un monstruo. Mayor poder gana x2-x4</p>
      <div className="bg-gradient-to-br from-purple-900/50 to-red-900/50 rounded-2xl p-4 mb-3 border border-white/10">
        {phase === 'idle' && <div className="text-5xl py-6" style={{animation: 'pulse 2s infinite'}}>👹</div>}
        {phase === 'summoning' && (
          <div className="py-4">
            <div className="text-4xl" style={{animation: 'spin 1s linear infinite'}}>🌀</div>
            <div className="text-white/60 text-xs mt-2">Invocando monstruos...</div>
          </div>
        )}
        {(phase === 'battle' || phase === 'done') && result && (
          <div className="grid grid-cols-3 gap-2 items-center py-2">
            <div className="text-center">
              <div className="text-4xl">{monsters[pData.name] || '👹'}</div>
              <div className="text-white text-[10px] font-bold">{pData.name}</div>
              <div className="text-yellow-400 text-xs font-bold">⚡{pData.power}</div>
            </div>
            <div className="text-2xl text-red-400 font-black" style={{animation: phase === 'battle' ? 'pulse 0.5s infinite' : ''}}>VS</div>
            <div className="text-center">
              <div className="text-4xl">{monsters[eData.name] || '👹'}</div>
              <div className="text-white text-[10px] font-bold">{eData.name}</div>
              <div className="text-red-400 text-xs font-bold">⚡{eData.power}</div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
      {result && phase === 'done' && (
        <div className={`p-3 rounded-xl mb-3 ${result.won ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} font-bold`}>
          {result.won ? `${pData.name} GANA! +${result.prize?.toLocaleString()} (x${result.multiplier})` : `${eData.name} fue mas fuerte. Perdiste!`}
        </div>
      )}
      <BetSelector bet={bet} setBet={setBet} />
      <button onClick={play} disabled={playing} className="w-full bg-gradient-to-r from-purple-600 to-red-600 text-white py-3 rounded-xl font-bold mt-2 disabled:opacity-50 active:scale-95">
        {playing ? 'Invocando...' : `Invocar ${bet.toLocaleString()}`}
      </button>
    </div>
  );
};

// ========== SHARED COMPONENTS ==========

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

// ========== MAIN GAMES HUB ==========

const GAME_LIST = [
  { id: 'ludo', name: 'Ludo', emoji: '🎲', desc: 'Batalla dados', color: 'from-blue-600/40 to-purple-600/40', Component: LudoGame },
  { id: 'yacaro', name: 'Yacaro', emoji: '🎯', desc: 'Greedy dice', color: 'from-green-600/40 to-emerald-600/40', Component: YacaroGame },
  { id: 'carreras', name: 'Carreras', emoji: '🏎️', desc: 'Race betting', color: 'from-red-600/40 to-orange-600/40', Component: CarrerasGame },
  { id: 'pool', name: 'Pool', emoji: '🎱', desc: 'Billar', color: 'from-green-700/40 to-teal-700/40', Component: PoolGame },
  { id: 'domino', name: 'Domino', emoji: '🁞', desc: 'Profesional', color: 'from-amber-700/40 to-orange-700/40', Component: DominoGame },
  { id: 'monster', name: 'Monster', emoji: '👹', desc: 'Battle', color: 'from-purple-600/40 to-red-600/40', Component: MonsterGame },
];

const CLASSIC_GAMES = [
  { id: 'slots', name: 'Lucky 777', emoji: '🎰', cost: 1000, color: 'from-red-600/40 to-yellow-600/40' },
  { id: 'ruleta', name: 'Ruleta', emoji: '🎡', cost: 500, color: 'from-yellow-500/40 to-orange-600/40' },
  { id: 'dados', name: 'Dados', emoji: '🎲', cost: 500, color: 'from-red-500/40 to-pink-600/40' },
  { id: 'rps', name: 'PPT', emoji: '✊', cost: 500, color: 'from-green-500/40 to-emerald-600/40' },
  { id: 'trivia', name: 'Trivia', emoji: '❓', cost: 500, color: 'from-blue-500/40 to-indigo-600/40' },
  { id: 'carta', name: 'Carta', emoji: '🃏', cost: 500, color: 'from-purple-500/40 to-violet-600/40' },
];

const RoomGames = ({ userId, userCoins, onResult, onClose, onPlayClassic }) => {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame) {
    const game = GAME_LIST.find(g => g.id === activeGame);
    if (game) {
      const GameComponent = game.Component;
      return (
        <div>
          <button onClick={() => setActiveGame(null)} className="text-white/40 text-xs mb-2 hover:text-white">← Volver a juegos</button>
          <GameComponent userId={userId} onResult={onResult} onClose={() => setActiveGame(null)} />
        </div>
      );
    }
  }

  return (
    <div>
      <h4 className="text-yellow-400 text-xs font-bold mb-2">🎮 Juegos con Apuesta</h4>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {GAME_LIST.map(g => (
          <button key={g.id} data-testid={`game-${g.id}`} onClick={() => setActiveGame(g.id)}
            className={`bg-gradient-to-b ${g.color} border border-white/10 rounded-xl p-3 text-center active:scale-95 transition-all`}>
            <div className="text-2xl mb-1">{g.emoji}</div>
            <div className="text-white text-[10px] font-bold">{g.name}</div>
            <div className="text-white/40 text-[8px]">{g.desc}</div>
          </button>
        ))}
      </div>
      <h4 className="text-white/60 text-xs font-bold mb-2">Clasicos</h4>
      <div className="grid grid-cols-3 gap-2">
        {CLASSIC_GAMES.map(g => (
          <button key={g.id} data-testid={`classic-${g.id}`} onClick={() => onPlayClassic(g.id, g.cost)}
            className={`bg-gradient-to-b ${g.color} border border-white/10 rounded-xl p-2 text-center active:scale-95 transition-all`}>
            <div className="text-xl">{g.emoji}</div>
            <div className="text-white text-[9px] font-bold">{g.name}</div>
            <div className="text-yellow-300 text-[8px]">{g.cost.toLocaleString()}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RoomGames;
