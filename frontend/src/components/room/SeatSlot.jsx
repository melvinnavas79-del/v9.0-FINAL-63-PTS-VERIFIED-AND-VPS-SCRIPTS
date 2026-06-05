import React, { memo, useCallback } from 'react';
import { getFrame, FRAME_STYLES, getVerificationBadge, getLevelColor, getAristocracyTier } from '../../design/tokens';

/* ─── Speaking ring ─────────────────────────────────── */
function SpeakingRing() {
  return (
    <>
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{
        border: '2px solid rgba(52,211,153,0.9)',
        animation: 'speaking-ring 1.2s ease-in-out infinite',
        boxShadow: '0 0 12px rgba(52,211,153,0.6)',
      }} />
      <div className="absolute rounded-full pointer-events-none" style={{
        inset: -5, borderRadius: '50%',
        border: '1.5px solid rgba(52,211,153,0.35)',
        animation: 'speaking-ring-outer 1.5s ease-in-out infinite 0.3s',
      }} />
    </>
  );
}

/* ─── VIP frame overlay ──────────────────────────────── */
function VIPFrame({ type }) {
  if (!type || type === 'none') return null;
  const s = FRAME_STYLES[type];
  if (!s) return null;
  return (
    <div className="absolute inset-0 rounded-full pointer-events-none" style={{
      background: s.gradient || 'transparent',
      border: s.gradient ? '2.5px solid transparent' : s.border,
      boxShadow: s.shadow,
      borderRadius: '50%',
    }} />
  );
}

/* ─── Role crown (top of avatar) ─────────────────────── */
function RoleCrown({ isHost, isOwner }) {
  if (!isHost && !isOwner) return null;
  return (
    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 text-[10px]"
      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}>
      {isOwner ? '👑' : '🎤'}
    </div>
  );
}

/* ─── Mic indicator (bottom right of avatar) ────────── */
function MicDot({ isMuted, isLocked, isSpeaking }) {
  const bg = isLocked ? '#ef4444'
    : isSpeaking  ? '#34d399'
    : isMuted     ? '#6b7280'
    : 'rgba(255,255,255,0.2)';
  const icon = isLocked ? '🔒' : isSpeaking ? '🎙' : isMuted ? '🔇' : '🎤';
  return (
    <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center"
      style={{
        width: 16, height: 16, borderRadius: '50%',
        background: bg,
        border: '1.5px solid rgba(0,0,0,0.5)',
        fontSize: 7, lineHeight: 1,
        boxShadow: isSpeaking ? '0 0 6px rgba(52,211,153,0.7)' : 'none',
      }}>
      {icon}
    </div>
  );
}

/* ─── Empty seat ─────────────────────────────────────── */
function EmptySeat({ isHost, isLocked, onClick, size }) {
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
      onClick={onClick} style={{ width: '100%' }}>
      <div style={{
        width: '100%', aspectRatio: '1', borderRadius: '50%',
        background: isLocked
          ? 'rgba(239,68,68,0.08)'
          : isHost
          ? 'rgba(245,158,11,0.12)'
          : 'rgba(139,92,246,0.08)',
        border: isLocked
          ? '1.5px dashed rgba(239,68,68,0.5)'
          : isHost
          ? '1.5px dashed rgba(245,158,11,0.55)'
          : '1.5px dashed rgba(139,92,246,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isHost
          ? 'inset 0 0 18px rgba(245,158,11,0.10), 0 0 8px rgba(245,158,11,0.08)'
          : 'inset 0 0 14px rgba(139,92,246,0.07)',
      }}>
        <span style={{
          fontSize: size > 56 ? 17 : 13,
          opacity: isHost ? 0.55 : 0.4,
          color: isLocked ? '#ef4444' : isHost ? '#f59e0b' : '#a78bfa',
        }}>
          {isLocked ? '🔒' : '+'}
        </span>
      </div>
      <span style={{
        fontSize: 9,
        color: isHost ? 'rgba(245,158,11,0.45)' : 'rgba(167,139,250,0.35)',
        lineHeight: 1, fontWeight: 600,
      }}>
        {isLocked ? 'Cerrado' : isHost ? 'Host' : 'Libre'}
      </span>
    </div>
  );
}

/* ─── Occupied seat ──────────────────────────────────── */
function OccupiedSeat({ seat, isMe, isHost, isOwner, isSpeaking, size, onLongPress }) {
  const level      = seat.level || 1;
  const aristo     = seat.aristocracy || 0;
  const role       = seat.role || 'usuario';
  const frame      = getFrame(level, aristo, role);
  const arist      = getAristocracyTier(aristo);
  const levelColor = getLevelColor(level);
  const verif      = getVerificationBadge(seat.is_verified, role);

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: '100%' }}
      onContextMenu={e => { e.preventDefault(); onLongPress?.(); }}>

      {/* Avatar circle */}
      <div className="relative" style={{ width: '100%', aspectRatio: '1' }}>
        {/* Speaking rings */}
        {isSpeaking && <SpeakingRing />}

        {/* Host glow */}
        {isHost && !isSpeaking && (
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{
            boxShadow: '0 0 18px rgba(245,158,11,0.25)',
            borderRadius: '50%',
          }} />
        )}

        {/* Avatar */}
        <div className="absolute inset-0 rounded-full overflow-hidden" style={{
          background: '#1a1b23',
          border: isMe
            ? '2px solid rgba(139,92,246,0.9)'
            : isHost
            ? '1.5px solid rgba(245,158,11,0.5)'
            : '1.5px solid rgba(255,255,255,0.08)',
        }}>
          {seat.avatar ? (
            <img src={seat.avatar} alt={seat.username}
              className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: '#1e1f2e', fontSize: size > 56 ? 20 : 14 }}>
              👤
            </div>
          )}
        </div>

        {/* VIP frame */}
        <VIPFrame type={frame} />

        {/* Mic dot */}
        <MicDot isMuted={seat.is_muted} isLocked={seat.is_locked} isSpeaking={isSpeaking} />

        {/* Role crown */}
        <RoleCrown isHost={isHost} isOwner={isOwner} />
      </div>

      {/* Username */}
      <div className="flex items-center gap-0.5 w-full justify-center px-0.5">
        <span className="truncate" style={{
          fontSize: 10, fontWeight: 600, lineHeight: 1.2,
          color: isMe ? 'rgba(167,139,250,1)' : 'rgba(255,255,255,0.85)',
          maxWidth: '80%',
        }}>
          {seat.username || '…'}
        </span>
        {verif && <span style={{ fontSize: 9 }}>{verif.icon}</span>}
      </div>

      {/* Level + VIP */}
      <div className="flex items-center gap-1 justify-center">
        <span style={{ fontSize: 8.5, color: levelColor, fontWeight: 700 }}>
          Lv.{level}
        </span>
        {arist.label && (
          <span style={{
            fontSize: 7.5, fontWeight: 800, color: arist.color,
            background: `${arist.glow}30`,
            border: `1px solid ${arist.color}50`,
            borderRadius: 3, padding: '0 3px', lineHeight: '13px',
          }}>
            {arist.label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Main SeatSlot ──────────────────────────────────── */
function SeatSlot({ seat, index, user, isSpeaking, isHostSeat, roomOwnerId, isHostMode, onSeatPress, onHostAction, size = 60 }) {
  const isEmpty  = !seat || !seat.user_id;
  const isMe     = seat?.user_id === user?.id;
  const isOwner  = seat?.user_id === roomOwnerId;

  const handlePress = useCallback(() => {
    onSeatPress?.(index, seat);
  }, [index, seat, onSeatPress]);

  return (
    <div className="flex flex-col items-center" style={{ width: '100%', cursor: 'pointer' }}
      onClick={handlePress}>
      {isEmpty ? (
        <EmptySeat
          isHost={isHostSeat}
          isLocked={seat?.is_locked}
          onClick={handlePress}
          size={size}
        />
      ) : (
        <OccupiedSeat
          seat={seat}
          isMe={isMe}
          isHost={isHostSeat}
          isOwner={isOwner}
          isSpeaking={isSpeaking}
          size={size}
          onLongPress={() => isHostMode && onHostAction?.(index, seat)}
        />
      )}
    </div>
  );
}

export default memo(SeatSlot);
