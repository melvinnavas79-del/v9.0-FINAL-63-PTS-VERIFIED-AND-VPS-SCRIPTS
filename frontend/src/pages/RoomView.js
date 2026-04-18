import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';
import { useAudio } from '../contexts/AudioContext';
import { EntryAnimation, ProfileFrame } from '../components/Animations';
import RoomGames from '../components/RoomGames';
import LionTigerGame from '../components/LionTigerGame';
import UserProfileModal from '../components/UserProfileModal';
import PKBattle from '../components/PKBattle';
import PremiumGiftAnimation from '../components/PremiumGiftAnimation';
import ToolsPanel from '../components/ToolsPanel';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COFRE_COLORS = ['#b45309','#c2410c','#dc2626','#db2777','#9333ea','#4f46e5','#2563eb','#0891b2','#059669','#d97706'];

// Global coin formatter
const formatCoins = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return n.toLocaleString();
};

const RoomView = ({ roomId, onBack }) => {
  const { user, updateUser, syncUser } = useUser();
  const {
    activeRoom,
    audioStatus,
    isMuted,
    isDeafened,
    mySeat: ctxSeat,
    setMySeat: setCtxSeat,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleDeafen,
  } = useAudio();
  const [room, setRoom] = useState(null);
  const [mySeat, setMySeat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [entryAnim, setEntryAnim] = useState(null);
  const [panel, setPanel] = useState(null);
  const [giftTarget, setGiftTarget] = useState(null);
  const [gifts, setGifts] = useState({});
  const [sobres, setSobres] = useState([]);
  const [cofresData, setCofresData] = useState(null);
  const [botOn, setBotOn] = useState(false);
  const [showLionTiger, setShowLionTiger] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [floatingGift, setFloatingGift] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargePackages, setRechargePackages] = useState({});
  const [premiumAnim, setPremiumAnim] = useState(null);
  const [globalBanner, setGlobalBanner] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [effectBurst, setEffectBurst] = useState(null);

  const chatRef = useRef(null);
  const prevMsgCount = useRef(0);
  const photoRef = useRef(null);
  const musicRef = useRef(null);
  const audioElementRef = useRef(null);
  const bgRef = useRef(null);
  const joinedOnceRef = useRef(false);

  useEffect(() => {
    loadRoom(); markJoinAndLoadChat(); loadGifts(); loadSobres(); loadCofres(); checkBotActive(); loadMyEvents(); loadPendingRequests(); loadPK();
    // Join Agora via global context (persists across navigation).
    // Trigger welcome/entry animation once per room join.
    (async () => {
      const alreadyInThisRoom = activeRoom?.roomId === roomId;
      if (!alreadyInThisRoom) {
        await joinRoom(roomId, '', user.id);
        try {
          const welcomeRes = await axios.post(`${API}/rooms/${roomId}/welcome?user_id=${user.id}`);
          if (welcomeRes.data?.entry_animation && welcomeRes.data.entry_animation !== 'none') {
            setEntryAnim({ animation: welcomeRes.data.entry_animation, username: welcomeRes.data.username || user.username });
          }
          const a = await axios.get(`${API}/users/${user.id}/entry-animation`);
          if (a.data?.special && !welcomeRes.data?.entry_animation) {
            setEntryAnim({ animation: a.data.animation, username: user.username });
          }
        } catch (e) {}
      }
      joinedOnceRef.current = true;
    })();
    const r = setInterval(loadRoom, 3000);
    const c = setInterval(loadChat, 2000);
    const cf = setInterval(loadCofres, 5000);
    const ga = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/announcements/latest`);
        if (res.data?.text && res.data.id !== window._lastAnnouncementId) {
          window._lastAnnouncementId = res.data.id;
          setGlobalBanner(res.data.text);
          setTimeout(() => setGlobalBanner(null), 8000);
        }
      } catch (e) {}
    }, 5000);
    return () => {
      clearInterval(r); clearInterval(c); clearInterval(cf); clearInterval(ga);
      // NOTE: We intentionally do NOT leave Agora here.
      // Audio persists via AudioContext until user explicitly taps "Salir" / ✕.
      // Cleanup local room music audio element only.
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
        audioElementRef.current = null;
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (chatMessages.length > prevMsgCount.current && chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages]);

  const loadRoom = async () => {
    try {
      const r = await axios.get(`${API}/rooms/${roomId}`);
      setRoom(r.data);
      const s = r.data.seats.findIndex(s => s?.user_id === user.id);
      const seatIdx = s >= 0 ? s : null;
      setMySeat(seatIdx);
      setCtxSeat(seatIdx);
      // Keep the AudioContext aware of the latest room name for MiniPlayer
      if (r.data?.name) {
        joinRoom(roomId, r.data.name, user.id);
      }
    } catch (e) {}
  };
  const loadChat = async () => {
    try {
      const r = await axios.get(`${API}/rooms/${roomId}/chat?limit=30&user_id=${user.id}`);
      setChatMessages(r.data);
    } catch (e) {}
  };
  const markJoinAndLoadChat = async () => {
    try {
      await axios.post(`${API}/rooms/${roomId}/mark-join?user_id=${user.id}`);
      await loadChat();
    } catch (e) {}
  };
  const loadGifts = async () => { try { const r = await axios.get(`${API}/gifts`); setGifts(r.data); } catch (e) {} };
  const loadSobres = async () => { try { const r = await axios.get(`${API}/sobres`); setSobres(r.data); } catch (e) {} };
  const loadCofres = async () => { try { const r = await axios.get(`${API}/rooms/${roomId}/cofres`); setCofresData(r.data); } catch (e) {} };
  const loadRechargePackages = async () => { try { const r = await axios.get(`${API}/store/packages`); setRechargePackages(r.data); } catch (e) {} };
  const buyPackageInRoom = async (pkgId) => {
    try {
      const r = await axios.post(`${API}/store/checkout?package_id=${pkgId}&user_id=${user.id}`, null, { headers: { 'Origin': window.location.origin } });
      if (r.data.url) window.location.href = r.data.url;
    } catch (e) { alert(e.response?.data?.detail || 'Error. Contacta Soporte de Lluvia Live.'); }
  };

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

  const joinSeat = async (i) => {
    try {
      await axios.post(`${API}/rooms/${roomId}/join`, null, { params: { user_id: user.id, seat_index: i } });
      loadRoom();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };
  const leaveSeat = async () => {
    try {
      await axios.post(`${API}/rooms/${roomId}/leave`, null, { params: { user_id: user.id } });
      setMySeat(null);
      setCtxSeat(null);
      loadRoom();
    } catch (e) {}
  };
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
      setMusicPlaying(true);
    } catch (err) { alert(err.response?.data?.detail || 'Error al subir musica'); }
    if (musicRef.current) musicRef.current.value = '';
  };

  const uploadBackground = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const fd = new FormData();
      fd.append('file', f);
      await axios.post(`${API}/rooms/${roomId}/background?owner_id=${user.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadRoom();
    } catch (err) { alert(err.response?.data?.detail || 'Imagen rechazada'); }
    if (bgRef.current) bgRef.current.value = '';
  };

  const toggleMusic = () => {
    const audio = audioElementRef.current;
    if (!audio) return;
    if (musicPlaying) {
      audio.pause();
      setMusicPlaying(false);
    } else {
      audio.play().catch(() => {});
      setMusicPlaying(true);
    }
  };

  const stopMusic = async () => {
    // Stop locally
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setMusicPlaying(false);
    // Remove from server (owner only)
    if (room?.owner_id === user.id) {
      try { await axios.delete(`${API}/rooms/${roomId}/music?owner_id=${user.id}`); loadRoom(); } catch (e) {}
    }
  };

  const PREMIUM_GIFTS = ['leon', 'dragon', 'castillo', 'lluvia_oro', 'mega_crown'];

  const sendGift = async (type, targetOverride) => {
    const target = targetOverride || giftTarget;
    if (!target) return;
    try {
      const r = await axios.post(`${API}/gifts/send`, { sender_id: user.id, receiver_id: target.user_id, gift_type: type, room_id: roomId });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      // Premium fullscreen animation for high-value gifts
      if (PREMIUM_GIFTS.includes(type)) {
        setPremiumAnim({ type, sender: user.username });
        // Send global announcement for premium gifts
        try { await axios.post(`${API}/admin/global-announce?admin_id=${user.id}&text=${encodeURIComponent(`${user.username} envio ${gifts[type]?.emoji || '🎁'} ${gifts[type]?.name || type} en ${room.name}!`)}`); } catch (e) {}
      } else {
        // Regular float animation
        setFloatingGift({ emoji: gifts[type]?.emoji || '🎁', key: Date.now() });
        setTimeout(() => setFloatingGift(null), 2000);
      }
      setPanel(null); setGiftTarget(null); loadChat(); loadCofres();
      setTimeout(() => syncUser(), 1000);
    } catch (e) {
      const msg = e.response?.data?.detail || 'Error al enviar regalo';
      if (msg === 'No tienes suficientes monedas') {
        setShowRecharge(true); loadRechargePackages();
      } else {
        alert(msg);
      }
    }
  };

  const throwSobre = async (sobreId) => {
    try {
      const r = await axios.post(`${API}/sobres/throw`, { sender_id: user.id, room_id: roomId, sobre_id: sobreId });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      setFloatingGift({ emoji: '🧧', key: Date.now() });
      setTimeout(() => setFloatingGift(null), 2000);
      setPanel(null); loadChat(); loadCofres();
      setTimeout(() => syncUser(), 1000);
    } catch (e) {
      const msg = e.response?.data?.detail || 'Error';
      if (msg === 'Monedas insuficientes') {
        alert('Monedas insuficientes. Contacta a Soporte de Lluvia Live para recargar.');
      } else {
        alert(msg);
      }
    }
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

  // ==================== TOOLS PANEL HANDLERS ====================
  const toggleGhostMode = async () => {
    try {
      const r = await axios.post(`${API}/users/${user.id}/ghost-mode`);
      updateUser({ ghost_mode: r.data.ghost_mode });
      alert(r.data.ghost_mode ? '👤 Modo fantasma ACTIVADO (oculto de rankings)' : '👤 Modo fantasma desactivado');
    } catch (e) { alert('Error al cambiar identidad'); }
  };

  const quickDados = async () => {
    try {
      const r = await axios.post(`${API}/games/play`, { user_id: user.id, game: 'dados', bet: 1000 });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      setGameResult(r.data);
      setTimeout(() => setGameResult(null), 3500);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };
  const quickRuleta = async () => {
    try {
      const r = await axios.post(`${API}/games/ruleta`, { user_id: user.id, bet_amount: 1000 });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      setGameResult({ won: r.data.multiplier > 0, prize: r.data.winnings, multiplier: r.data.multiplier, result: r.data.result });
      setTimeout(() => setGameResult(null), 3500);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };
  const quickMora = async () => {
    const choices = ['piedra', 'papel', 'tijera'];
    const pick = choices[Math.floor(Math.random() * 3)];
    try {
      const r = await axios.post(`${API}/games/piedra-papel-tijera`, { user_id: user.id, choice: pick, bet_amount: 1000 });
      if (r.data.new_balance !== undefined) updateUser({ coins: r.data.new_balance });
      setGameResult({ won: r.data.multiplier > 0, prize: r.data.winnings, result: `Tú: ${r.data.player_choice} vs ${r.data.computer_choice} — ${r.data.result}` });
      setTimeout(() => setGameResult(null), 4000);
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const triggerEffect = () => {
    const effects = ['✨', '💥', '🎆', '⚡', '🌟', '🎇'];
    const e = effects[Math.floor(Math.random() * effects.length)];
    setEffectBurst({ emoji: e, key: Date.now() });
    setTimeout(() => setEffectBurst(null), 1800);
  };

  const handleToolAction = (id) => {
    switch (id) {
      case 'sorpresa': setPanel('cofres'); break;
      case 'numero': quickRuleta(); break;
      case 'dado': quickDados(); break;
      case 'mora': quickMora(); break;
      case 'switch': toggleGhostMode(); break;
      case 'clear': setChatMessages([]); break;
      case 'music': musicRef.current?.click(); break;
      case 'effect': triggerEffect(); break;
      default: break;
    }
  };

  if (!room) return <div className="h-screen bg-gradient-to-b from-indigo-950 via-slate-900 to-gray-950 flex items-center justify-center"><div className="text-white">Cargando...</div></div>;

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
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes giftBubble { 0% { opacity: 0; transform: translateY(20px) scale(0.8); } 50% { opacity: 1; transform: translateY(-5px) scale(1.05); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      {entryAnim && <EntryAnimation animation={entryAnim.animation} username={entryAnim.username} onComplete={() => setEntryAnim(null)} />}
      {premiumAnim && <PremiumGiftAnimation giftType={premiumAnim.type} senderName={premiumAnim.sender} onComplete={() => setPremiumAnim(null)} />}

      {/* TOOLS PANEL — Premium glass panel with 8 circular tools */}
      <ToolsPanel open={toolsOpen} onClose={() => setToolsOpen(false)} onAction={handleToolAction} />

      {/* EFFECT BURST — triggered by Efecto tool */}
      {effectBurst && (
        <div key={effectBurst.key} className="fixed inset-0 z-[75] pointer-events-none flex items-center justify-center">
          <div className="text-[120px]" style={{ animation: 'effectBurst 1.8s ease-out forwards' }}>{effectBurst.emoji}</div>
          <style>{`@keyframes effectBurst { 0% { opacity: 0; transform: scale(0.3) rotate(-15deg); } 30% { opacity: 1; transform: scale(1.4) rotate(5deg); } 100% { opacity: 0; transform: scale(2.2) rotate(15deg); } }`}</style>
        </div>
      )}

      {/* GLOBAL BANNER */}
      {globalBanner && (
        <div className="absolute top-0 left-0 right-0 z-[60] bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 px-4 py-2 text-center" style={{top: 'calc(env(safe-area-inset-top, 20px) + 50px)'}}>
          <div className="text-white text-xs font-bold">{globalBanner}</div>
        </div>
      )}

      {/* PHOTO ZOOM MODAL */}
      {zoomImg && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setZoomImg(null)}>
          <button className="absolute top-4 right-4 text-white text-2xl" onClick={() => setZoomImg(null)}>✕</button>
          <img src={zoomImg} alt="" className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg" />
        </div>
      )}

      {/* LION VS TIGER GAME */}
      {showLionTiger && (
        <LionTigerGame
          userId={user.id}
          userCoins={user.coins || 0}
          onBalanceUpdate={(newBal) => { updateUser({ coins: newBal }); }}
          onClose={() => { setShowLionTiger(false); syncUser(); }}
        />
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
          <div className="w-full bg-gray-950 rounded-t-3xl p-4 max-h-[80vh] overflow-y-auto border-t border-white/10" style={{paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))'}} onClick={e => e.stopPropagation()}>
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
                    <div className="text-yellow-400 text-[8px]">{formatCoins(g.cost)}</div>
                  </button>
                ))}
              </div>
            )}

            {panel === 'gifts-all' && (
              <>
                {room.seats.filter(s => s && s.user_id !== user.id).length > 0 ? (
                  <>
                    <p className="text-white/40 text-xs mb-2">Elige a quién enviar</p>
                    <div className="flex gap-2 mb-3 overflow-x-auto">
                      {room.seats.filter(s => s && s.user_id !== user.id).map((s, i) => (
                        <button key={i} onClick={() => { setGiftTarget(s); setPanel('gifts'); }}
                          className="flex-shrink-0 bg-white/10 rounded-xl p-2 text-center hover:bg-white/20 active:scale-95 transition-all">
                          <img src={s.avatar} alt="" className="w-10 h-10 rounded-full mx-auto mb-1" />
                          <div className="text-white text-[9px]">{s.username}</div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 mb-3">
                    <div className="text-3xl mb-2">👥</div>
                    <p className="text-white/40 text-xs">No hay otros usuarios en la sala para enviar regalos</p>
                    <p className="text-white/30 text-[10px]">Invita amigos a tu sala</p>
                  </div>
                )}
                <p className="text-white/40 text-xs mb-2">Regalos</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {Object.entries(gifts).filter(([k]) => !k.startsWith('sobre_')).map(([k, g]) => {
                    const others = room.seats.filter(s => s && s.user_id !== user.id);
                    return (
                      <button key={k} onClick={() => {
                        if (others.length === 0) { alert('No hay usuarios en la sala para enviar regalos'); return; }
                        if (others.length === 1) { sendGift(k, others[0]); return; }
                        setGiftTarget(others[0]); setPanel('gifts');
                      }} className="bg-white/5 rounded-xl p-2 text-center border border-white/5 active:scale-95 transition-all">
                        <div className="text-xl">{g.emoji}</div>
                        <div className="text-white text-[8px]">{g.name}</div>
                        <div className="text-yellow-400 text-[8px]">{formatCoins(g.cost)}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-white/40 text-xs mb-2">Sobres (Lluvia de Oro para todos)</p>
                <div className="grid grid-cols-4 gap-2">
                  {sobres.map(s => (
                    <button key={s.id} onClick={() => throwSobre(s.id)} className="bg-red-900/30 border border-red-500/20 rounded-xl p-2 text-center active:scale-95">
                      <div className="text-lg">{s.emoji}</div>
                      <div className="text-white text-[8px]">{s.name}</div>
                      <div className="text-red-300 text-[8px]">{formatCoins(s.amount)}</div>
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
                    <div className="text-red-300 text-[8px]">{formatCoins(s.amount)}</div>
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
                userAvatar={user.avatar}
                userName={user.username}
                userCoins={user.coins || 0}
                onResult={(data) => {
                  if (data.new_balance !== undefined) updateUser({ coins: data.new_balance });
                  setGameResult(data);
                  setTimeout(() => setGameResult(null), 4000);
                  setTimeout(() => syncUser(), 1500);
                }}
                onClose={() => { setPanel(null); syncUser(); }}
                onStartPK={() => {
                  const others = room.seats.filter(s => s && s.user_id !== user.id);
                  if (others.length === 0) { alert('No hay otros usuarios en la sala'); return; }
                  setPanel(null);
                  startPK(others[0]);
                }}
                onOpenLionTiger={() => { setPanel(null); setShowLionTiger(true); }}
              />
            )}

            {/* TIENDA */}
            {panel === 'tienda' && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Oros', emoji: '🪙', desc: 'Comprar monedas', color: 'from-yellow-500/30 to-amber-600/30' },
                  { name: 'Aristocracia', emoji: '👑', desc: 'Niveles VIP', color: 'from-purple-500/30 to-indigo-600/30' },
                  { name: 'Marco', emoji: '🖼️', desc: 'Marcos de perfil', color: 'from-cyan-500/30 to-blue-600/30' },
                  { name: 'Entradas', emoji: '🐉', desc: 'Entradas VIP', color: 'from-red-500/30 to-orange-600/30' },
                  { name: 'Anillo', emoji: '💍', desc: 'Anillos de CP', color: 'from-pink-500/30 to-rose-600/30' },
                  { name: 'Supermercado', emoji: '🛒', desc: 'Todo en oferta', color: 'from-green-500/30 to-emerald-600/30' },
                ].map(item => (
                  <button key={item.name} className={`bg-gradient-to-b ${item.color} border border-white/10 rounded-xl p-4 text-center active:scale-95 transition-all min-h-[100px]`}>
                    <div className="text-3xl mb-2">{item.emoji}</div>
                    <div className="text-white text-xs font-bold">{item.name}</div>
                    <div className="text-white/40 text-[9px]">{item.desc}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-yellow-400/50 text-[10px]">Tus monedas: {formatCoins(user.coins)}</p>
              <button onClick={() => { setShowRecharge(true); loadRechargePackages(); }} data-testid="recharge-in-room"
                className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full active:scale-95">
                + Recargar
              </button>
            </div>

            {/* RECHARGE MODAL */}
            {showRecharge && (
              <div className="mt-3 bg-gradient-to-b from-green-900/40 to-emerald-900/40 border border-green-500/20 rounded-2xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-green-300 text-xs font-bold">Recargar Monedas</span>
                  <button onClick={() => setShowRecharge(false)} className="text-white/30 text-sm">x</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(rechargePackages).slice(0, 6).map(([id, pkg]) => (
                    <button key={id} onClick={() => buyPackageInRoom(id)}
                      className="bg-white/5 border border-white/10 rounded-xl p-2 text-center active:scale-95 hover:bg-white/10 transition-all">
                      <div className="text-yellow-400 text-sm font-bold">{formatCoins(pkg.coins)}</div>
                      <div className="text-white/40 text-[8px]">{pkg.diamonds > 0 ? `+${formatCoins(pkg.diamonds)} diamantes` : ''}</div>
                      <div className="text-green-400 text-xs font-bold mt-1">${pkg.price}</div>
                    </button>
                  ))}
                </div>
                <p className="text-white/20 text-[8px] text-center mt-2">Pagos seguros con PayPal</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex-shrink-0 px-3 pb-1" style={{paddingTop: 'calc(env(safe-area-inset-top, 20px) + 8px)'}}>
        <div className="flex items-center justify-between">
          <button data-testid="room-back-btn" onClick={() => { onBack(); }} className="bg-white/15 text-white px-5 py-2.5 rounded-full text-sm font-bold min-h-[44px] min-w-[80px] active:scale-95 transition-transform" style={{WebkitTapHighlightColor: 'transparent'}} title="Minimizar (audio sigue conectado)">← Salir</button>
          <div className="text-center flex-1 mx-2">
            <h2 className="text-white text-sm font-bold truncate">{room.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Minimize - keeps audio alive via global MiniPlayer */}
            <button data-testid="minimize-btn" onClick={() => onBack()} className="bg-white/15 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-base font-bold active:scale-95 transition-transform" title="Minimizar sala (audio sigue)">⬇️</button>
            {/* Bot ON/OFF */}
            {user.role === 'dueño' && (
              <button data-testid="bot-toggle-room" onClick={toggleBot} className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-base ${botOn ? 'bg-green-500' : 'bg-gray-600'}`}>🤖</button>
            )}
            {/* Events trigger */}
            <button data-testid="events-room-btn" onClick={() => { setEventPanel(true); loadMyEvents(); loadPendingRequests(); }} className="min-w-[44px] min-h-[44px] rounded-full bg-yellow-600 flex items-center justify-center text-base">👑</button>
            <span className={`w-2.5 h-2.5 rounded-full ${audioStatus === 'on' ? 'bg-green-400' : 'bg-red-400'}`} />
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
      <div className="flex-shrink-0 px-3 mb-2">
        <div className="flex gap-2">
          <button data-testid="bar-cofres" onClick={() => setPanel('cofres')} className="bg-yellow-500/15 border border-yellow-500/20 rounded-full px-3 py-2 flex items-center gap-1.5 min-h-[40px]">
            <span className="text-base">📦</span><span className="text-yellow-300 text-xs font-bold">Cofres</span>
          </button>
          <button data-testid="bar-sobres" onClick={() => setPanel('sobres')} className="bg-red-500/15 border border-red-500/20 rounded-full px-3 py-2 flex items-center gap-1.5 min-h-[40px]">
            <span className="text-base">🧧</span><span className="text-red-300 text-xs font-bold">Sobres</span>
          </button>
          <button data-testid="bar-juegos" onClick={() => setPanel('games')} className="bg-green-500/15 border border-green-500/20 rounded-full px-3 py-2 flex items-center gap-1.5 min-h-[40px]">
            <span className="text-base">🎮</span><span className="text-green-300 text-xs font-bold">Juegos</span>
          </button>
          <button data-testid="bar-tienda" onClick={() => setPanel('tienda')} className="bg-purple-500/15 border border-purple-500/20 rounded-full px-3 py-2 flex items-center gap-1.5 min-h-[40px]">
            <span className="text-base">🛒</span><span className="text-purple-300 text-xs font-bold">Tienda</span>
          </button>
          {room.owner_id === user.id && (
            <>
              <button onClick={() => bgRef.current?.click()} className="bg-cyan-500/15 border border-cyan-500/20 rounded-full px-3 py-2 flex items-center gap-1.5 min-h-[40px]">
                <span className="text-base">🖼</span><span className="text-cyan-300 text-xs font-bold">Fondo</span>
              </button>
              <input ref={bgRef} type="file" accept="image/*" onChange={uploadBackground} className="hidden" />
            </>
          )}
          <div className="ml-auto bg-white/5 rounded-full px-3 py-2 flex items-center min-h-[40px]">
            <span className="text-yellow-400 text-xs font-bold">💰 {formatCoins(user.coins)}</span>
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

      {/* PROFILE MODAL */}
      {profileTarget && (
        <UserProfileModal
          targetUser={profileTarget}
          currentUser={user}
          roomId={roomId}
          onClose={() => setProfileTarget(null)}
          onRefresh={() => { loadRoom(); }}
        />
      )}

      {/* PK BATTLE BAR */}
      <PKBattle roomId={roomId} userId={user.id} />

      {/* SEATS - Circular design with neon glow */}
      <div className="flex-shrink-0 px-3 mb-1 overflow-y-auto" style={{maxHeight: '40vh'}}>
        <style>{`
          @keyframes neonPulse { 0%,100% { box-shadow: 0 0 8px #00ff88, 0 0 20px #00ff8855, 0 0 40px #00ff8822; } 50% { box-shadow: 0 0 12px #00ff88, 0 0 30px #00ff8877, 0 0 50px #00ff8833; } }
          .seat-speaking { animation: neonPulse 1.5s ease-in-out infinite; border-color: #00ff88 !important; }
        `}</style>
        {/* Owner controls */}
        {room.owner_id === user.id && (
          <div className="flex gap-1 mb-2 justify-between">
            <div className="flex gap-1">
              <button onClick={async () => { await axios.post(`${API}/rooms/${roomId}/lock-all?owner_id=${user.id}`); loadRoom(); }}
                className="text-[9px] bg-red-500/20 text-red-300 px-2 py-1 rounded-lg active:scale-95">Cerrar</button>
              <button onClick={async () => { await axios.post(`${API}/rooms/${roomId}/unlock-all?owner_id=${user.id}`); loadRoom(); }}
                className="text-[9px] bg-green-500/20 text-green-300 px-2 py-1 rounded-lg active:scale-95">Abrir</button>
            </div>
            {user.role === 'dueño' && (
              <button onClick={async () => {
                const newSize = (room.max_seats || 10) === 10 ? 24 : 10;
                await axios.post(`${API}/rooms/${roomId}/expand-seats?admin_id=${user.id}&max_seats=${newSize}`);
                loadRoom();
              }} data-testid="toggle-event-mode"
                className={`text-[9px] px-3 py-1 rounded-lg font-bold active:scale-95 ${(room.max_seats || 10) === 24 ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/30' : 'bg-blue-500/20 text-blue-300'}`}>
                {(room.max_seats || 10) === 24 ? '24 Mics' : '10→24'}
              </button>
            )}
          </div>
        )}
        <div className="text-white/30 text-[10px] text-center mb-2 font-medium tracking-wider">Micro</div>
        {(() => {
          const maxSeats = room.max_seats || 10;
          const seats = (room.seats || []).slice(0, maxSeats);
          const cols = maxSeats <= 10 ? 3 : 6;
          const circleSize = maxSeats <= 10 ? 'w-[72px] h-[72px]' : 'w-[52px] h-[52px]';
          const avatarSize = maxSeats <= 10 ? 'w-[52px] h-[52px]' : 'w-[36px] h-[36px]';
          const labelSize = maxSeats <= 10 ? 'text-[11px]' : 'text-[8px]';
          return (
            <div className="grid justify-items-center gap-y-3" style={{gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: maxSeats <= 10 ? '16px 8px' : '8px 4px'}}>
              {seats.map((seat, i) => {
                const isLocked = room.seat_locks?.[i];
                const isSpeaking = seat && seat.user_id === user.id && !isMuted;
                const isOccupied = !!seat;
                return (
                  <div key={i} className="flex flex-col items-center">
                    <button data-testid={`seat-btn-${i}`}
                      onClick={() => {
                        if (isLocked && room.owner_id === user.id) { axios.post(`${API}/rooms/${roomId}/lock-seat?owner_id=${user.id}&seat_index=${i}`).then(() => loadRoom()); return; }
                        if (isLocked) return;
                        if (seat?.user_id === user.id) leaveSeat(); else if (seat) openGiftPanel(seat); else joinSeat(i);
                      }}
                      onContextMenu={(e) => { e.preventDefault(); if (seat) setProfileTarget(seat); }}
                      className={`${circleSize} rounded-full border-[3px] flex items-center justify-center transition-all relative ${
                        isLocked && !seat ? 'bg-gray-800/60 border-red-500/30' :
                        isSpeaking ? 'bg-gray-800 seat-speaking border-green-400' :
                        isOccupied ? 'bg-gray-800 border-gray-600/50' :
                        'bg-gray-800/80 border-gray-700/40'
                      }`}
                      style={isSpeaking ? {boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff8855'} : {}}>
                      {seat ? (
                        <img src={seat.avatar} alt="" className={`${avatarSize} rounded-full object-cover`}
                          onClick={(e) => { e.stopPropagation(); setProfileTarget(seat); }} />
                      ) : isLocked ? (
                        <span className="text-red-400/50 text-lg">🔒</span>
                      ) : (
                        <svg className="w-8 h-8 text-blue-300/40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      )}
                      {seat?.svip_level > 0 && (
                        <div className="absolute -top-1 -right-1 bg-yellow-500 text-[6px] text-black font-bold px-1 rounded-full">S{seat.svip_level}</div>
                      )}
                    </button>
                    <div className="mt-1 text-center">
                      {seat ? (
                        <div className="flex items-center gap-0.5 justify-center">
                          {seat.country_flag && <span className="text-[10px]">{seat.country_flag}</span>}
                          <span className={`text-white/80 ${labelSize} font-medium truncate max-w-[70px]`}>{seat.username}</span>
                        </div>
                      ) : (
                        <span className={`text-white/25 ${labelSize}`}>Silla {i + 1}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* CHAT */}
      <div className="flex-1 min-h-0 px-3 pb-1">
        <div className="h-full flex flex-col">
          <div ref={chatRef} className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
            {chatMessages.map(m => (
              <div key={m.id} className={m.type === 'welcome' || m.type === 'gift' ? 'text-center' : ''}>
                {m.type === 'welcome' ? (
                  <span className="bg-yellow-500/10 text-yellow-300/70 text-xs px-2 py-1 rounded-full inline-block" style={{animation: 'fadeInUp 0.5s ease-out'}}>{m.text}</span>
                ) : m.type === 'gift' ? (
                  <span className="bg-pink-500/10 text-pink-300/80 text-xs px-2 py-1 rounded-full inline-block" style={{animation: 'giftBubble 0.6s ease-out'}}>{m.text}</span>
                ) : m.type === 'photo' ? (
                  <div className="flex items-start gap-1.5">
                    <img src={m.avatar || ''} alt="" className="w-6 h-6 rounded-full mt-0.5" />
                    <div>
                      <span className="text-pink-400 text-xs font-bold">{m.username}</span>
                      <img src={m.image_url?.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${m.image_url}` : m.image_url} alt=""
                        onClick={() => setZoomImg(m.image_url?.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${m.image_url}` : m.image_url)}
                        className="mt-0.5 max-w-[150px] rounded-lg object-cover cursor-pointer transition-all hover:opacity-80" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <img src={m.avatar || ''} alt="" className="w-6 h-6 rounded-full mt-0.5" />
                    <div><span className="text-cyan-400 text-xs font-bold">{m.username}: </span><span className="text-white/60 text-xs">{m.text}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-shrink-0 mt-1">
            <button onClick={() => photoRef.current?.click()} className="bg-white/5 w-10 h-10 rounded-full flex items-center justify-center text-sm">📷</button>
            <input ref={photoRef} type="file" accept="image/*" onChange={sendPhoto} className="hidden" />
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Mensaje..." data-testid="chat-input" className="flex-1 bg-white/5 text-white placeholder-white/20 border-0 rounded-full px-4 py-2.5 text-sm outline-none min-h-[40px]" />
            <button data-testid="chat-send-btn" onClick={sendChat} className="bg-cyan-500 text-white px-4 py-2.5 rounded-full text-sm font-bold min-h-[40px]">Enviar</button>
          </div>
        </div>
      </div>

      {/* FLOATING GIFT ANIMATION */}
      {floatingGift && (
        <div key={floatingGift.key} className="fixed inset-0 z-[55] pointer-events-none flex items-center justify-center">
          <div className="text-6xl" style={{
            animation: 'giftFloat 2s ease-out forwards',
          }}>{floatingGift.emoji}</div>
          <style>{`
            @keyframes giftFloat {
              0% { opacity: 1; transform: translateY(0) scale(1); }
              50% { opacity: 1; transform: translateY(-120px) scale(1.5); }
              100% { opacity: 0; transform: translateY(-250px) scale(0.5); }
            }
          `}</style>
        </div>
      )}

      {/* BOTTOM BAR - ALWAYS VISIBLE */}
      <div className="flex-shrink-0 bg-black/90 border-t border-white/5 px-3" style={{paddingTop: '10px', paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))'}}>
        {/* Music Controls - visible when music exists */}
        {room.music_url && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <button onClick={toggleMusic} data-testid="music-play-pause"
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${musicPlaying ? 'bg-green-500' : 'bg-white/10'}`}>
              {musicPlaying ? '⏸' : '▶️'}
            </button>
            <div className="flex-1 bg-white/5 rounded-full h-1.5 mx-1 overflow-hidden">
              <div className={`h-full bg-purple-400 rounded-full ${musicPlaying ? 'animate-pulse' : ''}`} style={{width: musicPlaying ? '60%' : '0%'}} />
            </div>
            <button onClick={stopMusic} data-testid="music-stop"
              className="w-9 h-9 rounded-full bg-red-500/60 flex items-center justify-center text-sm">⏹</button>
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          {/* Gift */}
          <button data-testid="gift-bottom-btn" onClick={() => setPanel('gifts-all')}
            className="w-14 h-14 rounded-full bg-pink-500 flex items-center justify-center text-2xl active:scale-90 shadow-lg shadow-pink-500/30">🎁</button>

          {/* Music Upload */}
          <button data-testid="music-btn" onClick={() => musicRef.current?.click()}
            className="w-12 h-12 rounded-full bg-purple-600/80 flex items-center justify-center text-lg active:scale-90">🎵</button>
          <input ref={musicRef} type="file" accept="audio/*" onChange={uploadMusic} className="hidden" />

          {/* Mic - always visible */}
          <button data-testid="toggle-mute-btn" onClick={mySeat !== null ? toggleMute : () => {}}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl active:scale-90 shadow-lg ${
              mySeat === null ? 'bg-gray-700 opacity-50' : isMuted ? 'bg-red-500 shadow-red-500/30' : 'bg-green-500 shadow-green-500/30'
            }`}>{mySeat === null ? '🎤' : isMuted ? '🔇' : '🎤'}</button>

          {/* Speaker */}
          <button data-testid="toggle-deafen-btn" onClick={mySeat !== null ? toggleDeafen : () => {}}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg active:scale-90 ${
              mySeat === null ? 'bg-gray-700 opacity-50' : isDeafened ? 'bg-orange-500' : 'bg-blue-500'
            }`}>{isDeafened ? '🔕' : '🔊'}</button>

          {/* Close/Leave - Desconecta audio Y sale de la sala */}
          <button data-testid="leave-room-btn" onClick={async () => { await leaveRoom(); onBack(); }}
            className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-2xl active:scale-90 border-2 border-red-400" title="Salir y desconectar">✕</button>

          {/* 4-squares Tools button — opens premium ToolsPanel */}
          <button data-testid="tools-panel-btn" onClick={() => setToolsOpen(true)}
            className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center active:scale-90 transition-transform" title="Herramientas">
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#fff" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#fff" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#fff" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#fff" />
            </svg>
          </button>
        </div>
        {/* Hidden audio element - NO autoPlay, NO loop */}
        {room.music_url && (
          <audio
            ref={audioElementRef}
            src={room.music_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${room.music_url}` : room.music_url}
            onEnded={() => setMusicPlaying(false)}
            className="hidden"
          />
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
