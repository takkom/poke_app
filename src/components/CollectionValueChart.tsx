import { useThemeManager, type DisplayCurrency } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { Text } from "@/components/ui/Text";

export type CollectionValuePoint = {
  date: string;
  value: number;
};

type CollectionValueChartProps = {
  displayCurrency: DisplayCurrency;
  loading?: boolean;
  locale: string;
  points: CollectionValuePoint[];
};

const chartWidth = 328;
const chartPadding = {
  bottom: 28,
  left: 52,
  right: 12,
  top: 18,
};
const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
const plotHeight = 132;
const chartHeight = chartPadding.top + plotHeight + chartPadding.bottom;

function formatAxisValue(
  value: number,
  locale: string,
  displayCurrency: DisplayCurrency,
): string {
  return new Intl.NumberFormat(locale, {
    currency: displayCurrency,
    maximumFractionDigits: displayCurrency === "KRW" ? 0 : 1,
    notation: value >= 1_000_000 ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

function formatAxisDate(value: string, locale: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(new Date(parsed));
}

function createSmoothPath(
  points: Array<{ x: number; y: number }>,
): string {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpointX = (previous.x + current.x) / 2;
    path += ` C ${midpointX} ${previous.y}, ${midpointX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

export function CollectionValueChart({
  displayCurrency,
  loading = false,
  locale,
  points,
}: CollectionValueChartProps) {
  const { t } = useI18n();
  const { colors } = useThemeManager();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const chartPoints = useMemo(() => {
    if (!points.length) {
      return [];
    }

    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    return points.map((point, index) => {
      const x =
        chartPadding.left +
        (index / Math.max(points.length - 1, 1)) * plotWidth;
      const y =
        chartPadding.top +
        plotHeight -
        ((point.value - minValue) / range) * plotHeight;

      return {
        ...point,
        x,
        y,
      };
    });
  }, [points]);

  const latestPoint = chartPoints[chartPoints.length - 1];
  const minValue = points.length
    ? Math.min(...points.map((point) => point.value))
    : 0;
  const maxValue = points.length
    ? Math.max(...points.map((point) => point.value))
    : 0;
  const linePath = createSmoothPath(chartPoints);
  const areaPath =
    chartPoints.length > 0
      ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${
          chartPadding.top + plotHeight
        } L ${chartPoints[0].x} ${chartPadding.top + plotHeight} Z`
      : "";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceAlternate,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
          {t("collections.valueHistory")}
        </Text>
        {latestPoint ? (
          <Text style={[styles.latestValue, { color: colors.textPrimary }]}>
            {formatAxisValue(latestPoint.value, locale, displayCurrency)}
          </Text>
        ) : null}
      </View>

      <View style={styles.chartFrame}>
        {loading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : points.length < 2 ? (
          <View style={styles.stateBlock}>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>
              {t("collections.valueHistoryEmpty")}
            </Text>
          </View>
        ) : (
          <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            {[0, 0.5, 1].map((ratio) => {
              const y = chartPadding.top + plotHeight * ratio;
              const value = maxValue - (maxValue - minValue) * ratio;
              return (
                <React.Fragment key={ratio}>
                  <Line
                    stroke={colors.border}
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    x1={chartPadding.left}
                    x2={chartWidth - chartPadding.right}
                    y1={y}
                    y2={y}
                  />
                  <SvgText
                    fill={colors.textSecondary}
                    fontSize={10}
                    textAnchor="end"
                    x={chartPadding.left - 8}
                    y={y + 3}
                  >
                    {formatAxisValue(value, locale, displayCurrency)}
                  </SvgText>
                </React.Fragment>
              );
            })}

            <Line
              stroke={colors.border}
              strokeWidth={1}
              x1={chartPadding.left}
              x2={chartWidth - chartPadding.right}
              y1={chartPadding.top + plotHeight}
              y2={chartPadding.top + plotHeight}
            />

            {areaPath ? (
              <Path d={areaPath} fill={colors.primary} fillOpacity={0.12} />
            ) : null}
            {linePath ? (
              <Path
                d={linePath}
                fill="none"
                opacity={0.75}
                stroke={colors.primary}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
              />
            ) : null}

            {chartPoints.map((point) => (
              <Circle
                key={point.date}
                cx={point.x}
                cy={point.y}
                fill={colors.primary}
                r={3}
              />
            ))}

            {[chartPoints[0], chartPoints[chartPoints.length - 1]]
              .filter(Boolean)
              .map((point, index) => (
                <SvgText
                  key={`${point.date}-${index}`}
                  fill={colors.textSecondary}
                  fontSize={10}
                  textAnchor={index === 0 ? "start" : "end"}
                  x={point.x}
                  y={chartHeight - 8}
                >
                  {formatAxisDate(point.date, locale)}
                </SvgText>
              ))}
          </Svg>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeManager>["colors"]) {
  return StyleSheet.create({
    card: {
      borderRadius: 12,
      borderWidth: 1,
      gap: 8,
      padding: 14,
    },
    chartFrame: {
      minHeight: chartHeight,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    latestValue: {
      fontSize: 15,
      fontVariant: ["tabular-nums"],
      fontWeight: "800",
    },
    stateBlock: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: chartHeight,
      paddingHorizontal: 12,
    },
    stateText: {
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
  });
}
