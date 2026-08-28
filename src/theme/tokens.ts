export const colors = {
  canvas: '#F5F3EE',
  surface: '#FFFFFF',
  surfaceMuted: '#ECE9E1',
  ink: '#171915',
  inkMuted: '#666A61',
  border: '#D8D4CA',
  success: '#176B45',
  successSurface: '#DFF4E8',
  danger: '#9A342B',
  dangerSurface: '#F9E3DF',
  accent: '#272E25',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 28,
  pill: 999,
} as const;

export const typography = {
  display: 44,
  title: 28,
  body: 17,
  label: 14,
  small: 12,
} as const;

export const motion = {
  quick: 150,
  standard: 240,
  deliberate: 360,
  swipeThreshold: 96,
} as const;
