import { useI18n, type TranslationKey } from "@/i18n";
import { AppColors } from "@/theme/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

type TrendState = "up" | "down" | "flat" | "unknown";

type PriceTrendIndicatorProps = {
  colors: AppColors;
  direction: TrendState | undefined;
  percent: number | null | undefined;
};

function formatTrendPercent(percent: number | null | undefined): string {
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return "—";
  }

  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

export function PriceTrendIndicator({
  colors,
  direction,
  percent,
}: PriceTrendIndicatorProps) {
  const { t } = useI18n();
  const state: TrendState = direction ?? "unknown";
  const formattedPercent = formatTrendPercent(percent);
  const color =
    state === "up"
      ? colors.arbitragePositive
      : state === "down"
        ? colors.arbitrageNegative
        : colors.textSecondary;
  const iconName =
    state === "up"
      ? "chevron-up"
      : state === "down"
        ? "chevron-down"
        : state === "flat"
          ? "minus"
          : "help-circle-outline";
  const labelKey: TranslationKey =
    state === "up"
      ? "home.trendUp"
      : state === "down"
        ? "home.trendDown"
        : state === "flat"
          ? "home.trendFlat"
          : "home.trendUnknown";
  const accessibilityLabel =
    state === "unknown"
      ? t(labelKey)
      : t(labelKey, { percent: formattedPercent });

  return (
    <View
      style={styles.container}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <MaterialCommunityIcons name={iconName} color={color} size={15} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    height: 16,
    justifyContent: "center",
    width: 16,
  },
});
