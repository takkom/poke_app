import { Text } from "@/components/ui/Text";
import { useThemeManager } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { Pressable, StyleSheet, View } from "react-native";

/** Card print languages supported by search/catalog filtering. */
export const SUPPORTED_CARD_LANGUAGES = ["en", "ja"] as const;

/** Card print language for search filtering — independent of app UI locale. */
export type CardLanguage = (typeof SUPPORTED_CARD_LANGUAGES)[number];

/**
 * Used when the app UI locale is not itself a card print language
 * (e.g. ko-KR today, or a future de-DE). Safe to keep even if more
 * app locales are added later — only exact print-language matches win.
 */
export const FALLBACK_CARD_LANGUAGE: CardLanguage = "ja";

/**
 * Map an app UI locale to a card print language when one exists.
 * `en-US` → `en`, `ja-JP` → `ja`. Anything else (ko, de, …) → fallback.
 */
export function cardLanguageFromAppLocale(
  locale: string | null | undefined,
): CardLanguage {
  const primary = String(locale ?? "")
    .trim()
    .toLowerCase()
    .split("-")[0];

  if (
    (SUPPORTED_CARD_LANGUAGES as readonly string[]).includes(primary)
  ) {
    return primary as CardLanguage;
  }

  return FALLBACK_CARD_LANGUAGE;
}

const OPTIONS: Array<{
  value: CardLanguage;
  labelKey: "search.cardLanguageEn" | "search.cardLanguageJa";
}> = [
  { value: "en", labelKey: "search.cardLanguageEn" },
  { value: "ja", labelKey: "search.cardLanguageJa" },
];

type CardLanguageToggleProps = {
  value: CardLanguage;
  onChange: (next: CardLanguage) => void;
};

export function CardLanguageToggle({
  value,
  onChange,
}: CardLanguageToggleProps) {
  const { colors } = useThemeManager();
  const { t } = useI18n();

  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.row,
        {
          backgroundColor: colors.surfaceAlternate,
          borderColor: colors.border,
        },
      ]}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (option.value !== value) {
                onChange(option.value);
              }
            }}
            style={[
              styles.button,
              selected ? { backgroundColor: colors.primary } : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? colors.onPrimary : colors.textSecondary,
                },
              ]}
            >
              {t(option.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 4,
  },
  button: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
});
