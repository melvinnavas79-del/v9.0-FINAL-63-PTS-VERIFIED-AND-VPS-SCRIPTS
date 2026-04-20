import React from 'react';
import CrownBadge from './CrownBadge';

/**
 * SeatsGrid — Renderiza la cuadrícula de asientos (10 o 24) de la sala.
 * Mantiene el diseño con anillo neón verde cuando el usuario habla,
 * candado cuando está bloqueado, y SVIP badge en la esquina.
 *
 * Este componente es "presentacional" — toda la lógica de click (entrar/salir/bloquear/
 * abrir perfil/abrir regalo) se recibe por props desde RoomView.
 */
const SeatsGrid = ({
  room,
  currentUserId,
  isMuted,
  onSeatClick,
  onSeatLongPress,
}) => {
  const maxSeats = room.max_seats || 10;
  const seats = (room.seats || []).slice(0, maxSeats);
  const cols = maxSeats <= 10 ? 3 : 6;
  const circleSize = maxSeats <= 10 ? 'w-[72px] h-[72px]' : 'w-[52px] h-[52px]';
  const avatarSize = maxSeats <= 10 ? 'w-[52px] h-[52px]' : 'w-[36px] h-[36px]';
  const labelSize = maxSeats <= 10 ? 'text-[11px]' : 'text-[8px]';

  return (
    <>
      <style>{`
        @keyframes neonPulse {
          0%, 100% { box-shadow: 0 0 8px #00ff88, 0 0 20px #00ff8855, 0 0 40px #00ff8822; }
          50%      { box-shadow: 0 0 12px #00ff88, 0 0 30px #00ff8877, 0 0 50px #00ff8833; }
        }
        .seat-speaking { animation: neonPulse 1.5s ease-in-out infinite; border-color: #00ff88 !important; }
      `}</style>
      <div
        className="grid justify-items-center gap-y-3"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: maxSeats <= 10 ? '16px 8px' : '8px 4px',
        }}
      >
        {seats.map((seat, i) => {
          const isLocked = room.seat_locks?.[i];
          // Modo Fantasma: si el seat está ocupado por un usuario invisible y NO
          // soy yo mismo, lo renderizo como asiento VACÍO para el resto del mundo.
          const hideGhost = seat && seat.ghost && seat.user_id !== currentUserId;
          const effectiveSeat = hideGhost ? null : seat;
          const isSpeaking = effectiveSeat && effectiveSeat.user_id === currentUserId && !isMuted;
          const isOccupied = !!effectiveSeat;
          return (
            <div key={i} className="flex flex-col items-center">
              <button
                data-testid={`seat-btn-${i}`}
                onClick={() => onSeatClick(i, effectiveSeat, isLocked)}
                onContextMenu={(e) => { e.preventDefault(); if (effectiveSeat) onSeatLongPress(effectiveSeat); }}
                className={`${circleSize} rounded-full border-[3px] flex items-center justify-center transition-all relative ${
                  isLocked && !effectiveSeat
                    ? 'bg-gray-800/60 border-red-500/30'
                    : isSpeaking
                    ? 'bg-gray-800 seat-speaking border-green-400'
                    : isOccupied
                    ? 'bg-gray-800 border-gray-600/50'
                    : 'bg-gray-800/80 border-gray-700/40'
                }`}
                style={isSpeaking ? { boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff8855' } : {}}
              >
                {effectiveSeat ? (
                  <>
                    <img
                      src={effectiveSeat.avatar}
                      alt=""
                      className={`${avatarSize} rounded-full object-cover ${effectiveSeat.ghost ? 'opacity-50 ring-2 ring-purple-400' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onSeatLongPress(effectiveSeat); }}
                    />
                    {effectiveSeat.ghost && effectiveSeat.user_id === currentUserId && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[7px] font-bold px-1 rounded-full" title="Invisible — solo tú te ves">
                        👻 TÚ
                      </div>
                    )}
                  </>
                ) : isLocked ? (
                  <span className="text-red-400/50 text-lg">🔒</span>
                ) : (
                  <svg className="w-8 h-8 text-blue-300/40" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
                {effectiveSeat?.svip_level > 0 && (
                  <div className="absolute -top-1 -right-1 bg-yellow-500 text-[6px] text-black font-bold px-1 rounded-full">
                    S{effectiveSeat.svip_level}
                  </div>
                )}
              </button>
              <div className="mt-1 text-center">
                {effectiveSeat ? (
                  <div className="flex items-center gap-0.5 justify-center">
                    {effectiveSeat.country_flag && <span className="text-[10px]">{effectiveSeat.country_flag}</span>}
                    <CrownBadge userId={effectiveSeat.user_id} size={11} />
                    <span className={`text-white/80 ${labelSize} font-medium truncate max-w-[70px]`}>
                      {effectiveSeat.username}
                    </span>
                  </div>
                ) : (
                  <span className={`text-white/25 ${labelSize}`}>Silla {i + 1}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default SeatsGrid;
