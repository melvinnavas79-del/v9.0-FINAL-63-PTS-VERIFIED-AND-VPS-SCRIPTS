/* =========================================================
 * Lluvia Live — Design Tokens v1.0
 * Sistema de diseño premium. Única fuente de verdad visual.
 * ========================================================= */

// ── Colores base ──────────────────────────────────────────
export const COLORS = {
  bg:           '#0A0B0F',
  bgCard:       '#111217',
  bgElevated:   '#1A1B23',
  bgGlass:      'rgba(255,255,255,0.06)',
  bgGlassDark:  'rgba(0,0,0,0.45)',

  purple:       '#7C3AED',
  purpleLight:  '#9F67FF',
  purpleDim:    'rgba(124,58,237,0.25)',

  pink:         '#EC4899',
  pinkDim:      'rgba(236,72,153,0.25)',

  gold:         '#F59E0B',
  goldLight:    '#FCD34D',
  goldDim:      'rgba(245,158,11,0.25)',

  green:        '#10B981',
  greenDim:     'rgba(16,185,129,0.3)',

  red:          '#EF4444',
  redDim:       'rgba(239,68,68,0.25)',

  blue:         '#3B82F6',
  blueDim:      'rgba(59,130,246,0.25)',

  white:        '#FFFFFF',
  white80:      'rgba(255,255,255,0.8)',
  white60:      'rgba(255,255,255,0.6)',
  white40:      'rgba(255,255,255,0.4)',
  white20:      'rgba(255,255,255,0.2)',
  white10:      'rgba(255,255,255,0.1)',
  white06:      'rgba(255,255,255,0.06)',
};

// ── Gradientes ───────────────────────────────────────────
export const GRADIENTS = {
  roomDefault:  'linear-gradient(160deg, #1a0533 0%, #0d1117 45%, #0a1628 100%)',
  roomPurple:   'linear-gradient(160deg, #1a0533 0%, #12052a 50%, #0a0b0f 100%)',
  roomBlue:     'linear-gradient(160deg, #030d1f 0%, #061428 50%, #0a0b0f 100%)',
  roomGold:     'linear-gradient(160deg, #1a1005 0%, #0f0a02 50%, #0a0b0f 100%)',
  roomRose:     'linear-gradient(160deg, #1f0515 0%, #130310 50%, #0a0b0f 100%)',

  brand:        'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
  brandReverse: 'linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)',
  gold:         'linear-gradient(135deg, #F59E0B 0%, #D97706 55%, #92400E 100%)',
  svip:         'linear-gradient(135deg, #FFD700 0%, #FF8C00 50%, #FF4500 100%)',
  speaking:     'linear-gradient(135deg, #10B981 0%, #059669 100%)',

  glassHeader:  'linear-gradient(180deg, rgba(10,11,15,0.95) 0%, rgba(10,11,15,0.7) 100%)',
  glassBottom:  'linear-gradient(0deg, rgba(10,11,15,0.98) 0%, rgba(10,11,15,0.7) 100%)',
  glassSeat:    'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
};

// ── Sombras ───────────────────────────────────────────────
export const SHADOWS = {
  card:         '0 4px 24px rgba(0,0,0,0.5)',
  cardHover:    '0 8px 40px rgba(0,0,0,0.6)',
  purple:       '0 0 30px rgba(124,58,237,0.4)',
  pink:         '0 0 30px rgba(236,72,153,0.4)',
  gold:         '0 0 40px rgba(245,158,11,0.5)',
  speaking:     '0 0 20px rgba(16,185,129,0.6)',
  svip:         '0 0 60px rgba(245,158,11,0.5)',
  legendary:    '0 0 80px rgba(255,100,0,0.6)',
};

// ── Z-Index layers ────────────────────────────────────────
export const Z = {
  background:   0,
  seats:        10,
  listeners:    15,
  header:       20,
  bottomBar:    20,
  rightPanel:   25,
  chat:         30,
  giftButton:   35,
  sheet:        40,
  hostPanel:    45,
  quickPanel:   45,
  giftAnim:     50,
  legendaryAnim:60,
};

// ── Grid de asientos ──────────────────────────────────────
export const SEAT_CONFIGS = {
  6:  { cols: 3, totalSeats: 6,  hostSeats: 3, label: '6'  },
  9:  { cols: 3, totalSeats: 9,  hostSeats: 3, label: '9'  },
  12: { cols: 4, totalSeats: 12, hostSeats: 4, label: '12' },
  16: { cols: 4, totalSeats: 16, hostSeats: 4, label: '16' },
  20: { cols: 5, totalSeats: 20, hostSeats: 5, label: '20' },
  // Preparados para futuro
  24: { cols: 6, totalSeats: 24, hostSeats: 6, label: '24' },
  30: { cols: 6, totalSeats: 30, hostSeats: 6, label: '30' },
  40: { cols: 8, totalSeats: 40, hostSeats: 8, label: '40' },
};

export function getSeatConfig(maxSeats) {
  const key = [6,9,12,16,20,24,30,40].find(k => k >= maxSeats) || 20;
  return SEAT_CONFIGS[key] || SEAT_CONFIGS[20];
}

// ── Sistema VIP / Aristocracia ────────────────────────────
// aristocracy: 0-9
export const ARISTOCRACY_TIERS = [
  { min: 0, max: 0,  label: '',       color: null,       glow: null },
  { min: 1, max: 2,  label: 'VIP',    color: '#6366F1',  glow: 'rgba(99,102,241,0.5)'  },
  { min: 3, max: 4,  label: 'VIP2',   color: '#8B5CF6',  glow: 'rgba(139,92,246,0.5)'  },
  { min: 5, max: 6,  label: 'SVIP',   color: '#F59E0B',  glow: 'rgba(245,158,11,0.6)'  },
  { min: 7, max: 8,  label: 'SVIP+',  color: '#F97316',  glow: 'rgba(249,115,22,0.6)'  },
  { min: 9, max: 9,  label: 'NOBLE',  color: '#EF4444',  glow: 'rgba(239,68,68,0.7)'   },
];

export function getAristocracyTier(aristocracy = 0) {
  return ARISTOCRACY_TIERS.findLast(t => aristocracy >= t.min) || ARISTOCRACY_TIERS[0];
}

// ── Marcos VIP ─────────────────────────────────────────────
// frame: 'none' | 'silver' | 'gold' | 'purple' | 'vip' | 'svip' | 'legendary'
export function getFrame(level = 1, aristocracy = 0, role = '') {
  if (role === 'dueño') return 'legendary';
  if (aristocracy >= 9)  return 'legendary';
  if (aristocracy >= 7)  return 'svip';
  if (aristocracy >= 5)  return 'vip';
  if (aristocracy >= 3)  return 'purple';
  if (level >= 70)       return 'gold';
  if (level >= 40)       return 'silver';
  return 'none';
}

export const FRAME_STYLES = {
  none:      { border: 'none',          shadow: 'none',                       animated: false },
  silver:    { border: '2px solid #9CA3AF', shadow: '0 0 8px rgba(156,163,175,0.5)',  animated: false },
  gold:      { border: '2px solid #F59E0B', shadow: '0 0 12px rgba(245,158,11,0.6)', animated: false },
  purple:    { border: '2px solid #8B5CF6', shadow: '0 0 14px rgba(139,92,246,0.6)', animated: false },
  vip:       { border: '2px solid #6366F1', shadow: '0 0 16px rgba(99,102,241,0.7)', animated: false },
  svip:      { border: '2px solid transparent', shadow: '0 0 24px rgba(245,158,11,0.8)', animated: true, gradient: 'linear-gradient(#111217,#111217) padding-box, linear-gradient(135deg,#FFD700,#FF8C00,#FF4500) border-box' },
  legendary: { border: '2px solid transparent', shadow: '0 0 40px rgba(239,68,68,0.8)', animated: true, gradient: 'linear-gradient(#111217,#111217) padding-box, linear-gradient(135deg,#FFD700,#EC4899,#7C3AED) border-box' },
};

// ── Verificación ──────────────────────────────────────────
export function getVerificationBadge(isVerified, role) {
  if (role === 'dueño')    return { icon: '👑', title: 'Dueño Oficial',    color: '#FFD700' };
  if (role === 'admin')    return { icon: '⭐', title: 'Admin Oficial',    color: '#F59E0B' };
  if (isVerified === 'premium') return { icon: '💎', title: 'Verificado Premium', color: '#7C3AED' };
  if (isVerified === true || isVerified === 'standard') return { icon: '✅', title: 'Verificado', color: '#3B82F6' };
  return null;
}

// ── Niveles de usuario ────────────────────────────────────
export function getLevelColor(level = 1) {
  if (level >= 90) return '#EF4444';
  if (level >= 70) return '#F59E0B';
  if (level >= 50) return '#8B5CF6';
  if (level >= 30) return '#3B82F6';
  if (level >= 10) return '#10B981';
  return '#6B7280';
}

export function getLevelLabel(level = 1) {
  if (level >= 90) return '🔥';
  if (level >= 70) return '👑';
  if (level >= 50) return '💎';
  if (level >= 30) return '⭐';
  if (level >= 10) return '🎯';
  return '🌱';
}

// ── Tipos de entrada ──────────────────────────────────────
export function getEntryAnimationType(aristocracy = 0, role = '') {
  if (role === 'dueño')   return 'legendary';
  if (aristocracy >= 7)   return 'svip';
  if (aristocracy >= 5)   return 'vip';
  if (aristocracy >= 1)   return 'premium';
  return 'normal';
}

// ── Roles en sala ─────────────────────────────────────────
export function getSeatRoleLabel(seatIndex, hostSeats, roomOwnerId, userId) {
  if (userId && userId === roomOwnerId) return 'HOST';
  if (seatIndex < hostSeats)            return 'HOST';
  return 'MIC';
}
