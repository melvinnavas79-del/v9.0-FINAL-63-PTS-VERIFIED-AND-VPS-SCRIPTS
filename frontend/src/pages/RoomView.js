import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useUser } from '../contexts/UserContext';
import { EntryAnimation, ProfileFrame } from '../components/Animations';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GIFT_ENVELOPES = [
  { id: 'sobre_10k', name: 'Sobre 10K', emoji: '💌', cost: 10000 },
  { id: 'sobre_50k', name: 'Sobre 50K', emoji: '💝', cost: 50000 },
  { id: 'sobre_100k', name: 'Sobre 100K', emoji: '🎁', cost: 100000 },
  { id: 'sobre_500k', name: 'Sobre 500K', emoji: '🎀', cost: 500000 },
  { id: 'sobre_1m', name: 'Sobre 1M', emoji: '🧧', cost: 1000000 },
  { id: 'sobre_5m', name: 'Sobre 5M', emoji: '💰', cost: 5000000 },
  { id: 'sobre_10m', name: 'Sobre 10M', emoji: '💎', cost: 10000000 },
];

const COFRES = [
  { id: 1, cost: 300000, label: '300K', color: 'from-yellow-600 to-yellow-800' },
  { id: 2, cost: 500000, label: '500K', color: 'from-orange-500 to-orange-700' },
  { id: 3, cost: 1000000, label: '1M', color: 'from-red-500 to-red-700' },
  { id: 4, cost: 2500000, label: '2.5M', color: 'from-pink-500 to-pink-700' },
  { id: 5, cost: 5000000, label: '5M', color: 'from-purple-500 to-purple-700' },
  { id: 6, cost: 7000000, label: '7M', color: 'from-indigo-500 to-indigo-700' },
  { id: 7, cost: 10000000, label: '10M', color: 'from-blue-500 to-blue-700' },
  { id: 8, cost: 15000000, label: '15M', color: 'from-cyan-500 to-cyan-700' },
  { id: 9, cost: 20000000, label: '20M', color: 'from-emerald-400 to-emerald-600' },
  { id: 10, cost: 20000000, label: '20M', color: 'from-yellow-400 to-amber-500' },
];

const MINI_GAMES = [
  { id: 'ruleta', name: 'Ruleta', emoji: '🎡' },
  { id: 'dados', name: 'Dados', emoji: '🎲' },
  { id: 'rps', name: 'PPT', emoji: '✊' },
];

const RoomView = ({ roomId, onBack }) => {
  const { user, updateUser } = useUser();
  const [room, setRoom] = useState(null);
  const [mySeat, setMySeat] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [audioStatus, setAudioStatus] = useState('off');
  const [entryAnim, setEntryAnim] = useState(null);
  const [activePanel, setActivePanel] = useState(null); // 'gifts' | 'cofres' | 'games' | null
  const [giftTarget, setGiftTarget] = useState(null);
  const [gifts, setGifts] = useState({});
  const [cofreOpening, setCofreOpening] = useState(null);
  const [cofreResult, setCofreResult] = useState(null);
  const [gameResult, setGameResult] = useState(null);

  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const autoMuteTimer = useRef(null);
  const chatContainerRef = useRef(null);
  const prevMsgCount = useRef(0);
  const photoInputRef = useRef(null);

  useEffect(() => {
    // Clean up any previous Agora connection on mount
    leaveAgora();
    loadRoom();
    loadChat();
    loadGifts();
    const r = setInterval(loadRoom, 3000);
    const c = setInterval(loadChat, 2000);
    return () => { clearInterval(r); clearInterval(c); leaveAgora(); };
  }, [roomId]);

  useEffect(() => {
    if (chatMessages.length > prevMsgCount.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages]);

  const loadRoom = async () => {
    try {
      const res = await axios.get(`${API}/rooms/${roomId}`);
      setRoom(res.data);
      const s = res.data.seats.findIndex(s => s && s.user_id === user.id);
      setMySeat(s >= 0 ? s : null);
    } catch (err) { console.error(err); }
  };

  const loadChat = async () => {
    try {
      const res = await axios.get(`${API}/rooms/${roomId}/chat?limit=30`);
      setChatMessages(res.data);
    } catch (err) { console.error(err); }
  };

  const loadGifts = async () => {
    try { const res = await axios.get(`${API}/gifts`); setGifts(res.data); } catch (err) {}
  };

  const joinAgora = async () => {
    try {
      setAudioStatus('connecting');
      const tokenRes = await axios.post(`${API}/agora/token?channel_name=room_${roomId}&user_id=${user.id}`);
      const { token, uid, app_id } = tokenRes.data;
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;
      client.on('user-published', async (remoteUser, mediaType) => {
        if (mediaType === 'audio') {
          await client.subscribe(remoteUser, 'audio');
          remoteUser.audioTrack?.play();
        }
      });
      await client.join(app_id, `room_${roomId}`, token, uid);
      const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localTrack;
      // Start muted by default
      localTrack.setEnabled(false);
      await client.publish([localTrack]);
      setAudioStatus('on');
      setIsMuted(true);
      await axios.post(`${API}/rooms/${roomId}/welcome?user_id=${user.id}`);
      loadChat();
      try {
        const animRes = await axios.get(`${API}/users/${user.id}/entry-animation`);
        if (animRes.data.special) setEntryAnim({ animation: animRes.data.animation, username: user.username });
      } catch (e) {}
      startAutoMuteTimer();
    } catch (err) {
      console.error('Agora error:', err);
      setAudioStatus('error');
    }
  };

  const leaveAgora = async () => {
    try {
      if (localTrackRef.current) { localTrackRef.current.close(); localTrackRef.current = null; }
      if (clientRef.current) { await clientRef.current.leave(); clientRef.current = null; }
      setAudioStatus('off');
      clearTimeout(autoMuteTimer.current);
    } catch (e) {}
  };

  const toggleMute = () => {
    if (localTrackRef.current) {
      const newMuted = !isMuted;
      localTrackRef.current.setEnabled(!newMuted);
      setIsMuted(newMuted);
      if (!newMuted) clearTimeout(autoMuteTimer.current);
      else startAutoMuteTimer();
    }
  };

  const toggleDeafen = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    remoteUsers.forEach(u => {
      if (u.audioTrack) { isDeafened ? u.audioTrack.play() : u.audioTrack.stop(); }
    });
    setIsDeafened(!isDeafened);
  };

  const startAutoMuteTimer = () => {
    clearTimeout(autoMuteTimer.current);
    autoMuteTimer.current = setTimeout(() => { if (mySeat !== null) leaveSeat(); }, 5 * 60 * 1000);
  };

  const joinSeat = async (index) => {
    try {
      await axios.post(`${API}/rooms/${roomId}/join`, null, { params: { user_id: user.id, seat_index: index } });
      await joinAgora();
      loadRoom();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const leaveSeat = async () => {
    try {
      await axios.post(`${API}/rooms/${roomId}/leave`, null, { params: { user_id: user.id } });
      await leaveAgora();
      setMySeat(null);
      loadRoom();
    } catch (err) {}
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    try {
      await axios.post(`${API}/rooms/${roomId}/chat`, { user_id: user.id, text: chatInput });
      setChatInput('');
      loadChat();
    } catch (err) {}
  };

  const sendPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/rooms/${roomId}/chat-photo?user_id=${user.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadChat();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const sendGift = async (giftType) => {
    if (!giftTarget) return;
    try {
      const res = await axios.post(`${API}/gifts/send`, { sender_id: user.id, receiver_id: giftTarget.user_id, gift_type: giftType, room_id: roomId });
      if (res.data.new_balance !== undefined) updateUser({ coins: res.data.new_balance });
      setActivePanel(null); setGiftTarget(null); loadChat();
    } catch (err) { alert(err.response?.data?.detail || 'Monedas insuficientes'); }
  };

  const sendEnvelope = async (envelope) => {
    if (!giftTarget) return;
    if ((user.coins || 0) < envelope.cost) { alert('Monedas insuficientes'); return; }
    try {
      const res = await axios.post(`${API}/gifts/send`, { sender_id: user.id, receiver_id: giftTarget.user_id, gift_type: envelope.id, room_id: roomId });
      if (res.data.new_balance !== undefined) updateUser({ coins: res.data.new_balance });
      setActivePanel(null); setGiftTarget(null); loadChat();
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const openCofre = async (cofre) => {
    if ((user.coins || 0) < cofre.cost) { alert('Monedas insuficientes'); return; }
    setCofreOpening(cofre.id);
    setCofreResult(null);
    try {
      const res = await axios.post(`${API}/games/play`, { user_id: user.id, game: 'cofre', bet: cofre.cost });
      setTimeout(() => {
        setCofreOpening(null);
        setCofreResult({ cofre: cofre.id, won: res.data.won, prize: res.data.prize, newBalance: res.data.new_balance });
        if (res.data.new_balance !== undefined) updateUser({ coins: res.data.new_balance });
      }, 1500);
    } catch (err) {
      setCofreOpening(null);
      alert(err.response?.data?.detail || 'Error');
    }
  };

  const playMiniGame = async (gameId) => {
    try {
      const res = await axios.post(`${API}/games/play`, { user_id: user.id, game: gameId, bet: 500 });
      setGameResult({ game: gameId, ...res.data });
      if (res.data.new_balance !== undefined) updateUser({ coins: res.data.new_balance });
      setTimeout(() => setGameResult(null), 3000);
    } catch (err) { alert(err.response?.data?.detail || 'Error'); }
  };

  const openGiftPanel = (seat) => {
    if (seat && seat.user_id !== user.id) {
      setGiftTarget(seat);
      setActivePanel('gifts');
    }
  };

  if (!room) return (
    <div className="h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="text-white text-lg">Cargando sala...</div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 overflow-hidden relative">
      {entryAnim && <EntryAnimation animation={entryAnim.animation} username={entryAnim.username} onComplete={() => setEntryAnim(null)} />}

      {/* ===== OVERLAY PANELS ===== */}
      {activePanel && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-end" onClick={() => { setActivePanel(null); setGiftTarget(null); }}>
          <div className="w-full bg-gray-900 rounded-t-3xl p-4 max-h-[65vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">
                {activePanel === 'gifts' && giftTarget ? `Regalos para ${giftTarget.username}` : activePanel === 'cofres' ? 'Cofres del Tesoro' : activePanel === 'games' ? 'Juegos' : ''}
              </h3>
              <button data-testid="close-panel-btn" onClick={() => { setActivePanel(null); setGiftTarget(null); }} className="text-white/50 text-xl">✕</button>
            </div>

            {/* GIFTS + ENVELOPES */}
            {activePanel === 'gifts' && giftTarget && (
              <>
                <p className="text-white/40 text-xs mb-2">Regalos</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {Object.entries(gifts).map(([key, g]) => (
                    <button key={key} data-testid={`gift-btn-${key}`} onClick={() => sendGift(key)}
                      className="bg-white/5 rounded-xl p-2 text-center hover:bg-white/15 active:scale-95 transition-all">
                      <div className="text-xl">{g.emoji}</div>
                      <div className="text-white text-[9px]">{g.name}</div>
                      <div className="text-yellow-400 text-[9px]">{g.cost >= 1000000 ? `${(g.cost/1000000).toFixed(0)}M` : `${(g.cost/1000).toFixed(0)}K`}</div>
                    </button>
                  ))}
                </div>
                <p className="text-white/40 text-xs mb-2">Sobres de Regalo</p>
                <div className="grid grid-cols-4 gap-2">
                  {GIFT_ENVELOPES.map(env => (
                    <button key={env.id} data-testid={`envelope-${env.id}`} onClick={() => sendEnvelope(env)}
                      className="bg-gradient-to-b from-red-500/20 to-red-700/20 border border-red-500/30 rounded-xl p-2 text-center hover:border-red-400 active:scale-95 transition-all">
                      <div className="text-xl">{env.emoji}</div>
                      <div className="text-white text-[9px]">{env.name}</div>
                      <div className="text-red-300 text-[9px]">{env.cost >= 1000000 ? `${(env.cost/1000000).toFixed(0)}M` : `${(env.cost/1000).toFixed(0)}K`}</div>
                    </button>
                  ))}
                </div>
                <p className="text-yellow-400/60 text-[10px] text-center mt-3">Tus monedas: {(user.coins || 0).toLocaleString()}</p>
              </>
            )}

            {/* COFRES */}
            {activePanel === 'cofres' && (
              <>
                {cofreResult && (
                  <div className={`text-center p-4 rounded-xl mb-3 ${cofreResult.won ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-red-500/20 border border-red-500/40'}`}>
                    <div className="text-3xl mb-1">{cofreResult.won ? '🏆' : '💨'}</div>
                    <div className={`font-bold ${cofreResult.won ? 'text-yellow-300' : 'text-red-300'}`}>
                      {cofreResult.won ? `Ganaste ${(cofreResult.prize || 0).toLocaleString()} monedas!` : 'Vacio! Intenta de nuevo'}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-5 gap-2">
                  {COFRES.map(c => (
                    <button key={c.id} data-testid={`cofre-${c.id}`} onClick={() => openCofre(c)}
                      disabled={cofreOpening !== null}
                      className={`bg-gradient-to-b ${c.color} rounded-xl p-2 text-center hover:scale-105 active:scale-95 transition-all border border-white/10 ${cofreOpening === c.id ? 'animate-bounce' : ''}`}>
                      <div className="text-2xl">{cofreOpening === c.id ? '✨' : '📦'}</div>
                      <div className="text-white text-[10px] font-bold">{c.label}</div>
                      <div className="text-white/60 text-[8px]">#{c.id}</div>
                    </button>
                  ))}
                </div>
                <p className="text-yellow-400/60 text-[10px] text-center mt-3">Tus monedas: {(user.coins || 0).toLocaleString()}</p>
              </>
            )}

            {/* MINI GAMES */}
            {activePanel === 'games' && (
              <>
                {gameResult && (
                  <div className={`text-center p-3 rounded-xl mb-3 ${gameResult.won ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <span className={`font-bold text-sm ${gameResult.won ? 'text-green-300' : 'text-red-300'}`}>
                      {gameResult.won ? `Ganaste ${(gameResult.prize || 0).toLocaleString()}!` : 'Perdiste! Intenta otra vez'}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {MINI_GAMES.map(g => (
                    <button key={g.id} data-testid={`game-${g.id}`} onClick={() => playMiniGame(g.id)}
                      className="bg-white/10 rounded-xl p-4 text-center hover:bg-white/20 active:scale-95 transition-all">
                      <div className="text-3xl mb-1">{g.emoji}</div>
                      <div className="text-white text-xs font-bold">{g.name}</div>
                      <div className="text-white/40 text-[10px]">500 coins</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="flex-shrink-0 p-2">
        <div className="flex items-center justify-between bg-white/5 backdrop-blur border border-white/10 rounded-2xl px-3 py-2">
          <button data-testid="room-back-btn" onClick={() => { leaveAgora(); onBack(); }} className="bg-pink-500/80 text-white px-3 py-1.5 rounded-full text-xs font-bold">← Salir</button>
          <div className="text-center flex-1 mx-2">
            <h2 className="text-sm font-bold text-white truncate">{room.name}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] ${audioStatus === 'on' ? 'text-green-400' : 'text-red-400'}`}>
              {audioStatus === 'on' ? '🟢' : '🔴'}
            </span>
            <span className="text-white/50 text-[10px]">{room.active_users}👥</span>
          </div>
        </div>
      </div>

      {/* ===== FEATURE BAR ===== */}
      <div className="flex-shrink-0 px-2 mb-1">
        <div className="flex gap-1.5 overflow-x-auto">
          <button data-testid="panel-cofres-btn" onClick={() => setActivePanel('cofres')} className="flex-shrink-0 bg-gradient-to-r from-yellow-600/40 to-amber-600/40 border border-yellow-500/30 rounded-full px-3 py-1.5 flex items-center gap-1">
            <span className="text-sm">📦</span><span className="text-white text-[10px] font-bold">Cofres</span>
          </button>
          <button data-testid="panel-games-btn" onClick={() => setActivePanel('games')} className="flex-shrink-0 bg-gradient-to-r from-green-600/40 to-emerald-600/40 border border-green-500/30 rounded-full px-3 py-1.5 flex items-center gap-1">
            <span className="text-sm">🎮</span><span className="text-white text-[10px] font-bold">Juegos</span>
          </button>
          <button data-testid="panel-gifts-global-btn" onClick={() => { setGiftTarget(null); setActivePanel('cofres'); }} className="flex-shrink-0 bg-gradient-to-r from-red-600/40 to-rose-600/40 border border-red-500/30 rounded-full px-3 py-1.5 flex items-center gap-1">
            <span className="text-sm">🧧</span><span className="text-white text-[10px] font-bold">Sobres</span>
          </button>
          <div className="flex-shrink-0 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-1">
            <span className="text-yellow-400 text-[10px] font-bold">💰 {(user.coins || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ===== SEATS ===== */}
      <div className="flex-shrink-0 px-2 mb-1 overflow-y-auto" style={{maxHeight: '35vh'}}>
        <div className="bg-white/3 backdrop-blur border border-white/5 rounded-2xl p-2">
          <div className="grid grid-cols-3 gap-1.5">
            {room.seats.map((seat, index) => (
              <button key={index} data-testid={`seat-btn-${index}`}
                onClick={() => {
                  if (seat && seat.user_id === user.id) leaveSeat();
                  else if (seat && seat.user_id !== user.id) openGiftPanel(seat);
                  else joinSeat(index);
                }}
                className={`relative w-full h-20 rounded-xl border transition-all ${
                  seat ? seat.user_id === user.id
                    ? 'bg-green-500/15 border-green-500/40'
                    : 'bg-white/5 border-white/10 hover:border-pink-400/40'
                  : 'bg-white/3 border-white/5 hover:border-cyan-400/30'
                }`}>
                <div className="flex flex-col items-center justify-center h-full">
                  {seat ? (
                    <>
                      <ProfileFrame aristocracy={seat.aristocracy || 0}>
                        <img src={seat.avatar} alt="" className="w-9 h-9 rounded-full" />
                      </ProfileFrame>
                      <span className="text-white text-[10px] font-medium mt-0.5 truncate w-full text-center px-1">{seat.username}</span>
                      {seat.user_id !== user.id && (
                        <div className="absolute bottom-0.5 right-0.5 bg-pink-500 rounded-full w-4 h-4 flex items-center justify-center text-[8px]">🎁</div>
                      )}
                      {seat.user_id === user.id && (
                        <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${isMuted ? 'bg-red-500' : 'bg-green-500'}`}>
                          {isMuted ? '🔇' : '🎤'}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-lg opacity-30">🪑</div>
                      <span className="text-white/20 text-[10px]">{index + 1}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== CHAT ===== */}
      <div className="flex-1 min-h-0 px-2 pb-1">
        <div className="bg-white/3 backdrop-blur border border-white/5 rounded-2xl p-2 h-full flex flex-col">
          <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
            {chatMessages.map(msg => (
              <div key={msg.id} className={msg.type === 'welcome' ? 'text-center' : 'flex items-start gap-1'}>
                {msg.type === 'welcome' ? (
                  <span className="bg-yellow-500/10 text-yellow-300/80 text-[10px] px-2 py-0.5 rounded-full">{msg.text}</span>
                ) : msg.type === 'gift' ? (
                  <span className="bg-pink-500/10 text-pink-300 text-[10px] px-2 py-0.5 rounded-full">{msg.text}</span>
                ) : msg.type === 'photo' ? (
                  <div className="flex items-start gap-1">
                    <img src={msg.avatar} alt="" className="w-4 h-4 rounded-full mt-0.5" />
                    <div>
                      <span className="text-pink-400 text-[10px] font-bold">{msg.username}</span>
                      <img src={msg.image_url?.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${msg.image_url}` : msg.image_url} alt="" className="mt-0.5 max-w-[120px] max-h-[80px] rounded-lg object-cover" />
                    </div>
                  </div>
                ) : (
                  <>
                    <img src={msg.avatar || ''} alt="" className="w-4 h-4 rounded-full mt-0.5" />
                    <div><span className="text-pink-400 text-[10px] font-bold">{msg.username}: </span><span className="text-white/70 text-[10px]">{msg.text}</span></div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-1 flex-shrink-0 mt-1">
            <button data-testid="chat-photo-btn" onClick={() => photoInputRef.current?.click()} className="bg-white/10 text-white w-7 h-7 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">📷</button>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={sendPhoto} className="hidden" />
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Mensaje..."
              data-testid="chat-input"
              className="flex-1 bg-white/5 text-white placeholder-white/20 border border-white/10 rounded-full px-3 py-1.5 text-[10px] outline-none" />
            <button data-testid="chat-send-btn" onClick={sendChat} className="bg-cyan-500/80 text-white px-2.5 py-1.5 rounded-full text-[10px] font-bold">Enviar</button>
          </div>
        </div>
      </div>

      {/* ===== AUDIO CONTROLS ===== */}
      {mySeat !== null && (
        <div className="flex-shrink-0 bg-black/90 backdrop-blur-xl px-3 pb-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-center gap-4">
            <button data-testid="toggle-mute-btn" onClick={toggleMute}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform ${isMuted ? 'bg-red-500' : 'bg-green-500'}`}>
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button data-testid="toggle-deafen-btn" onClick={toggleDeafen}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform ${isDeafened ? 'bg-orange-500' : 'bg-blue-500'}`}>
              {isDeafened ? '🔕' : '🔊'}
            </button>
            <button data-testid="leave-seat-btn" onClick={leaveSeat}
              className="w-11 h-11 rounded-full bg-red-600 shadow-lg flex items-center justify-center text-lg active:scale-95 transition-transform">
              🚪
            </button>
            <div className="text-white/50 text-[10px] text-center ml-1">
              <div>{isMuted ? 'Mute' : 'Mic ON'}</div>
              <div>{isDeafened ? 'Mute sala' : 'Escuchando'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomView;
