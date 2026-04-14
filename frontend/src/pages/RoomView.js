import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useUser } from '../contexts/UserContext';
import { EntryAnimation, ProfileFrame } from '../components/Animations';
import RoomGames from '../components/RoomGames';

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
    loadRoom(); loadChat(); loadGifts(); loadSobres(); loadCofres(); checkBotActive(); loadMyEvents(); loadPendingRequests(); loadPK();
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

  const [gameResult, setGameResult] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);
  const [eventPanel, setEventPanel] = useState(false);
  const [myEvents, setMyEvents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pkBattle, setPkBattle] = useState(null);

  const playMiniGame = async (gameId, cost) => {
    setGameResult(null);
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: user.id, game: gameId, bet: cost || 500 });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      setGameResult(r.data);
      setTimeout(() => setGameResult(null), 4000);
    } catch (e) {
      setGameResult({ won: false, error: e.response?.data?.detail || 'Error' });
      setTimeout(() => setGameResult(null), 3000);
    }
  };

  const loadMyEvents = async () => {
    try { const r = await axios.get(`${API}/events/my-events/${user.id}`); setMyEvents(r.data); } catch (e) {}
  };
  const loadPendingRequests = async () => {
    if (user.role !== 'dueño') return;
    try { const r = await axios.get(`${API}/events/requests?admin_id=${user.id}&status=pending`); setPendingRequests(r.data); } catch (e) {}
  };

  const requestEvent = async (eventType) => {
    try {
      await axios.post(`${API}/events/request`, { user_id: user.id, event_type: eventType });
      alert('Solicitud enviada! Espera la aprobacion del administrador.');
      loadMyEvents();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const approveRequest = async (reqId) => {
    try {
      await axios.post(`${API}/events/approve/${reqId}?admin_id=${user.id}`);
      alert('Evento aprobado!');
      loadPendingRequests();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const rejectRequest = async (reqId) => {
    try {
      await axios.post(`${API}/events/reject/${reqId}?admin_id=${user.id}`);
      alert('Evento rechazado.');
      loadPendingRequests();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const startPK = async (opponentSeat) => {
    const betStr = prompt('Apuesta para PK Battle (monedas):');
    if (!betStr) return;
    const betAmt = parseInt(betStr);
    if (isNaN(betAmt) || betAmt < 1000) return alert('Minimo 1000 monedas');
    try {
      const r = await axios.post(`${API}/games/pk-battle`, {
        room_id: roomId, challenger_id: user.id,
        opponent_id: opponentSeat.user_id, bet_amount: betAmt
      });
      setPkBattle(r.data.battle);
      loadChat();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const endPK = async () => {
    if (!pkBattle) return;
    try {
      const r = await axios.post(`${API}/games/pk-battle/${pkBattle.id}/end`);
      alert(r.data.result === 'tie' ? 'Empate! Se devolvieron las apuestas.' : `${r.data.winner} gana +${r.data.prize?.toLocaleString()}`);
      setPkBattle(null);
      loadChat();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const loadPK = async () => {
    try {
      const r = await axios.get(`${API}/games/pk-battle/${roomId}`);
      if (r.data) setPkBattle(r.data);
    } catch (e) {}
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

      {/* PHOTO ZOOM MODAL */}
      {zoomImg && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setZoomImg(null)}>
          <button className="absolute top-4 right-4 text-white text-2xl" onClick={() => setZoomImg(null)}>✕</button>
          <img src={zoomImg} alt="" className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg" />
        </div>
      )}

      {/* EVENTS PANEL - Request based */}
      {eventPanel && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-end" onClick={() => setEventPanel(false)}>
          <div className="w-full bg-gray-950 rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto border-t border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <h3 className="text-white font-bold text-sm">Eventos</h3>
              <button onClick={() => setEventPanel(false)} className="text-white/40">✕</button>
            </div>

            {/* ADMIN: Pending Requests */}
            {user.role === 'dueño' && pendingRequests.length > 0 && (
              <div className="mb-4">
                <h4 className="text-yellow-400 text-xs font-bold mb-2">Solicitudes Pendientes ({pendingRequests.length})</h4>
                <div className="space-y-2">
                  {pendingRequests.map(r => (
                    <div key={r.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={r.avatar} alt="" className="w-8 h-8 rounded-full" />
                        <div>
                          <div className="text-white text-xs font-bold">{r.username}</div>
                          <div className="text-yellow-400 text-[10px]">{r.event_type.replace('_', ' ').toUpperCase()}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => approveRequest(r.id)} className="bg-green-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold">Aprobar</button>
                        <button onClick={() => rejectRequest(r.id)} className="bg-red-600 text-white px-2 py-1 rounded-lg text-[10px]">X</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Solicitar Evento - King */}
            <h4 className="text-yellow-400 text-xs font-bold mb-2">👑 Solicitar Evento King</h4>
            <p className="text-white/40 text-[9px] mb-2">1 vez al mes. Cumple la meta de juego para recibir tu pago.</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button data-testid="req-king" onClick={() => requestEvent('king')} className="bg-gradient-to-b from-yellow-600/30 to-amber-700/30 border border-yellow-500/20 rounded-xl p-3 text-center active:scale-95">
                <div className="text-xl">👑</div>
                <div className="text-white text-[10px] font-bold">King</div>
                <div className="text-yellow-300 text-[8px]">Meta: 200M</div>
                <div className="text-green-300 text-[8px]">Pago: 3M</div>
              </button>
              <button data-testid="req-king1" onClick={() => requestEvent('king_1')} className="bg-gradient-to-b from-orange-600/30 to-red-700/30 border border-orange-500/20 rounded-xl p-3 text-center active:scale-95">
                <div className="text-xl">👑</div>
                <div className="text-white text-[10px] font-bold">King 1</div>
                <div className="text-orange-300 text-[8px]">Meta: 300M</div>
                <div className="text-green-300 text-[8px]">Pago: 4M</div>
              </button>
              <button data-testid="req-king3" onClick={() => requestEvent('king_3')} className="bg-gradient-to-b from-red-600/30 to-rose-700/30 border border-red-500/20 rounded-xl p-3 text-center active:scale-95">
                <div className="text-xl">👑</div>
                <div className="text-white text-[10px] font-bold">King 3</div>
                <div className="text-red-300 text-[8px]">Meta: 500M</div>
                <div className="text-green-300 text-[8px]">Pago: 5M</div>
              </button>
            </div>

            {/* Solicitar Evento - CP */}
            <h4 className="text-pink-400 text-xs font-bold mb-2">💖 Solicitar Evento CP</h4>
            <p className="text-white/40 text-[9px] mb-2">Pago exclusivo para ti y tu pareja al subir de nivel.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button data-testid="req-cp6" onClick={() => requestEvent('cp_6')} className="bg-gradient-to-b from-pink-600/30 to-rose-700/30 border border-pink-500/20 rounded-xl p-3 text-center active:scale-95">
                <div className="text-xl">💖</div>
                <div className="text-white text-[10px] font-bold">CP Nivel 6</div>
                <div className="text-green-300 text-[8px]">5M c/u</div>
              </button>
              <button data-testid="req-cp7" onClick={() => requestEvent('cp_7')} className="bg-gradient-to-b from-purple-600/30 to-indigo-700/30 border border-purple-500/20 rounded-xl p-3 text-center active:scale-95">
                <div className="text-xl">💍</div>
                <div className="text-white text-[10px] font-bold">CP Nivel 7</div>
                <div className="text-green-300 text-[8px]">7M c/u</div>
              </button>
            </div>

            {/* My Events Status */}
            {myEvents.length > 0 && (
              <div>
                <h4 className="text-white text-xs font-bold mb-2">Mis Eventos</h4>
                <div className="space-y-2">
                  {myEvents.map(ev => (
                    <div key={ev.id} className={`rounded-xl p-3 border ${ev.status === 'completed' ? 'bg-green-500/10 border-green-500/20' : ev.status === 'approved' ? 'bg-blue-500/10 border-blue-500/20' : ev.status === 'rejected' ? 'bg-red-500/10 border-red-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-white text-[10px] font-bold">{ev.label}</span>
                          <span className={`ml-2 text-[9px] px-2 py-0.5 rounded-full ${ev.status === 'completed' ? 'bg-green-500/30 text-green-300' : ev.status === 'approved' ? 'bg-blue-500/30 text-blue-300' : ev.status === 'rejected' ? 'bg-red-500/30 text-red-300' : 'bg-yellow-500/30 text-yellow-300'}`}>
                            {ev.status === 'pending' ? 'Pendiente' : ev.status === 'approved' ? 'Aprobado' : ev.status === 'completed' ? 'Completado' : 'Rechazado'}
                          </span>
                        </div>
                        <span className="text-green-400 text-[10px] font-bold">+{(ev.reward / 1000000).toFixed(0)}M</span>
                      </div>
                      {ev.status === 'approved' && ev.goal > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[9px] text-white/40 mb-1">
                            <span>Progreso</span>
                            <span>{((ev.game_progress || 0) / 1000000).toFixed(0)}M / {(ev.goal / 1000000).toFixed(0)}M</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: `${Math.min(100, ((ev.game_progress || 0) / ev.goal) * 100)}%`}} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
              <RoomGames
                userId={user.id}
                userCoins={user.coins || 0}
                onResult={(data) => {
                  if (data.new_balance !== undefined) updateUser({ coins: data.new_balance });
                  setGameResult(data);
                  setTimeout(() => setGameResult(null), 4000);
                }}
                onClose={() => setPanel(null)}
                onPlayClassic={(gameId, cost) => playMiniGame(gameId, cost)}
                onStartPK={() => {
                  const others = room.seats.filter(s => s && s.user_id !== user.id);
                  if (others.length === 0) { alert('No hay otros usuarios en la sala'); return; }
                  setPanel(null);
                  startPK(others[0]);
                }}
              />
            )}

            {/* TIENDA */}
            {panel === 'tienda' && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'Oros', emoji: '🪙', desc: 'Comprar monedas', color: 'from-yellow-500/30 to-amber-600/30' },
                  { name: 'Aristocracia', emoji: '👑', desc: 'Niveles VIP', color: 'from-purple-500/30 to-indigo-600/30' },
                  { name: 'Marco', emoji: '🖼️', desc: 'Marcos de perfil', color: 'from-cyan-500/30 to-blue-600/30' },
                  { name: 'Entradas', emoji: '🐉', desc: 'Entradas VIP', color: 'from-red-500/30 to-orange-600/30' },
                  { name: 'Anillo', emoji: '💍', desc: 'Anillos de CP', color: 'from-pink-500/30 to-rose-600/30' },
                  { name: 'Supermercado', emoji: '🛒', desc: 'Todo en oferta', color: 'from-green-500/30 to-emerald-600/30' },
                ].map(item => (
                  <button key={item.name} className={`bg-gradient-to-b ${item.color} border border-white/10 rounded-xl p-3 text-center active:scale-95 transition-all`}>
                    <div className="text-3xl mb-1">{item.emoji}</div>
                    <div className="text-white text-xs font-bold">{item.name}</div>
                    <div className="text-white/40 text-[9px]">{item.desc}</div>
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
            {/* Events trigger - visible for all users */}
            <button data-testid="events-room-btn" onClick={() => { setEventPanel(true); loadMyEvents(); loadPendingRequests(); }} className="w-7 h-7 rounded-full bg-yellow-600 flex items-center justify-center text-[10px]">👑</button>
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
          <button data-testid="bar-tienda" onClick={() => setPanel('tienda')} className="bg-purple-500/15 border border-purple-500/20 rounded-full px-2.5 py-1 flex items-center gap-1">
            <span className="text-xs">🛒</span><span className="text-purple-300 text-[10px] font-bold">Tienda</span>
          </button>
          <div className="ml-auto bg-white/5 rounded-full px-2.5 py-1">
            <span className="text-yellow-400 text-[10px] font-bold">💰 {user.coins >= 1e6 ? `${(user.coins/1e6).toFixed(1)}M` : (user.coins || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* PK BATTLE BANNER */}
      {pkBattle && pkBattle.status === 'active' && (
        <div className="flex-shrink-0 px-3 mb-1">
          <div className="bg-gradient-to-r from-red-600/30 to-orange-600/30 border border-red-500/30 rounded-xl p-2 flex items-center justify-between" style={{animation: 'pulse 1.5s infinite'}}>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚔️</span>
              <div>
                <div className="text-white text-[10px] font-bold">PK BATTLE</div>
                <div className="text-white/60 text-[8px]">{pkBattle.challenger_name} vs {pkBattle.opponent_name}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-yellow-400 text-[10px] font-bold">{pkBattle.challenger_gifts?.toLocaleString()} vs {pkBattle.opponent_gifts?.toLocaleString()}</div>
              {user.role === 'dueño' && (
                <button onClick={endPK} className="bg-red-600 text-white px-2 py-1 rounded-lg text-[9px] font-bold">Finalizar</button>
              )}
            </div>
          </div>
        </div>
      )}

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
                        onClick={() => setZoomImg(m.image_url?.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${m.image_url}` : m.image_url)}
                        className="mt-0.5 max-w-[150px] rounded-lg object-cover cursor-pointer transition-all hover:opacity-80" />
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

          {/* PK Battle */}
          <button data-testid="pk-battle-btn" onClick={() => {
            const others = room.seats.filter(s => s && s.user_id !== user.id);
            if (others.length === 0) return alert('No hay otros usuarios en la sala');
            startPK(others[0]);
          }}
            className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center text-sm active:scale-90 border-2 border-red-400">⚔️</button>
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
