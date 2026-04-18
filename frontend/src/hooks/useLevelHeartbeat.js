import { useEffect, useRef } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * useLevelHeartbeat — envía 1 heartbeat/minuto al backend mientras el usuario
 * esté en una sala con micrófono activo. Backend suma 10 XP (capped).
 */
export default function useLevelHeartbeat({ userId, isInRoomMicActive }) {
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!userId || !isInRoomMicActive) return;
    const beat = async () => {
      const now = Date.now();
      if (now - lastSentRef.current < 55000) return;
      lastSentRef.current = now;
      try { await axios.post(`${API}/levels/heartbeat/${userId}`); } catch (e) { /* silent */ }
    };
    beat(); // send immediately on mount
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
  }, [userId, isInRoomMicActive]);
}
