/**
 * The Inter font is the only typeface used across the app. Every text style
 * should resolve to one of these font families instead of the platform
 * default, so keep new weights added here in sync with the files loaded in
 * `src/app/_layout.tsx`.
 */
export const FontFamily = {
  thin: "Inter_100Thin",
  extraLight: "Inter_200ExtraLight",
  light: "Inter_300Light",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extraBold: "Inter_800ExtraBold",
  black: "Inter_900Black",
} as const;

const weightToFontFamily: Record<string, string> = {
  "100": FontFamily.thin,
  "200": FontFamily.extraLight,
  "300": FontFamily.light,
  "400": FontFamily.regular,
  "500": FontFamily.medium,
  "600": FontFamily.semiBold,
  "700": FontFamily.bold,
  "800": FontFamily.extraBold,
  "900": FontFamily.black,
  normal: FontFamily.regular,
  bold: FontFamily.bold,
};

export function getInterFontFamily(fontWeight?: string | number | null): string {
  if (fontWeight == null) {
    return FontFamily.regular;
  }

  return weightToFontFamily[String(fontWeight)] ?? FontFamily.regular;
}
