/**
 * Base brand palette. These are the only neutral/brand colors that should be
 * used to build the dark theme below — keep dark mode consistent by pulling
 * from this palette instead of introducing new hex values.
 */
export const Palette = {
  jaruYellow: "#FFBB00",
  darkGrey: "#040404",
  mediumGrey: "#0B0B0B",
  lightGrey: "#585858",
  // Lighter neutrals used for text so labels stay readable when they sit on
  // top of `lightGrey` fills (e.g. inactive chip/button backgrounds), not
  // just on the near-black background/surface colors.
  silverGrey: "#D6D6D6",
  steelGrey: "#B0B0B0",
  white: "#FFFFFF",
} as const;

const marketplaceColors = {
  ebay: "#0064d2",
  kream: "#ef4444",
  snkrdunk: "#14b8a6",
} as const;

export const darkColors = {
  primary: Palette.jaruYellow,
  onPrimary: Palette.darkGrey,
  background: Palette.darkGrey,
  surface: Palette.mediumGrey,
  surfaceAlternate: Palette.mediumGrey,
  surfaceMuted: Palette.lightGrey,
  border: Palette.lightGrey,
  textPrimary: Palette.white,
  // Deliberately lighter than `lightGrey` (used for surfaceMuted/border) so
  // secondary/muted labels remain legible when placed on a muted chip fill,
  // not just on the background/surface colors.
  textSecondary: Palette.silverGrey,
  textMuted: Palette.steelGrey,
  error: "#ef4444",
  success: "#22c55e",
  arbitragePositive: "#5ECCA3",
  arbitrageNegative: "#ef4444",
  marketplaces: marketplaceColors,
} as const;

export const lightColors = {
  primary: "#007aff",
  onPrimary: "#ffffff",
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceAlternate: "#f1f5f9",
  surfaceMuted: "#e2e8f0",
  border: "#cbd5e1",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  error: "#dc2626",
  success: "#16a34a",
  arbitragePositive: "#22c55e",
  arbitrageNegative: "#ef4444",
  marketplaces: marketplaceColors,
} as const;

export const colors = darkColors;

export type AppColors = typeof darkColors | typeof lightColors;
export type ThemeMode = "dark" | "light";
export type Marketplace = keyof typeof marketplaceColors;
