import React, { memo, useMemo } from 'react';
import SeatSlot from './SeatSlot';
import { getSeatConfig } from '../../design/tokens';

/* Grid column configs per capacity */
const GRID_COLS = { 6: 3, 9: 3, 12: 4, 16: 4, 20: 5, 24: 6, 30: 6, 40: 8 };

function SeatsGrid({
  seats = [],
  maxSeats = 9,
  user,
  speakingSeats = new Set(),
  roomOwnerId,
  isHostMode = false,
  onSeatPress,
  onHostAction,
}) {
  const config = getSeatConfig(maxSeats);
  const { hostSeats } = config;
  const cols = GRID_COLS[maxSeats] || config.cols;

  /* Normalize seats array to exact maxSeats length */
  const normalized = useMemo(() => {
    return Array.from({ length: maxSeats }, (_, i) => {
      const s = seats[i];
      return (s && typeof s === 'object') ? s : null;
    });
  }, [seats, maxSeats]);

  const hostRow  = normalized.slice(0, hostSeats);
  const micSeats = normalized.slice(hostSeats);

  /* Host row always uses hostSeats cols */
  const hostCols = Math.min(hostSeats, 5);
  /* Mic rows use full cols */

  /* Avatar size based on capacity */
  const avatarSize = maxSeats <= 6 ? 72 : maxSeats <= 9 ? 60 : maxSeats <= 12 ? 52 : maxSeats <= 16 ? 46 : 40;
  const gap = maxSeats <= 9 ? 10 : maxSeats <= 16 ? 8 : 6;

  return (
    <div className="w-full flex flex-col" style={{ gap: 6, padding: '0 12px' }}>

      {/* ─── HOST ROW ─────────────────────────────────── */}
      <div style={{ position: 'relative', paddingTop: 14 }}>
        {/* HOST label */}
        <div className="absolute top-0 left-0 flex items-center gap-1.5" style={{ zIndex: 2 }}>
          <div style={{
            width: 3, height: 12, borderRadius: 2,
            background: 'linear-gradient(180deg, #f59e0b, #d97706)',
          }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(251,191,36,0.8)', letterSpacing: '0.1em' }}>
            HOST
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${hostCols}, 1fr)`,
          gap: `${gap}px`,
          padding: '6px 8px 10px',
          background: 'rgba(245,158,11,0.04)',
          borderRadius: 16,
          border: '1px solid rgba(245,158,11,0.1)',
        }}>
          {hostRow.map((seat, idx) => (
            <SeatSlot
              key={idx}
              seat={seat}
              index={idx}
              user={user}
              isSpeaking={speakingSeats.has(idx)}
              isHostSeat={true}
              roomOwnerId={roomOwnerId}
              isHostMode={isHostMode}
              onSeatPress={onSeatPress}
              onHostAction={onHostAction}
              size={avatarSize}
            />
          ))}
        </div>
      </div>

      {/* ─── MIC SEATS ────────────────────────────────── */}
      {micSeats.length > 0 && (
        <div style={{ position: 'relative', paddingTop: 14 }}>
          {/* MIC label */}
          <div className="absolute top-0 left-0 flex items-center gap-1.5" style={{ zIndex: 2 }}>
            <div style={{
              width: 3, height: 12, borderRadius: 2,
              background: 'linear-gradient(180deg, #8b5cf6, #6d28d9)',
            }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(167,139,250,0.75)', letterSpacing: '0.1em' }}>
              MICRÓFONOS
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: `${gap}px`,
            padding: '6px 8px 10px',
            background: 'rgba(139,92,246,0.03)',
            borderRadius: 16,
            border: '1px solid rgba(139,92,246,0.1)',
          }}>
            {micSeats.map((seat, idx) => {
              const globalIdx = hostSeats + idx;
              return (
                <SeatSlot
                  key={globalIdx}
                  seat={seat}
                  index={globalIdx}
                  user={user}
                  isSpeaking={speakingSeats.has(globalIdx)}
                  isHostSeat={false}
                  roomOwnerId={roomOwnerId}
                  isHostMode={isHostMode}
                  onSeatPress={onSeatPress}
                  onHostAction={onHostAction}
                  size={avatarSize}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SeatsGrid);
