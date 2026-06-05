import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';
import { useAudio } from '../contexts/AudioContext';
import { EntryAnimation } from '../components/Animations';
import RoomGames from '../components/RoomGames';
import LionTigerGame from '../components/LionTigerGame';
import UserProfileModal from '../components/UserProfileModal';
import PKBattle from '../components/PKBattle';
import PremiumGiftAnimation from '../components/PremiumGiftAnimation';
import ToolsPanel from '../components/ToolsPanel';
import GameResultToast from '../components/GameResultToast';
import useLevelHeartbeat from '../hooks/useLevelHeartbeat';
import useTTS from '../hooks/useTTS';
import GiftRanking from '../components/GiftRanking';
// ── Premium Room Components ─────────────────────────────
import '../styles/room.css';
import RoomBackground from '../components/room/RoomBackground';
import RoomHeader from '../components/room/RoomHeader';
import PremiumSeatsGrid from '../components/room/SeatsGrid';
import FloatingChat from '../components/room/FloatingChat';
import BottomBar from '../components/room/BottomBar';
import RightSidePanel from '../components/room/RightSidePanel';
import GiftButton from '../components/room/GiftButton';

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
  const [giftRankOpen, setGiftRankOpen] = useState(false);
  const [showChatInput, setShowChatInput] = useState(false);
  const [speakingSeats, setSpeakingSeats] = useState(new Set());
  const [showHostBar, setShowHostBar] = useState(false);

  // Level-up: heartbeat cuando hay mic activo
  useLevelHeartbeat({ userId: user?.id, isInRoomMicActive: mySeat !== null && !isMuted });
  // TTS nativo (Web Speech API) - lee los mensajes de chat entrantes si está activo
  const tts = useTTS();
  const lastSpokenRef = useRef(0);

  const photoRef = useRef(null);
  const musicRef = useRef(null);
  const audioElementRef = useRef(null);
  const bgRef = useRef(null);
  const joinedOnceRef = useRef(false); // eslint-disable-line no-unused-vars

  useEffect(() => {
    loadRoom(); markJoinAndLoadChat(); loadGifts(); loadSobres(); loadCofres(); if (user.role === 'dueño') checkBotActive(); loadMyEvents(); loadPendingRequests(); loadPK();
    // Join WebRTC signaling via global context (persists across navigation).
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
      // Sesión WebRTC persiste hasta que el usuario pulse "Salir" / ✕.
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
        audioElementRef.current = null;
      }
    };
  }, [roomId]);

  const lastBroadcastIdRef = useRef(null);
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
      // Entrada Épica broadcast: todos los clientes presentes reciben la animación.
      const brd = r.data.last_entry_broadcast;
      if (brd && brd.id && brd.id !== lastBroadcastIdRef.current) {
        lastBroadcastIdRef.current = brd.id;
        // Evitar autoplay al entrar por primera vez (ya mostramos la anim propia)
        const createdMs = Date.parse(brd.created_at || '');
        if (!isNaN(createdMs) && Date.now() - createdMs < 15_000) {
          setEntryAnim({ animation: brd.animation, username: brd.username });
        }
      }
    } catch (e) {}
  };
  const loadChat = async () => {
    try {
      const r = await axios.get(`${API}/rooms/${roomId}/chat?limit=30&user_id=${user.id}`);
      const newMessages = r.data;
      // TTS nativo: leer los mensajes nuevos (no los propios) cuando TTS esté activo
      if (tts.enabled) {
        const prevLast = lastSpokenRef.current;
        newMessages.forEach((m) => {
          const ts = new Date(m.created_at || 0).getTime();
          if (ts > prevLast && m.user_id !== user.id && m.type !== 'photo' && m.text) {
            tts.speak(`${m.username}: ${m.text}`);
          }
        });
        if (newMessages.length) {
          lastSpokenRef.current = Math.max(...newMessages.map(m => new Date(m.created_at || 0).getTime()));
        }
      }
      setChatMessages(newMessages);
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
    } catch (e) { /* silent */ }
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
      case 'voz':
        tts.setEnabled(!tts.enabled);
        if (!tts.enabled) tts.speak('Voz activada');
        break;
      case 'effect': triggerEffect(); break;
      default: break;
    }
  };

  // ── Seat press handler ──────────────────────────────────
  const handleSeatPress = (seatIndex, seat) => {
    if (!seat || !seat.user_id) {
      if (!seat?.is_locked) joinSeat(seatIndex);
      return;
    }
    if (seat.user_id === user.id) {
      leaveSeat();
      return;
    }
    setGiftTarget(seat);
    setPanel('gifts');
  };

  // ── Right side quick actions ─────────────────────────
  const handleQuickAction = (id) => {
    if (id === 'events')     { setEventPanel(true);      return; }
    if (id === 'ranking')    { setGiftRankOpen(true);    return; }
    if (id === 'games')      { setPanel('games');        return; }
    if (id === 'activities') { setPanel('cofres');       return; }
    if (id === 'vip')        { setPanel('tienda');       return; }
  };

  if (!room) return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #1a0533 0%, #0d1117 45%, #0a1628 100%)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500/50 border-t-purple-400"
          style={{ animation: 'spin 1s linear infinite' }} />
        <span className="text-white/60 text-sm">Cargando sala…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const opened          = cofresData?.cofres_opened || 0;
  const cofreProgress   = cofresData?.cofre_progress || 0;
  const thresholds      = cofresData?.thresholds || [];
  const nextThreshold   = opened < 10 ? (thresholds[opened]?.threshold || 0) : 0;
  const accumulated     = thresholds.slice(0, opened).reduce((a, c) => a + c.threshold, 0);
  const currentProgress = Math.max(0, cofreProgress - accumulated);
  const progressPct     = nextThreshold > 0 ? Math.min(100, (currentProgress / nextThreshold) * 100) : 100;
  const isHost          = room.owner_id === user.id || user.role === 'dueño' || user.is_super_admin;
  const userCount   = (room.seats?.filter(s => s?.user_id)?.length || 0) + (room.active_users || 0);
  const roomPhoto   = room.background
    ? (room.background.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${room.background}` : room.background)
    : null;

  // Chat messages enriched for FloatingChat
  const enrichedMessages = chatMessages.map(m => ({
    ...m,
    type: m.type || 'text',
  }));

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* ── Layer 0: Premium Background ──────────────────── */}
      <RoomBackground photo={roomPhoto} />

      {/* ── Overlays (z ≥ 40) ────────────────────────────── */}
      {entryAnim && <EntryAnimation animation={entryAnim.animation} username={entryAnim.username} onComplete={() => setEntryAnim(null)} />}
      {premiumAnim && <PremiumGiftAnimation giftType={premiumAnim.type} senderName={premiumAnim.sender} onComplete={() => setPremiumAnim(null)} />}

      {/* TOOLS PANEL — Premium glass panel with 8 circular tools */}
      <ToolsPanel open={toolsOpen} onClose={() => setToolsOpen(false)} onAction={handleToolAction} ttsEnabled={tts.enabled} />

      {/* GAME RESULT TOAST — feedback visual premium para Número/Dado/Mora */}
      <GameResultToast result={gameResult} onDone={() => setGameResult(null)} />

      {/* GIFT RANKING — Top regalos (diario/semanal/mensual) con corona 👑 */}
      {giftRankOpen && (
        <GiftRanking roomId={roomId} onClose={() => setGiftRankOpen(false)} />
      )}

      {/* EFFECT BURST — triggered by Efecto tool */}
      {effectBurst && (
        <div key={effectBurst.key} className="fixed inset-0 z-[75] pointer-events-none flex items-center justify-center">
          <div className="text-[120px]" style={{ animation: 'effectBurst 1.8s ease-out forwards' }}>{effectBurst.emoji}</div>
          <style>{`@keyframes effectBurst { 0% { opacity: 0; transform: scale(0.3) rotate(-15deg); } 30% { opacity: 1; transform: scale(1.4) rotate(5deg); } 100% { opacity: 0; transform: scale(2.2) rotate(15deg); } }`}</style>
        </div>
      )}

      {/* GLOBAL BANNER */}
      {globalBanner && (
        <div className="absolute top-0 left-0 right-0 z-[60] bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 px-4 py-2 text-center" style={{top: 'calc(env(safe-area-inset-top, 20px) + 72px)'}}>
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

      {/* ── Profile Modal ──────────────────────────────── */}
      {profileTarget && (
        <UserProfileModal
          targetUser={profileTarget}
          currentUser={user}
          roomId={roomId}
          onClose={() => setProfileTarget(null)}
          onRefresh={loadRoom}
        />
      )}

      {/* ── PK Battle ─────────────────────────────────── */}
      <PKBattle roomId={roomId} userId={user.id} />

      {/* ── Floating gift animation ────────────────────── */}
      {floatingGift && (
        <div key={floatingGift.key} className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{zIndex: 55}}>
          <div className="text-6xl" style={{ animation: 'gift-float 2s ease-out forwards' }}>
            {floatingGift.emoji}
          </div>
        </div>
      )}

      {/* ── PK Battle banner ──────────────────────────── */}
      {pkBattle?.status === 'active' && (
        <div className="absolute top-16 left-3 right-3 rounded-xl p-2 flex items-center justify-between"
          style={{ zIndex: 25, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            <div>
              <div className="text-white text-[10px] font-bold">PK BATTLE</div>
              <div className="text-white/60 text-[8px]">{pkBattle.challenger_name} vs {pkBattle.opponent_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-[10px] font-bold">
              {pkBattle.challenger_gifts?.toLocaleString()} vs {pkBattle.opponent_gifts?.toLocaleString()}
            </span>
            {isHost && (
              <button onClick={endPK} className="bg-red-600 text-white px-2 py-1 rounded-lg text-[9px] font-bold">
                Finalizar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────
       *  PREMIUM ROOM HEADER
       * ────────────────────────────────────────────────── */}
      <RoomHeader
        room={room}
        userCount={userCount}
        onBack={() => onBack()}
        onShare={() => {
          if (navigator.share) {
            navigator.share({ title: room.name, url: window.location.href }).catch(() => {});
          } else {
            navigator.clipboard?.writeText(window.location.href);
          }
        }}
        onInvite={() => setPanel('gifts-all')}
        onSettings={() => setToolsOpen(true)}
      />

      {/* ────────────────────────────────────────────────────
       *  MAIN SCROLLABLE ROOM AREA
       * ────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar relative"
        style={{ paddingBottom: 8 }}
      >
        {/* Music bar (if active) */}
        {room.music_url && (
          <div className="flex items-center gap-2 px-4 py-2 mx-3 mt-2 rounded-xl room-glass-dark">
            <span className="text-sm">🎵</span>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full bg-purple-400 rounded-full ${musicPlaying ? 'animate-pulse' : ''}`}
                style={{ width: musicPlaying ? '60%' : '0%' }} />
            </div>
            <button onClick={toggleMusic} data-testid="music-play-pause"
              className="text-white/70 text-xs active:scale-90">{musicPlaying ? '⏸' : '▶'}</button>
            <button onClick={stopMusic} data-testid="music-stop"
              className="text-red-400 text-xs active:scale-90">⏹</button>
          </div>
        )}

        {/* Host quick controls — colapsable */}
        {isHost && showHostBar && (
          <div className="flex items-center gap-1.5 px-4 py-1.5 mx-3 mt-2 rounded-xl overflow-x-auto no-scrollbar room-glass">
            <button data-testid="room-lock-all-btn"
              onClick={async () => { await axios.post(`${API}/rooms/${roomId}/lock-all?owner_id=${user.id}`); loadRoom(); }}
              className="flex-shrink-0 text-[9px] bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg active:scale-95 border border-red-500/20">
              🔒 Cerrar
            </button>
            <button data-testid="room-unlock-all-btn"
              onClick={async () => { await axios.post(`${API}/rooms/${roomId}/unlock-all?owner_id=${user.id}`); loadRoom(); }}
              className="flex-shrink-0 text-[9px] bg-green-500/20 text-green-300 px-2.5 py-1 rounded-lg active:scale-95 border border-green-500/20">
              🔓 Abrir
            </button>
            <button
              onClick={() => bgRef.current?.click()}
              className="flex-shrink-0 text-[9px] bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg active:scale-95 border border-blue-500/20">
              🖼 Fondo
            </button>
            <button
              onClick={async () => {
                const current = room.max_seats || 9;
                const opts = user.role === 'dueño' ? [6, 9, 12, 16, 20] : [6, 9, 12, 16];
                const pick = window.prompt(`Micros (actual: ${current}). Opciones: ${opts.join(', ')}`, String(current));
                if (!pick) return;
                const n = parseInt(pick, 10);
                if (!opts.includes(n)) { alert(`Opciones válidas: ${opts.join(', ')}`); return; }
                try {
                  await axios.post(`${API}/admin/console/expand-room?admin_id=${user.id}&room_id=${room.id}&max_seats=${n}`);
                  loadRoom();
                } catch (e) { alert(e.response?.data?.detail || 'Error'); }
              }}
              className="flex-shrink-0 text-[9px] bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-lg active:scale-95 border border-purple-500/20">
              🎤 {room.max_seats || 9}
            </button>
            <button
              onClick={async () => {
                const isPriv = room.is_private || room.has_password;
                if (isPriv) {
                  if (!window.confirm('¿Hacer sala pública?')) return;
                  await axios.put(`${API}/rooms/${room.id}/privacy?user_id=${user.id}&is_private=false&password=`).catch(() => {});
                } else {
                  const pwd = window.prompt('Contraseña para sala privada (mín. 3 chars):');
                  if (!pwd || pwd.length < 3) return;
                  await axios.put(`${API}/rooms/${room.id}/privacy?user_id=${user.id}&is_private=true&password=${encodeURIComponent(pwd)}`).catch(() => {});
                }
                loadRoom();
              }}
              className={`flex-shrink-0 text-[9px] px-2.5 py-1 rounded-lg active:scale-95 border ${
                (room.is_private || room.has_password)
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/20'
                  : 'bg-gray-500/20 text-gray-300 border-gray-500/20'
              }`}>
              {(room.is_private || room.has_password) ? '🔒 Privada' : '🔓 Pública'}
            </button>
            {user.role === 'dueño' && (
              <button onClick={toggleBot}
                className={`flex-shrink-0 text-[9px] px-2.5 py-1 rounded-lg active:scale-95 border ${
                  botOn ? 'bg-green-500/20 text-green-300 border-green-500/20' : 'bg-gray-500/20 text-gray-300 border-gray-500/20'
                }`}>
                🤖 Bot {botOn ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
        )}

        {/* ── PREMIUM SEATS GRID ─────────────────────── */}
        <div className="mt-4 px-0">
          <PremiumSeatsGrid
            seats={room.seats || []}
            maxSeats={room.max_seats || room.seats?.length || 9}
            user={user}
            speakingSeats={speakingSeats}
            roomOwnerId={room.owner_id}
            isHostMode={isHost}
            onSeatPress={handleSeatPress}
            onHostAction={(idx, seat) => {
              const canLock = room.owner_id === user.id || user.role === 'dueño' || user.is_super_admin;
              if (canLock) {
                axios.post(`${API}/rooms/${roomId}/lock-seat?owner_id=${user.id}&seat_index=${idx}`).then(() => loadRoom());
              }
            }}
          />
        </div>

        {/* ── LISTENERS STRIP ───────────────────────── */}
        <div className="px-4 py-2 mt-2">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              👥 {room.active_users || 0}
            </span>
            <div className="flex items-center gap-1 overflow-hidden">
              {(room.seats || []).filter(s => s?.user_id && s.user_id !== user.id).slice(0, 6).map((s, i) => (
                <img key={i} src={s.avatar} alt="" onClick={() => setProfileTarget(s)}
                  className="w-6 h-6 rounded-full border border-white/10 flex-shrink-0 cursor-pointer active:scale-90"
                  style={{ objectFit: 'cover' }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── FLOATING CHAT OVERLAY ─────────────────── */}
        <div style={{ position: 'relative', minHeight: 80, paddingBottom: 4 }}>
          <FloatingChat
            messages={enrichedMessages}
            maxVisible={5}
          />
        </div>
      </div>

      {/* ────────────────────────────────────────────────────
       *  RIGHT SIDE PANEL (quick buttons)
       * ────────────────────────────────────────────────── */}
      <RightSidePanel onAction={handleQuickAction} />

      {/* ────────────────────────────────────────────────────
       *  GIFT FAB — always visible
       * ────────────────────────────────────────────────── */}
      <GiftButton
        onClick={() => { setGiftTarget(null); setPanel('gifts-all'); }}
        coinsBalance={user.coins}
      />

      {/* ────────────────────────────────────────────────────
       *  PREMIUM BOTTOM BAR
       * ────────────────────────────────────────────────── */}
      <BottomBar
        chatInput={chatInput}
        onChatChange={setChatInput}
        onSendChat={sendChat}
        showChatInput={showChatInput}
        onToggleChat={() => setShowChatInput(v => !v)}
        isMuted={isMuted}
        audioStatus={audioStatus}
        onToggleMic={mySeat !== null ? toggleMute : () => {}}
        mySeat={mySeat}
        onRequestSeat={() => {
          const emptyIdx = (room.seats || []).findIndex(s => !s?.user_id && !s?.is_locked);
          if (emptyIdx >= 0) joinSeat(emptyIdx);
        }}
        onOpenGifts={() => { setGiftTarget(null); setPanel('gifts-all'); }}
        onOpenMusic={() => musicRef.current?.click()}
        onOpenGames={() => setPanel('games')}
        isHost={isHost}
        onHostTools={() => setShowHostBar(v => !v)}
        unreadCount={0}
      />

      {/* ── Hidden file inputs ─────────────────────── */}
      <input ref={photoRef} type="file" accept="image/*" onChange={sendPhoto} className="hidden" data-testid="photo-upload" />
      <input ref={musicRef} type="file" accept="audio/*" onChange={uploadMusic} className="hidden" />
      <input ref={bgRef}    type="file" accept="image/*" onChange={uploadBackground} className="hidden" />

      {/* ── Hidden audio element ───────────────────── */}
      {room.music_url && (
        <audio
          ref={audioElementRef}
          src={room.music_url.startsWith('/api')
            ? `${process.env.REACT_APP_BACKEND_URL}${room.music_url}`
            : room.music_url}
          onEnded={() => setMusicPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
};

export default RoomView;
