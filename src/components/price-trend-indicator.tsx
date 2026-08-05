import { Text } from "@/components/ui/Text";
import { useI18n, type TranslationKey } from "@/i18n";
import { AppColors } from "@/theme/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

const NEUTRAL_TREND_THRESHOLD = 2;

type TrendState = "up" | "down" | "flat" | "unknown";

type PriceTrendIndicatorProps = {
  animationKey: number;
  animate: boolean;
  colors: AppColors;
  percent: number | null | undefined;
};

function resolveTrendState(percent: number | null | undefined): TrendState {
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return "unknown";
  }
  if (percent > NEUTRAL_TREND_THRESHOLD) return "up";
  if (percent < -NEUTRAL_TREND_THRESHOLD) return "down";
  return "flat";
}

function formatTrendPercent(percent: number | null | undefined): string {
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return "—";
  }

  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

export function PriceTrendIndicator({
  animationKey,
  animate,
  colors,
  percent,
}: PriceTrendIndicatorProps) {
  const { t } = useI18n();
  const state = resolveTrendState(percent);
  const [revealed, setRevealed] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      setRevealed(true);
      return;
    }

    setRevealed(false);
    const timer = setTimeout(() => setRevealed(true), 320);
    return () => clearTimeout(timer);
  }, [animate, animationKey]);

  const displayedState = revealed ? state : "flat";
  const formattedPercent = formatTrendPercent(percent);
  const color =
    displayedState === "up"
      ? colors.arbitragePositive
      : displayedState === "down"
        ? colors.arbitrageNegative
        : colors.textSecondary;
  const iconName =
    displayedState === "up"
      ? "chevron-up"
      : displayedState === "down"
        ? "chevron-down"
        : "minus";
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
      <Animated.View
        key={`${animationKey}-${displayedState}`}
        entering={animate && revealed ? FadeIn.duration(180) : undefined}
        style={styles.iconContainer}
      >
        <MaterialCommunityIcons name={iconName} color={color} size={20} />
      </Animated.View>
      <Text
        style={[styles.percent, { color }]}
        numberOfLines={1}
        selectable
      >
        {revealed ? formattedPercent : "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 0.54,
    gap: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  iconContainer: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
  },
  percent: {
    fontSize: 9,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    textAlign: "center",
  },
});
