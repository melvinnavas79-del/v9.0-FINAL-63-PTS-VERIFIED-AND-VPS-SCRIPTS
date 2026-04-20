/**
 * AudioContext — 100% self-hosted WebRTC audio rooms.
 * ====================================================
 * Reemplaza Agora.io con WebRTC nativo del navegador + signaling via WebSocket
 * al backend FastAPI de Melvin. Zero costo variable, zero dependencia externa.
 *
 * Topología: mesh P2P. Viable hasta ~10 hablantes activos por sala.
 * Usa "perfect negotiation" (https://w3c.github.io/webrtc-pc/#perfect-negotiation-example)
 * para resolver glare cuando múltiples peers renegocian simultáneamente.
 *
 * API (idéntica a la anterior para no romper RoomView ni MiniPlayer):
 *   { activeRoom, audioStatus, isMuted, isDeafened, mySeat, setMySeat,
 *     joinRoom, leaveRoom, toggleMute, toggleDeafen }
 */
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND}/api`;

const buildWsUrl = (roomId, userId) => {
  const proto = BACKEND.startsWith('https') ? 'wss' : 'ws';
  const host = BACKEND.replace(/^https?:\/\//, '');
  return `${proto}://${host}/api/ws/audio/${encodeURIComponent(roomId)}?user_id=${encodeURIComponent(userId)}`;
};

const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
  const [activeRoom, setActiveRoom] = useState(null);
  const [audioStatus, setAudioStatus] = useState('off');
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [mySeat, setMySeat] = useState(null);

  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  // user_id -> { pc, makingOffer, polite, audio }
  const peersRef = useRef(new Map());
  const iceConfigRef = useRef({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const autoMuteRef = useRef(null);
  const activeRoomRef = useRef(null);
  const userIdRef = useRef(null);
  const isDeafenedRef = useRef(false);

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { isDeafenedRef.current = isDeafened; }, [isDeafened]);

  const sendSignal = (payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const closePeer = (peerId) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    try { entry.pc.close(); } catch (e) {}
    if (entry.audio) {
      try { entry.audio.pause(); entry.audio.srcObject = null; entry.audio.remove(); } catch (e) {}
    }
    peersRef.current.delete(peerId);
  };

  const closeAllPeers = () => {
    Array.from(peersRef.current.keys()).forEach(closePeer);
  };

  const attachLocalTracks = (pc) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const existing = new Set(pc.getSenders().map((s) => s.track?.id).filter(Boolean));
    stream.getAudioTracks().forEach((track) => {
      if (!existing.has(track.id)) {
        try { pc.addTrack(track, stream); } catch (e) {}
      }
    });
  };

  const createPeer = (peerId) => {
    if (peersRef.current.has(peerId)) return peersRef.current.get(peerId);

    const pc = new RTCPeerConnection(iceConfigRef.current);
    // "polite" peer = lower user_id. El polite es quien hace rollback en glare.
    const myId = userIdRef.current || '';
    const polite = myId < peerId;

    const entry = { pc, makingOffer: false, polite, audio: null, ignoreOffer: false };
    peersRef.current.set(peerId, entry);

    // Asegurar que siempre podemos recibir audio
    try { pc.addTransceiver('audio', { direction: 'recvonly' }); } catch (e) {}

    // Si ya tengo mic abierto, publicar
    attachLocalTracks(pc);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({ type: 'ice', to: peerId, candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      let audio = entry.audio;
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = isDeafenedRef.current;
        document.body.appendChild(audio);
        entry.audio = audio;
      }
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    };

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        sendSignal({ type: 'offer', to: peerId, sdp: pc.localDescription });
      } catch (err) {
        // noop
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeer(peerId);
      }
    };

    return entry;
  };

  const handleSignal = async (msg) => {
    const mtype = msg.type;

    if (mtype === 'peers') {
      const myId = userIdRef.current;
      (msg.peers || []).forEach((pid) => {
        if (pid !== myId) createPeer(pid);
      });
      return;
    }

    if (mtype === 'peer-joined') {
      const pid = msg.user_id;
      if (pid !== userIdRef.current) createPeer(pid);
      return;
    }

    if (mtype === 'peer-left') {
      closePeer(msg.user_id);
      return;
    }

    if (mtype === 'offer' || mtype === 'answer') {
      const from = msg.from;
      const entry = peersRef.current.get(from) || createPeer(from);
      const pc = entry.pc;
      try {
        const description = msg.sdp;
        // Perfect negotiation: detectar colisión de ofertas
        const readyForOffer = !entry.makingOffer && (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer');
        const offerCollision = description.type === 'offer' && !readyForOffer;
        entry.ignoreOffer = !entry.polite && offerCollision;
        if (entry.ignoreOffer) return;

        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          sendSignal({ type: 'answer', to: from, sdp: pc.localDescription });
        }
      } catch (err) {
        // ignore
      }
      return;
    }

    if (mtype === 'ice') {
      const entry = peersRef.current.get(msg.from);
      if (entry && msg.candidate) {
        try {
          await entry.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (err) {
          if (!entry.ignoreOffer) {
            // ignora silenciosamente los candidates que no pertenecen al estado actual
          }
        }
      }
      return;
    }
  };

  const leaveRoom = useCallback(async () => {
    clearTimeout(autoMuteRef.current);
    autoMuteRef.current = null;

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'leave' }));
      }
      wsRef.current?.close();
    } catch (e) {}
    wsRef.current = null;

    closeAllPeers();

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
      localStreamRef.current = null;
    }

    setAudioStatus('off');
    setActiveRoom(null);
    setMySeat(null);
    setIsMuted(true);
    setIsDeafened(false);
    userIdRef.current = null;
  }, []);

  const joinRoom = useCallback(async (roomId, roomName, userId) => {
    if (activeRoomRef.current?.roomId === roomId && wsRef.current) {
      if (roomName && activeRoomRef.current.roomName !== roomName) {
        setActiveRoom({ roomId, roomName, userId });
      }
      return;
    }
    if (activeRoomRef.current && activeRoomRef.current.roomId !== roomId) {
      await leaveRoom();
    }

    setAudioStatus('connecting');
    setActiveRoom({ roomId, roomName: roomName || '', userId });
    userIdRef.current = userId;

    // ICE config
    try {
      const c = await axios.get(`${API}/webrtc/config`);
      if (c.data?.iceServers?.length) iceConfigRef.current = { iceServers: c.data.iceServers };
    } catch (e) {}

    // WebSocket signaling
    try {
      const ws = new WebSocket(buildWsUrl(roomId, userId));
      wsRef.current = ws;
      ws.onopen = () => setAudioStatus('on');
      ws.onmessage = (ev) => {
        try { handleSignal(JSON.parse(ev.data)); } catch (e) {}
      };
      ws.onerror = () => setAudioStatus('error');
      ws.onclose = () => {
        if (wsRef.current === ws) setAudioStatus('error');
      };
    } catch (e) {
      setAudioStatus('error');
    }
  }, [leaveRoom]);

  const toggleMute = useCallback(async () => {
    if (audioStatus !== 'on') return;

    if (isMuted) {
      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
          localStreamRef.current = stream;
          // Publicar track a todos los peers existentes → dispara onnegotiationneeded
          peersRef.current.forEach((entry) => attachLocalTracks(entry.pc));
        } else {
          localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
        }
        setIsMuted(false);

        clearTimeout(autoMuteRef.current);
        autoMuteRef.current = setTimeout(() => {
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
            setIsMuted(true);
          }
        }, 2 * 60 * 1000);
      } catch (e) {
        // Permiso denegado o no hay mic
      }
    } else {
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
      setIsMuted(true);
      clearTimeout(autoMuteRef.current);
      autoMuteRef.current = null;
    }
  }, [audioStatus, isMuted]);

  const toggleDeafen = useCallback(() => {
    const next = !isDeafened;
    peersRef.current.forEach((entry) => {
      if (entry.audio) entry.audio.muted = next;
    });
    setIsDeafened(next);
  }, [isDeafened]);

  return (
    <AudioContext.Provider
      value={{
        activeRoom,
        audioStatus,
        isMuted,
        isDeafened,
        mySeat,
        setMySeat,
        joinRoom,
        leaveRoom,
        toggleMute,
        toggleDeafen,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);
