import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useUser } from '../contexts/UserContext';
import { EntryAnimation, ProfileFrame } from '../components/Animations';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COFRE_COLORS = ['#b45309','#c2410c','#dc2626','#db2777','#9333ea','#4f46e5','#2563eb','#0891b2','#059669','#d97706'];

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
  const [panel, setPanel] = useState(null);
  const [giftTarget, setGiftTarget] = useState(null);
  const [gifts, setGifts] = useState({});
  const [sobres, setSobres] = useState([]);
  const [cofresData, setCofresData] = useState(null);
  const [botOn, setBotOn] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const autoMuteRef = useRef(null);
  const chatRef = useRef(null);
  const prevMsgCount = useRef(0);
  const photoRef = useRef(null);
  const musicRef = useRef(null);

  useEffect(() => {
    leaveAgora();
    loadRoom(); loadChat(); loadGifts(); loadSobres(); loadCofres(); checkBotActive();
    const r = setInterval(loadRoom, 3000);
    const c = setInterval(loadChat, 2000);
    const cf = setInterval(loadCofres, 5000);
    return () => { clearInterval(r); clearInterval(c); clearInterval(cf); leaveAgora(); };
  }, [roomId]);

  useEffect(() => {
    if (chatMessages.length > prevMsgCount.current && chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages]);

  const loadRoom = async () => {
    try { const r = await axios.get(`${API}/rooms/${roomId}`); setRoom(r.data); const s = r.data.seats.findIndex(s => s?.user_id === user.id); setMySeat(s >= 0 ? s : null); } catch (e) {}
  };
  const loadChat = async () => {
    try {
      // Ensure join record exists
      await axios.post(`${API}/rooms/${roomId}/mark-join?user_id=${user.id}`).catch(() => {});
      const r = await axios.get(`${API}/rooms/${roomId}/chat?limit=30&user_id=${user.id}`);
      setChatMessages(r.data);
    } catch (e) {}
  };
  const loadGifts = async () => { try { const r = await axios.get(`${API}/gifts`); setGifts(r.data); } catch (e) {} };
  const loadSobres = async () => { try { const r = await axios.get(`${API}/sobres`); setSobres(r.data); } catch (e) {} };
  const loadCofres = async () => { try { const r = await axios.get(`${API}/rooms/${roomId}/cofres`); setCofresData(r.data); } catch (e) {} };

  const checkBotActive = async () => {
    try {
      const r = await axios.get(`${API}/bot/active-rooms?admin_id=${user.id}`);
      const active = r.data.find(rm => rm.room_id === roomId && rm.active);
      setBotOn(!!active && !active.paused);
    } catch (e) {}
  };

  const toggleBot = async () => {
    try {
      if (botOn) {
        await axios.post(`${API}/bot/deactivate-room?admin_id=${user.id}&room_id=${roomId}`);
        setBotOn(false);
      } else {
        await axios.post(`${API}/bot/activate-room?admin_id=${user.id}&room_id=${roomId}`);
        setBotOn(true);
      }
      loadChat();
    } catch (e) { console.error(e); }
  };

  const joinAgora = async () => {
    try {
      setAudioStatus('connecting');
      const t = await axios.post(`${API}/agora/token?channel_name=room_${roomId}&user_id=${user.id}`);
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;
      client.on('user-published', async (u, m) => { if (m === 'audio') { await client.subscribe(u, 'audio'); u.audioTrack?.play(); } });
      await client.join(t.data.app_id, `room_${roomId}`, t.data.token, t.data.uid);
      // DON'T create mic track yet - only when user unmutes
      // This prevents the "recording" indicator on phone
      setAudioStatus('on'); setIsMuted(true);
      await axios.post(`${API}/rooms/${roomId}/welcome?user_id=${user.id}`);
      loadChat();
      try { const a = await axios.get(`${API}/users/${user.id}/entry-animation`); if (a.data.special) setEntryAnim({ animation: a.data.animation, username: user.username }); } catch (e) {}
    } catch (e) { setAudioStatus('error'); }
  };

  const leaveAgora = async () => {
    try { localTrackRef.current?.close(); localTrackRef.current = null; await clientRef.current?.leave(); clientRef.current = null; setAudioStatus('off'); clearTimeout(autoMuteRef.current); } catch (e) {}
  };

  const toggleMute = async () => {
    if (!clientRef.current) return;
    const newMuted = !isMuted;
    
    if (!newMuted) {
      // UNMUTING - create mic track if doesn't exist
      if (!localTrackRef.current) {
        try {
          const track = await AgoraRTC.createMicrophoneAudioTrack();
          localTrackRef.current = track;
          await clientRef.current.publish([track]);
        } catch (e) { console.error('Mic error:', e); return; }
      } else {
        localTrackRef.current.setEnabled(true);
      }
      setIsMuted(false);
      clearTimeout(autoMuteRef.current);
      autoMuteRef.current = setTimeout(() => {
        if (localTrackRef.current) {
          localTrackRef.current.setEnabled(false);
          setIsMuted(true);
        }
      }, 2 * 60 * 1000);
    } else {
      // MUTING - disable but don't destroy (keeps connection)
      if (localTrackRef.current) {
        localTrackRef.current.setEnabled(false);
      }
      setIsMuted(true);
      clearTimeout(autoMuteRef.current);
    }
  };
  const toggleDeafen = () => { clientRef.current?.remoteUsers?.forEach(u => { u.audioTrack && (isDeafened ? u.audioTrack.play() : u.audioTrack.stop()); }); setIsDeafened(!isDeafened); };
  const joinSeat = async (i) => { try { await axios.post(`${API}/rooms/${roomId}/join`, null, { params: { user_id: user.id, seat_index: i } }); await joinAgora(); loadRoom(); } catch (e) { alert(e.response?.data?.detail || 'Error'); } };
  const leaveSeat = async () => { try { await axios.post(`${API}/rooms/${roomId}/leave`, null, { params: { user_id: user.id } }); await leaveAgora(); setMySeat(null); loadRoom(); } catch (e) {} };
  const sendChat = async () => { if (!chatInput.trim()) return; try { await axios.post(`${API}/rooms/${roomId}/chat`, { user_id: user.id, text: chatInput }); setChatInput(''); loadChat(); } catch (e) {} };
  const sendPhoto = async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const fd = new FormData(); fd.append('file', f); await axios.post(`${API}/rooms/${roomId}/chat-photo?user_id=${user.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); loadChat(); } catch (e) { alert('Error'); } if (photoRef.current) photoRef.current.value = ''; };

  const uploadMusic = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const fd = new FormData();
      fd.append('file', f);
      await axios.post(`${API}/rooms/${roomId}/music?owner_id=${user.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadRoom();
    } catch (err) { alert(err.response?.data?.detail || 'Error al subir musica'); }
    if (musicRef.current) musicRef.current.value = '';
  };

  const sendGift = async (type) => {
    if (!giftTarget) return;
    try {
      const r = await axios.post(`${API}/gifts/send`, { sender_id: user.id, receiver_id: giftTarget.user_id, gift_type: type, room_id: roomId });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      setPanel(null); setGiftTarget(null); loadChat(); loadCofres();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const throwSobre = async (sobreId) => {
    try {
      const r = await axios.post(`${API}/sobres/throw`, { sender_id: user.id, room_id: roomId, sobre_id: sobreId });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      setPanel(null); loadChat(); loadCofres();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const tryOpenCofre = async () => {
    try {
      const r = await axios.post(`${API}/rooms/${roomId}/open-cofre`);
      if (r.data.opened) { loadChat(); loadCofres(); }
      else { alert(r.data.message || 'Aun no alcanza para abrir el cofre'); }
    } catch (e) { alert('Error'); }
  };

  const playMiniGame = async (gameId, cost) => {
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: user.id, game: gameId, bet: cost || 500 });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      const msg = r.data.won ? `🎉 Ganaste ${(r.data.prize || 0).toLocaleString()} monedas!` : '😔 Perdiste. Intenta de nuevo!';
      alert(msg);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  if (!room) return <div className="h-screen bg-gradient-to-b from-indigo-950 via-slate-900 to-gray-950 flex items-center justify-center"><div className="text-white">Cargando...</div></div>;

  // MINIMIZED VIEW - floating mini player
  if (minimized) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-40 bg-gray-900/95 backdrop-blur rounded-2xl p-3 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${audioStatus === 'on' ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-white text-sm font-bold truncate max-w-[120px]">{room.name}</span>
            <span className="text-white/40 text-xs">{room.active_users}👥</span>
          </div>
          <div className="flex items-center gap-2">
            {mySeat !== null && (
              <button onClick={toggleMute} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isMuted ? 'bg-red-500' : 'bg-green-500'}`}>{isMuted ? '🔇' : '🎤'}</button>
            )}
            <button data-testid="maximize-btn" onClick={() => setMinimized(false)} className="bg-cyan-500 text-white px-3 py-1 rounded-full text-xs font-bold">Abrir</button>
          </div>
        </div>
      </div>
    );
  }

  const opened = cofresData?.cofres_opened || 0;
  const progress = cofresData?.cofre_progress || 0;
  const thresholds = cofresData?.thresholds || [];
  const nextThreshold = opened < 10 ? thresholds[opened]?.threshold || 0 : 0;
  const accumulated = thresholds.slice(0, opened).reduce((a, c) => a + c.threshold, 0);
  const currentProgress = Math.max(0, progress - accumulated);
  const progressPct = nextThreshold > 0 ? Math.min(100, (currentProgress / nextThreshold) * 100) : 100;

  const bgStyle = room.background ? {
    backgroundImage: `url(${room.background.startsWith('/api') ? process.env.REACT_APP_BACKEND_URL + room.background : room.background})`,
    backgroundSize: 'cover', backgroundPosition: 'center'
  } : {};

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{background: 'linear-gradient(to bottom, #1e1b4b, #0f172a, #111827)', ...bgStyle}}>
      {entryAnim && <EntryAnimation animation={entryAnim.animation} username={entryAnim.username} onComplete={() => setEntryAnim(null)} />}

      {/* PANEL OVERLAY */}
      {panel && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-end" onClick={() => { setPanel(null); setGiftTarget(null); }}>
          <div className="w-full bg-gray-950 rounded-t-3xl p-4 max-h-[60vh] overflow-y-auto border-t border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <h3 className="text-white font-bold text-sm">{panel === 'gifts' ? `Regalos → ${giftTarget?.username}` : panel === 'gifts-all' ? 'Regalos' : panel === 'sobres' ? 'Lluvia de Oro' : panel === 'games' ? 'Juegos en Sala' : 'Cofres'}</h3>
              <button data-testid="close-panel" onClick={() => { setPanel(null); setGiftTarget(null); }} className="text-white/40">✕</button>
            </div>

            {panel === 'gifts' && giftTarget && (
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(gifts).filter(([k]) => !k.startsWith('sobre_')).map(([k, g]) => (
                  <button key={k} data-testid={`gift-${k}`} onClick={() => sendGift(k)} className="bg-white/5 rounded-xl p-2 text-center active:scale-95 transition-all border border-white/5">
                    <div className="text-xl">{g.emoji}</div>
                    <div className="text-white text-[8px]">{g.name}</div>
                    <div className="text-yellow-400 text-[8px]">{g.cost >= 1e6 ? `${(g.cost/1e6).toFixed(0)}M` : `${(g.cost/1e3).toFixed(0)}K`}</div>
                  </button>
                ))}
              </div>
            )}

            {panel === 'gifts-all' && (
              <>
                <p className="text-white/40 text-xs mb-2">Elige a quién enviar</p>
                <div className="flex gap-2 mb-3 overflow-x-auto">
                  {room.seats.filter(s => s && s.user_id !== user.id).map((s, i) => (
                    <button key={i} onClick={() => { setGiftTarget(s); setPanel('gifts'); }}
                      className="flex-shrink-0 bg-white/10 rounded-xl p-2 text-center hover:bg-white/20">
                      <img src={s.avatar} alt="" className="w-10 h-10 rounded-full mx-auto mb-1" />
                      <div className="text-white text-[9px]">{s.username}</div>
                    </button>
                  ))}
                </div>
                <p className="text-white/40 text-xs mb-2">Regalos</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {Object.entries(gifts).filter(([k]) => !k.startsWith('sobre_')).map(([k, g]) => (
                    <div key={k} className="bg-white/5 rounded-xl p-2 text-center border border-white/5">
                      <div className="text-xl">{g.emoji}</div>
                      <div className="text-white text-[8px]">{g.name}</div>
                      <div className="text-yellow-400 text-[8px]">{g.cost >= 1e6 ? `${(g.cost/1e6).toFixed(0)}M` : `${(g.cost/1e3).toFixed(0)}K`}</div>
                    </div>
                  ))}
                </div>
                <p className="text-white/40 text-xs mb-2">Sobres (Lluvia de Oro para todos)</p>
                <div className="grid grid-cols-4 gap-2">
                  {sobres.map(s => (
                    <button key={s.id} onClick={() => throwSobre(s.id)} className="bg-red-900/30 border border-red-500/20 rounded-xl p-2 text-center active:scale-95">
                      <div className="text-lg">{s.emoji}</div>
                      <div className="text-white text-[8px]">{s.name}</div>
                      <div className="text-red-300 text-[8px]">{s.amount >= 1e6 ? `${(s.amount/1e6).toFixed(0)}M` : `${(s.amount/1e3).toFixed(0)}K`}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {panel === 'sobres' && (
              <div className="grid grid-cols-4 gap-2">
                {sobres.map(s => (
                  <button key={s.id} data-testid={`sobre-${s.id}`} onClick={() => throwSobre(s.id)} className="bg-gradient-to-b from-red-900/50 to-red-950/50 border border-red-500/20 rounded-xl p-3 text-center active:scale-95 transition-all">
                    <div className="text-2xl">{s.emoji}</div>
                    <div className="text-white text-[9px] font-bold">{s.name}</div>
                    <div className="text-red-300 text-[8px]">{s.amount >= 1e6 ? `${(s.amount/1e6).toFixed(0)}M` : `${(s.amount/1e3).toFixed(0)}K`}</div>
                  </button>
                ))}
              </div>
            )}

            {panel === 'cofres' && (
              <div>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {thresholds.map((c, i) => (
                    <div key={i} className={`rounded-xl p-2 text-center border ${i < opened ? 'bg-yellow-500/20 border-yellow-500/40' : 'bg-white/5 border-white/10'}`}>
                      <div className="text-xl">{i < opened ? '✨' : '📦'}</div>
                      <div className="text-white text-[9px] font-bold">{c.label}</div>
                      <div className="text-white/40 text-[7px]">#{i + 1}</div>
                    </div>
                  ))}
                </div>
                {opened < 10 && (
                  <button data-testid="open-cofre-btn" onClick={tryOpenCofre} className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white py-3 rounded-xl font-bold active:scale-95">
                    Abrir Cofre #{opened + 1}
                  </button>
                )}
              </div>
            )}

            {panel === 'games' && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'slots', name: 'Lucky 777', emoji: '🎰', cost: 1000, color: 'from-red-600/40 to-yellow-600/40' },
                  { id: 'ruleta', name: 'Ruleta', emoji: '🎡', cost: 500, color: 'from-yellow-500/40 to-orange-600/40' },
                  { id: 'dados', name: 'Dados', emoji: '🎲', cost: 500, color: 'from-red-500/40 to-pink-600/40' },
                  { id: 'rps', name: 'PPT', emoji: '✊', cost: 500, color: 'from-green-500/40 to-emerald-600/40' },
                  { id: 'trivia', name: 'Trivia', emoji: '❓', cost: 500, color: 'from-blue-500/40 to-indigo-600/40' },
                  { id: 'carta', name: 'Carta Mayor', emoji: '🃏', cost: 500, color: 'from-purple-500/40 to-violet-600/40' },
                ].map(g => (
                  <button key={g.id} data-testid={`game-${g.id}`} onClick={() => playMiniGame(g.id, g.cost)}
                    className={`bg-gradient-to-b ${g.color} border border-white/10 rounded-xl p-3 text-center active:scale-95 transition-all`}>
                    <div className="text-3xl mb-1">{g.emoji}</div>
                    <div className="text-white text-xs font-bold">{g.name}</div>
                    <div className="text-yellow-300 text-[9px]">{g.cost.toLocaleString()} coins</div>
                  </button>
                ))}
              </div>
            )}

            <p className="text-yellow-400/50 text-[10px] text-center mt-2">Tus monedas: {(user.coins || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="flex items-center justify-between">
          <button data-testid="room-back-btn" onClick={() => { leaveAgora(); onBack(); }} className="bg-white/10 text-white px-3 py-1 rounded-full text-xs">← Salir</button>
          <div className="text-center flex-1 mx-1">
            <h2 className="text-white text-sm font-bold truncate">{room.name}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Minimize */}
            <button data-testid="minimize-btn" onClick={() => onBack()} className="bg-white/10 w-7 h-7 rounded-full flex items-center justify-center text-[10px]">⬇️</button>
            {/* Bot ON/OFF */}
            {user.role === 'dueño' && (
              <button data-testid="bot-toggle-room" onClick={toggleBot} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] ${botOn ? 'bg-green-500' : 'bg-gray-600'}`}>🤖</button>
            )}
            <span className={`w-2 h-2 rounded-full ${audioStatus === 'on' ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-white/50 text-xs">{room.active_users}</span>
          </div>
        </div>
      </div>

      {/* COFRE PROGRESS BAR */}
      {opened < 10 && (
        <div className="flex-shrink-0 px-3 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-yellow-400">📦 #{opened + 1}</span>
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: COFRE_COLORS[opened] || '#eab308' }} />
            </div>
            <span className="text-[10px] text-white/40">{thresholds[opened]?.label}</span>
          </div>
        </div>
      )}

      {/* ACTION BAR */}
      <div className="flex-shrink-0 px-3 mb-1">
        <div className="flex gap-1.5">
          <button data-testid="bar-cofres" onClick={() => setPanel('cofres')} className="bg-yellow-500/15 border border-yellow-500/20 rounded-full px-2.5 py-1 flex items-center gap-1">
            <span className="text-xs">📦</span><span className="text-yellow-300 text-[10px] font-bold">Cofres</span>
          </button>
          <button data-testid="bar-sobres" onClick={() => setPanel('sobres')} className="bg-red-500/15 border border-red-500/20 rounded-full px-2.5 py-1 flex items-center gap-1">
            <span className="text-xs">🧧</span><span className="text-red-300 text-[10px] font-bold">Sobres</span>
          </button>
          <button data-testid="bar-juegos" onClick={() => setPanel('games')} className="bg-green-500/15 border border-green-500/20 rounded-full px-2.5 py-1 flex items-center gap-1">
            <span className="text-xs">🎮</span><span className="text-green-300 text-[10px] font-bold">Juegos</span>
          </button>
          <div className="ml-auto bg-white/5 rounded-full px-2.5 py-1">
            <span className="text-yellow-400 text-[10px] font-bold">💰 {user.coins >= 1e6 ? `${(user.coins/1e6).toFixed(1)}M` : (user.coins || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* SEATS */}
      <div className="flex-shrink-0 px-3 mb-1 overflow-y-auto" style={{maxHeight: '32vh'}}>
        <div className="grid grid-cols-3 gap-1.5">
          {room.seats.map((seat, i) => (
            <button key={i} data-testid={`seat-btn-${i}`}
              onClick={() => { if (seat?.user_id === user.id) leaveSeat(); else if (seat) openGiftPanel(seat); else joinSeat(i); }}
              className={`relative h-[72px] rounded-2xl border transition-all ${seat ? seat.user_id === user.id ? 'bg-green-500/10 border-green-500/30' : 'bg-white/[0.03] border-white/[0.08]' : 'bg-white/[0.02] border-white/[0.05]'}`}>
              <div className="flex flex-col items-center justify-center h-full">
                {seat ? (
                  <>
                    <ProfileFrame aristocracy={seat.aristocracy || 0}>
                      <img src={seat.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    </ProfileFrame>
                    <span className="text-white text-[9px] mt-0.5 truncate w-full text-center px-1">{seat.username}</span>
                    {seat.user_id !== user.id && <div className="absolute bottom-1 right-1 text-[8px]">🎁</div>}
                    {seat.user_id === user.id && <div className={`absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${isMuted ? 'bg-red-500' : 'bg-green-500'}`}>{isMuted ? '🔇' : '🎤'}</div>}
                  </>
                ) : (
                  <div className="text-white/10 text-[10px]">{i + 1}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CHAT */}
      <div className="flex-1 min-h-0 px-3 pb-1">
        <div className="h-full flex flex-col">
          <div ref={chatRef} className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1">
            {chatMessages.map(m => (
              <div key={m.id} className={m.type === 'welcome' || m.type === 'gift' ? 'text-center' : ''}>
                {m.type === 'welcome' ? (
                  <span className="bg-yellow-500/10 text-yellow-300/70 text-[9px] px-2 py-0.5 rounded-full">{m.text}</span>
                ) : m.type === 'gift' ? (
                  <span className="bg-pink-500/10 text-pink-300/80 text-[9px] px-2 py-0.5 rounded-full">{m.text}</span>
                ) : m.type === 'photo' ? (
                  <div className="flex items-start gap-1">
                    <img src={m.avatar || ''} alt="" className="w-4 h-4 rounded-full mt-0.5" />
                    <div>
                      <span className="text-pink-400 text-[9px] font-bold">{m.username}</span>
                      <img src={m.image_url?.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${m.image_url}` : m.image_url} alt=""
                        onClick={e => { e.target.style.maxWidth = e.target.style.maxWidth === '300px' ? '150px' : '300px'; }}
                        className="mt-0.5 max-w-[150px] rounded-lg object-cover cursor-pointer transition-all" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <img src={m.avatar || ''} alt="" className="w-4 h-4 rounded-full mt-0.5" />
                    <div><span className="text-cyan-400 text-[9px] font-bold">{m.username}: </span><span className="text-white/60 text-[9px]">{m.text}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-1 flex-shrink-0 mt-1">
            <button onClick={() => photoRef.current?.click()} className="bg-white/5 w-7 h-7 rounded-full flex items-center justify-center text-[10px]">📷</button>
            <input ref={photoRef} type="file" accept="image/*" onChange={sendPhoto} className="hidden" />
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Mensaje..." data-testid="chat-input" className="flex-1 bg-white/5 text-white placeholder-white/20 border-0 rounded-full px-3 py-1.5 text-[10px] outline-none" />
            <button data-testid="chat-send-btn" onClick={sendChat} className="bg-cyan-500 text-white px-2.5 py-1.5 rounded-full text-[10px] font-bold">Enviar</button>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR - ALWAYS VISIBLE */}
      <div className="flex-shrink-0 bg-black/90 border-t border-white/5 px-2 py-2">
        <div className="flex items-center justify-center gap-2">
          {/* Gift */}
          <button data-testid="gift-bottom-btn" onClick={() => setPanel('gifts-all')}
            className="w-11 h-11 rounded-full bg-pink-500 flex items-center justify-center text-lg active:scale-90 shadow-lg shadow-pink-500/30">🎁</button>

          {/* Music */}
          <button data-testid="music-btn" onClick={() => musicRef.current?.click()}
            className="w-9 h-9 rounded-full bg-purple-600/80 flex items-center justify-center text-sm active:scale-90">🎵</button>
          <input ref={musicRef} type="file" accept="audio/*" onChange={uploadMusic} className="hidden" />

          {/* Mic - always visible */}
          <button data-testid="toggle-mute-btn" onClick={mySeat !== null ? toggleMute : () => {}}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl active:scale-90 shadow-lg ${
              mySeat === null ? 'bg-gray-700 opacity-50' : isMuted ? 'bg-red-500 shadow-red-500/30' : 'bg-green-500 shadow-green-500/30'
            }`}>{mySeat === null ? '🎤' : isMuted ? '🔇' : '🎤'}</button>

          {/* Speaker */}
          <button data-testid="toggle-deafen-btn" onClick={mySeat !== null ? toggleDeafen : () => {}}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm active:scale-90 ${
              mySeat === null ? 'bg-gray-700 opacity-50' : isDeafened ? 'bg-orange-500' : 'bg-blue-500'
            }`}>{isDeafened ? '🔕' : '🔊'}</button>

          {/* Leave seat */}
          {mySeat !== null && (
            <button data-testid="leave-seat-btn" onClick={leaveSeat}
              className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center text-sm active:scale-90">🚪</button>
          )}

          {/* Bot ON/OFF - only for dueño */}
          {user.role === 'dueño' && (
            <button data-testid="bot-toggle-bottom" onClick={toggleBot}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm active:scale-90 border-2 ${botOn ? 'bg-green-500 border-green-400' : 'bg-gray-700 border-gray-600'}`}>🤖</button>
          )}
        </div>
        {room.music_url && (
          <audio src={room.music_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${room.music_url}` : room.music_url} autoPlay loop className="hidden" />
        )}
      </div>
    </div>
  );

  function openGiftPanel(seat) {
    setGiftTarget(seat);
    setPanel('gifts');
  }
};

export default RoomView;
