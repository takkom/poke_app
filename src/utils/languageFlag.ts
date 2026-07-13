export function cardLanguageFlag(
  language: string | null | undefined,
): string | null {
  if (language === "ja") return "🇯🇵";
  if (language === "en") return "🇺🇸";
  return null;
}

export function languageFlagAccessibilityLabel(
  language: string | null | undefined,
): string | null {
  if (language === "ja") return "Japanese";
  if (language === "en") return "English";
  return null;
}
