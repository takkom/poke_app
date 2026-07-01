import translations from "./translations.json";
import { useThemeManager, type AppLocale } from "@/hooks/useThemeManager";
import { useCallback, useMemo } from "react";

type TranslationKey = keyof typeof translations["en-US"];
type TranslationValues = Record<string, string | number>;

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  values: TranslationValues = {},
): string {
  const template = translations[locale]?.[key] ?? translations["en-US"][key] ?? key;

  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

export function useI18n() {
  const { locale } = useThemeManager();
  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values),
    [locale],
  );

  return useMemo(() => ({ locale, t }), [locale, t]);
}
