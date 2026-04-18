import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
  const [activeRoom, setActiveRoom] = useState(null); // { roomId, roomName, userId }
  const [audioStatus, setAudioStatus] = useState('off'); // off | connecting | on | error
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [mySeat, setMySeat] = useState(null);

  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const autoMuteRef = useRef(null);

  const leaveRoom = useCallback(async () => {
    try {
      clearTimeout(autoMuteRef.current);
      autoMuteRef.current = null;
      localTrackRef.current?.close();
      localTrackRef.current = null;
      await clientRef.current?.leave();
      clientRef.current = null;
    } catch (e) {
      // swallow
    }
    setAudioStatus('off');
    setActiveRoom(null);
    setMySeat(null);
    setIsMuted(true);
    setIsDeafened(false);
  }, []);

  const joinRoom = useCallback(async (roomId, roomName, userId) => {
    // If already connected to this room, just sync the display name & keep the session
    if (clientRef.current && activeRoom?.roomId === roomId) {
      if (roomName && activeRoom.roomName !== roomName) {
        setActiveRoom({ roomId, roomName, userId });
      }
      return;
    }
    // If in another room, leave first
    if (clientRef.current) {
      await leaveRoom();
    }
    try {
      setAudioStatus('connecting');
      const t = await axios.post(`${API}/agora/token?channel_name=room_${roomId}&user_id=${userId}`);
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;
      client.on('user-published', async (u, m) => {
        if (m === 'audio') {
          await client.subscribe(u, 'audio');
          u.audioTrack?.play();
        }
      });
      await client.join(t.data.app_id, `room_${roomId}`, t.data.token, t.data.uid);
      setAudioStatus('on');
      setIsMuted(true);
      setActiveRoom({ roomId, roomName, userId });
    } catch (e) {
      setAudioStatus('error');
      clientRef.current = null;
    }
  }, [activeRoom, leaveRoom]);

  const toggleMute = useCallback(async () => {
    if (!clientRef.current) return;
    if (isMuted) {
      // UNMUTE: create mic track on demand
      try {
        if (!localTrackRef.current) {
          const track = await AgoraRTC.createMicrophoneAudioTrack();
          localTrackRef.current = track;
          await clientRef.current.publish([track]);
        } else {
          localTrackRef.current.setEnabled(true);
        }
        setIsMuted(false);
        // Auto-mute after 2 min of open mic (battery + safety)
        clearTimeout(autoMuteRef.current);
        autoMuteRef.current = setTimeout(() => {
          if (localTrackRef.current) {
            localTrackRef.current.setEnabled(false);
            setIsMuted(true);
          }
        }, 2 * 60 * 1000);
      } catch (e) {
        // Mic permission denied or error
      }
    } else {
      // MUTE but keep connection alive
      localTrackRef.current?.setEnabled(false);
      setIsMuted(true);
      clearTimeout(autoMuteRef.current);
      autoMuteRef.current = null;
    }
  }, [isMuted]);

  const toggleDeafen = useCallback(() => {
    if (!clientRef.current) return;
    const newState = !isDeafened;
    clientRef.current.remoteUsers?.forEach((u) => {
      if (u.audioTrack) {
        if (newState) u.audioTrack.stop();
        else u.audioTrack.play();
      }
    });
    setIsDeafened(newState);
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
        clientRef,
        localTrackRef,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);
