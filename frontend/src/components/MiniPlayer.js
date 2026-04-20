import React from 'react';
import { useAudio } from '../contexts/AudioContext';

/**
 * Floating mini-player that stays visible when a user is connected to a room
 * but has navigated away to another page (Home, Rankings, Store, etc.).
 * Allows quick mute/unmute and returning to the room without dropping the WebRTC call.
 */
const MiniPlayer = ({ visible, onOpenRoom }) => {
  const { activeRoom, audioStatus, isMuted, toggleMute, leaveRoom, mySeat } = useAudio();

  if (!visible || !activeRoom) return null;

  const dotColor = audioStatus === 'on' ? 'bg-green-400' : audioStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div
      data-testid="global-mini-player"
      className="fixed left-3 right-3 z-[60]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 12px) + 76px)' }}
    >
      <div className="bg-gray-900/95 backdrop-blur rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 px-3 py-2 flex items-center gap-2">
        {/* Status dot + pulsing */}
        <div className="relative flex-shrink-0">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} block`} />
          {audioStatus === 'on' && (
            <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-60" />
          )}
        </div>

        {/* Room info */}
        <button
          data-testid="mini-player-open"
          onClick={() => onOpenRoom(activeRoom.roomId)}
          className="flex-1 min-w-0 text-left active:scale-[0.98] transition-transform"
        >
          <div className="text-[10px] text-cyan-300/70 leading-tight uppercase tracking-wider">En sala · tocar para volver</div>
          <div className="text-white text-sm font-bold truncate">🎙 {activeRoom.roomName || 'Sala activa'}</div>
        </button>

        {/* Mute toggle (only if seated with mic) */}
        {mySeat !== null && (
          <button
            data-testid="mini-player-mute"
            onClick={toggleMute}
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-base shadow-md active:scale-90 transition-transform ${
              isMuted ? 'bg-red-500' : 'bg-green-500'
            }`}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
        )}

        {/* Disconnect */}
        <button
          data-testid="mini-player-leave"
          onClick={leaveRoom}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-red-600/80 flex items-center justify-center text-white text-sm active:scale-90 transition-transform"
          title="Desconectar"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
