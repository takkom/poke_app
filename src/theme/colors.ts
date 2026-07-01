const marketplaceColors = {
  ebay: '#0064d2',
  kream: '#ef4444',
  snkrdunk: '#14b8a6',
} as const;

export const darkColors = {
  primary: '#3b82f6',
  background: '#0f172a',
  surface: '#1e293b',
  surfaceMuted: '#263449',
  border: '#334155',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  error: '#ef4444',
  success: '#22c55e',
  marketplaces: marketplaceColors,
} as const;

export const lightColors = {
  primary: '#007aff',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#e2e8f0',
  border: '#cbd5e1',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  error: '#dc2626',
  success: '#16a34a',
  marketplaces: marketplaceColors,
} as const;

export const colors = darkColors;

export type AppColors = typeof darkColors | typeof lightColors;
export type ThemeMode = 'dark' | 'light';
export type Marketplace = keyof typeof marketplaceColors;
