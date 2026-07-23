/**
 * Base brand palette. These are the only neutral/brand colors that should be
 * used to build the dark theme below — keep dark mode consistent by pulling
 * from this palette instead of introducing new hex values.
 */
export const Palette = {
  jaruYellow: "#FFBB00",
  darkGrey: "#040404",
  mediumGrey: "#0B0B0B",
  // One step above `mediumGrey` so modal/sheet surfaces separate from the page
  // in dark mode even before the scrim is applied.
  elevatedGrey: "#141414",
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
  surfaceElevated: Palette.elevatedGrey,
  surfaceMuted: Palette.lightGrey,
  border: Palette.lightGrey,
  // Scrims for menus vs dialogs/sheets. Strong enough that elevated surfaces
  // read clearly against near-black page backgrounds.
  overlay: "rgba(0,0,0,0.55)",
  overlayStrong: "rgba(0,0,0,0.72)",
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
  surfaceElevated: "#ffffff",
  surfaceMuted: "#e2e8f0",
  border: "#cbd5e1",
  overlay: "rgba(15, 23, 42, 0.28)",
  overlayStrong: "rgba(15, 23, 42, 0.45)",
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

/** Bake alpha into a `#RRGGBB` color for SVG strokes/fills (more reliable than Path opacity). */
export function withAlpha(color: string, alpha: number): string {
  const clamped = Math.min(1, Math.max(0, alpha));
  const hex = color.replace("#", "");
  if (hex.length !== 6) {
    return color;
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
