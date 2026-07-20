import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import {
  MARKETPLACE_BADGE_LABELS,
  MARKETPLACE_CHART_LABELS,
  MARKETPLACE_COLUMN_ORDER,
} from "@/constants/marketplaces";
import { useThemeManager } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { AppColors, Marketplace } from "@/theme/colors";
import { PriceHistoryPoint } from "@/types/card";

type VisiblePlatforms = Record<Marketplace, boolean>;

type RawMarketPoint = {
  date: string;
  value: number;
  volume: number;
};

type ChartPoint = RawMarketPoint & {
  x: number;
  y: number;
};

type ChartDataset = {
  platform: Marketplace;
  label: string;
  color: string;
  points: ChartPoint[];
  rawPoints: RawMarketPoint[];
  path: string;
};

type SelectedPoint = {
  platform: Marketplace;
  point: ChartPoint;
};

type MarketplaceSalesBadge = {
  key: Marketplace;
  label: string;
  count: string;
  color: string;
};

type PriceHistoryChartProps = {
  tcgdexId: string;
  cardName?: string;
  priceHistory: PriceHistoryPoint[];
  displayCurrency?: "KRW" | "USD" | "JPY";
  locale?: "ko-KR" | "en-US";
  showLatestPrice?: boolean;
};

const platforms = MARKETPLACE_COLUMN_ORDER.map((key) => ({
  key,
  label: MARKETPLACE_CHART_LABELS[key],
}));

const chartWidth = 328;
const chartPadding = {
  top: 18,
  right: 18,
  bottom: 34,
  left: 58,
};
const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
const pricePlotHeight = 150;
const volumePlotHeight = 32;
const volumeGap = 8;
const chartHeight =
  chartPadding.top +
  pricePlotHeight +
  volumeGap +
  volumePlotHeight +
  chartPadding.bottom;
const yTickCount = 4;
const maxXAxisLabels = 4;

function getDateX(dateIndex: number, dateCount: number): number {
  if (dateCount <= 1) {
    return chartPadding.left + plotWidth / 2;
  }

  return (
    chartPadding.left + (dateIndex / (dateCount - 1)) * plotWidth
  );
}

function formatCompactMoney(
  value: number,
  currency: "KRW" | "USD" | "JPY",
  locale: "ko-KR" | "en-US",
): string {
  const rounded = Math.round(value);
  const symbol = currency === "KRW" ? "\u20a9" : currency === "JPY" ? "\u00a5" : "$";
  const suffix = currency === "USD" ? "" : ` ${symbol}`;
  const prefix = currency === "USD" ? symbol : "";
  const divisor = Math.abs(rounded) >= 1_000_000 ? 1_000_000 : 1_000;
  const unit = Math.abs(rounded) >= 1_000_000 ? "M" : "K";

  if (Math.abs(rounded) >= 100_000) {
    return `${prefix}${(rounded / divisor).toFixed(divisor === 1_000_000 ? 1 : 0)}${unit}${suffix}`;
  }

  return `${prefix}${rounded.toLocaleString(locale)}${suffix}`;
}

function formatMoney(
  value: number,
  currency: "KRW" | "USD" | "JPY",
  locale: "ko-KR" | "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    style: "currency",
  }).format(value);
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(5) || value;
  }

  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function buildYAxisTicks(min: number, max: number): number[] {
  if (min === max) {
    const buffer = Math.max(1000, min * 0.1);
    min = Math.max(0, min - buffer);
    max += buffer;
  }

  return Array.from({ length: yTickCount }, (_, index) => {
    const ratio = index / (yTickCount - 1);
    return max - (max - min) * ratio;
  });
}

function buildXAxisIndexes(length: number): number[] {
  if (length <= 1) return [0];

  const labelCount = Math.min(maxXAxisLabels, length);
  return Array.from({ length: labelCount }, (_, index) =>
    Math.round((index / (labelCount - 1)) * (length - 1)),
  ).filter((value, index, values) => values.indexOf(value) === index);
}

function averageKey(platform: Marketplace): keyof PriceHistoryPoint {
  return `${platform}_avg` as keyof PriceHistoryPoint;
}

function volumeKey(platform: Marketplace): keyof PriceHistoryPoint {
  return `${platform}_volume` as keyof PriceHistoryPoint;
}

function getPlatformRows(
  history: PriceHistoryPoint[],
  platform: Marketplace,
): RawMarketPoint[] {
  const valueKey = averageKey(platform);
  const countKey = volumeKey(platform);

  return history
    .map((row) => ({
      date: row.date,
      value: Number(row[valueKey] ?? row[`${platform}_avg_krw` as keyof PriceHistoryPoint]),
      volume: Number(row[countKey] ?? 0),
    }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0);
}

function extendPlatformRowsToEnd(
  rows: RawMarketPoint[],
  endDate: string | undefined,
): RawMarketPoint[] {
  if (!rows.length || !endDate) {
    return rows;
  }

  const lastRow = rows[rows.length - 1];
  if (lastRow.date >= endDate) {
    return rows;
  }

  return [
    ...rows,
    {
      date: endDate,
      value: lastRow.value,
      volume: 0,
    },
  ];
}

function platformHasRecords(
  history: PriceHistoryPoint[],
  platform: Marketplace,
): boolean {
  return getPlatformRows(history, platform).some((row) => row.volume > 0);
}

function createSmoothPath(points: ChartPoint[]): string {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function initialVisiblePlatforms(history: PriceHistoryPoint[]): VisiblePlatforms {
  return {
    ebay: platformHasRecords(history, "ebay"),
    kream: platformHasRecords(history, "kream"),
    snkrdunk: platformHasRecords(history, "snkrdunk"),
  };
}

function sumPlatformVolume(points: RawMarketPoint[]): number {
  return points.reduce((sum, point) => sum + point.volume, 0);
}

export function PriceHistoryChart({
  tcgdexId,
  cardName,
  priceHistory,
  displayCurrency = "KRW",
  locale = "ko-KR",
  showLatestPrice = true,
}: PriceHistoryChartProps) {
  const { t } = useI18n();
  const { colors } = useThemeManager();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visiblePlatforms, setVisiblePlatforms] = useState<VisiblePlatforms>(
    () => initialVisiblePlatforms(priceHistory),
  );
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);

  const availablePlatforms = useMemo(
    () => platforms.filter((item) => platformHasRecords(priceHistory, item.key)),
    [priceHistory],
  );
  const hasAnyData = availablePlatforms.length > 0;

  useEffect(() => {
    setVisiblePlatforms(initialVisiblePlatforms(priceHistory));
    setSelectedPoint(null);
  }, [priceHistory, tcgdexId]);

  const togglePlatform = (platform: Marketplace) => {
    setVisiblePlatforms((current) => ({
      ...current,
      [platform]: !current[platform],
    }));
    setSelectedPoint(null);
  };

  const activePlatforms = availablePlatforms.filter(
    (item) => visiblePlatforms[item.key],
  );
  const hasVisiblePlatforms = activePlatforms.length > 0;

  const allDates = useMemo(
    () => [...new Set(priceHistory.map((row) => row.date))].sort(),
    [priceHistory],
  );

  const chartEndDate = allDates.length ? allDates[allDates.length - 1] : undefined;

  const rawDatasets = useMemo(
    () =>
      activePlatforms.map((item) => ({
        platform: item.key,
        label: item.label,
        color: colors.marketplaces[item.key],
        rawPoints: extendPlatformRowsToEnd(
          getPlatformRows(priceHistory, item.key),
          chartEndDate,
        ),
      })),
    [activePlatforms, chartEndDate, priceHistory],
  );

  const allValues = rawDatasets.flatMap((dataset) =>
    dataset.rawPoints.map((point) => point.value),
  );
  const minValue = allValues.length ? Math.min(...allValues) : 0;
  const maxValue = allValues.length ? Math.max(...allValues) : 0;
  const range = maxValue - minValue || 1;

  const datasets = useMemo<ChartDataset[]>(
    () =>
      rawDatasets.map((dataset) => {
        const points = dataset.rawPoints.map((point) => {
          const dateIndex = Math.max(0, allDates.indexOf(point.date));
          const x = getDateX(dateIndex, allDates.length);
          const y =
            chartPadding.top +
            pricePlotHeight -
            ((point.value - minValue) / range) * pricePlotHeight;

          return { ...point, x, y };
        });

        return {
          ...dataset,
          points,
          path: createSmoothPath(points),
        };
      }),
    [allDates, minValue, range, rawDatasets],
  );

  const latestPoints = datasets
    .map((dataset) => ({
      dataset,
      point: dataset.points[dataset.points.length - 1],
    }))
    .filter((entry) => entry.point);
  const primaryLatest = latestPoints[0];
  const yTicks = buildYAxisTicks(minValue, maxValue);
  const xLabelIndexes = buildXAxisIndexes(allDates.length);
  const totalVolume = datasets.reduce(
    (sum, dataset) => sum + sumPlatformVolume(dataset.points),
    0,
  );
  const marketplaceSales = useMemo<MarketplaceSalesBadge[]>(
    () =>
      datasets.map((dataset) => ({
        key: dataset.platform,
        label: MARKETPLACE_BADGE_LABELS[dataset.platform],
        count: sumPlatformVolume(dataset.points).toLocaleString(locale),
        color: dataset.color,
      })),
    [datasets, locale],
  );
  const volumeByDate = useMemo(
    () =>
      allDates.map((date) =>
        datasets.reduce((sum, dataset) => {
          const point = dataset.points.find((entry) => entry.date === date);
          return sum + (point?.volume ?? 0);
        }, 0),
      ),
    [allDates, datasets],
  );
  const maxVolume = Math.max(1, ...volumeByDate);
  const volumeTop = chartPadding.top + pricePlotHeight + volumeGap;
  const volumeBottom = volumeTop + volumePlotHeight;
  const volumeBarWidth =
    allDates.length <= 1
      ? Math.min(16, plotWidth * 0.4)
      : Math.min(10, Math.max(3, (plotWidth / allDates.length) * 0.7));
  const volumeColor =
    activePlatforms.length === 1
      ? colors.marketplaces[activePlatforms[0].key]
      : colors.primary;

  const tooltipX = selectedPoint
    ? Math.min(
        Math.max(chartPadding.left, selectedPoint.point.x - 52),
        chartWidth - chartPadding.right - 104,
      )
    : 0;
  const tooltipY = selectedPoint
    ? Math.max(6, selectedPoint.point.y - 46)
    : 0;
  const selectedColor = selectedPoint
    ? colors.marketplaces[selectedPoint.platform]
    : colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{t('chart.priceHistory')}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {cardName ?? tcgdexId}
          </Text>
        </View>
        {showLatestPrice && primaryLatest ? (
          <View style={styles.latest}>
            <Text
              style={[
                styles.latestPrice,
                { color: primaryLatest.dataset.color },
              ]}
            >
              {formatCompactMoney(primaryLatest.point.value, displayCurrency, locale)}
            </Text>
            <Text style={styles.latestLabel}>
              {t('chart.latestAvg', { platform: primaryLatest.dataset.label })}
            </Text>
          </View>
        ) : null}
      </View>

      {hasAnyData ? (
        <View style={styles.segmentedControl}>
          {availablePlatforms.map((item) => {
            const active = visiblePlatforms[item.key];
            const color = colors.marketplaces[item.key];
            return (
              <Pressable
                key={item.key}
                onPress={() => togglePlatform(item.key)}
                style={[
                  styles.segment,
                  {
                    backgroundColor: active ? color : colors.surfaceMuted,
                    borderColor: active ? color : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.textPrimary : colors.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.chartFrame}>
        {!hasAnyData ? (
          <View style={styles.stateContainer}>
            <Text style={styles.emptyTitle}>
              {t('chart.noRecords')}
            </Text>
          </View>
        ) : !hasVisiblePlatforms ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>
              {t('chart.selectPlatform')}
            </Text>
          </View>
        ) : (
          <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            <Defs>
              {datasets.map((dataset) => (
                <LinearGradient
                  key={dataset.platform}
                  id={`priceGlow-${dataset.platform}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop offset="0" stopColor={dataset.color} stopOpacity="0.18" />
                  <Stop offset="1" stopColor={dataset.color} stopOpacity="0" />
                </LinearGradient>
              ))}
            </Defs>

            {yTicks.map((tick, index) => {
              const y =
                chartPadding.top +
                (index / Math.max(1, yTicks.length - 1)) * pricePlotHeight;
              return (
                <React.Fragment key={`${tick}-${index}`}>
                  <Line
                    x1={chartPadding.left}
                    x2={chartWidth - chartPadding.right}
                    y1={y}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth="1"
                    opacity="0.65"
                  />
                  <SvgText
                    x={chartPadding.left - 8}
                    y={y + 4}
                    fill={colors.textMuted}
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="end"
                  >
                    {formatCompactMoney(tick, displayCurrency, locale)}
                  </SvgText>
                </React.Fragment>
              );
            })}

            <Line
              x1={chartPadding.left}
              x2={chartWidth - chartPadding.right}
              y1={volumeTop - 4}
              y2={volumeTop - 4}
              stroke={colors.border}
              strokeWidth="1"
              opacity="0.45"
            />
            <SvgText
              x={chartPadding.left - 8}
              y={volumeTop + volumePlotHeight / 2 + 3}
              fill={colors.textMuted}
              fontSize="9"
              fontWeight="700"
              textAnchor="end"
            >
              {t("chart.volume")}
            </SvgText>

            {volumeByDate.map((volume, index) => {
              const x = getDateX(index, allDates.length);
              const barHeight = Math.max(
                2,
                (volume / maxVolume) * volumePlotHeight,
              );

              return (
                <Rect
                  key={`volume-${allDates[index]}`}
                  x={x - volumeBarWidth / 2}
                  y={volumeBottom - barHeight}
                  width={volumeBarWidth}
                  height={barHeight}
                  rx="2"
                  fill={volumeColor}
                  opacity={volume > 0 ? 0.85 : 0}
                />
              );
            })}

            {xLabelIndexes.map((index) => {
              const date = allDates[index];
              const x = getDateX(index, allDates.length);
              return (
                <SvgText
                  key={`${date}-x`}
                  x={x}
                  y={chartHeight - 10}
                  fill={colors.textMuted}
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {formatDateLabel(date)}
                </SvgText>
              );
            })}

            {datasets.map((dataset) =>
              dataset.points.length > 1 ? (
                <Path
                  key={`${dataset.platform}-area`}
                  d={`${dataset.path} L ${dataset.points[dataset.points.length - 1].x} ${chartPadding.top + pricePlotHeight} L ${dataset.points[0].x} ${chartPadding.top + pricePlotHeight} Z`}
                  fill={`url(#priceGlow-${dataset.platform})`}
                />
              ) : null,
            )}

            {datasets.map((dataset) => (
              <React.Fragment key={dataset.platform}>
                <Path
                  d={dataset.path}
                  fill="none"
                  stroke={dataset.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />
                {dataset.points.map((point, index) => (
                  <Circle
                    key={`${dataset.platform}-${point.date}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="12"
                    fill="transparent"
                    onPress={() =>
                      setSelectedPoint({ platform: dataset.platform, point })
                    }
                  />
                ))}
              </React.Fragment>
            ))}

            {selectedPoint ? (
              <>
                <Line
                  x1={selectedPoint.point.x}
                  x2={selectedPoint.point.x}
                  y1={chartPadding.top}
                  y2={volumeBottom}
                  stroke={selectedColor}
                  strokeWidth="1"
                  opacity="0.45"
                />
                <Circle
                  cx={selectedPoint.point.x}
                  cy={selectedPoint.point.y}
                  r="6"
                  fill={selectedColor}
                  opacity="0.22"
                />
                <Circle
                  cx={selectedPoint.point.x}
                  cy={selectedPoint.point.y}
                  r="3.5"
                  fill={selectedColor}
                />
                <Rect
                  x={tooltipX}
                  y={tooltipY}
                  width="104"
                  height="34"
                  rx="7"
                  fill={colors.surface}
                  stroke={selectedColor}
                  strokeWidth="1"
                />
                <SvgText
                  x={tooltipX + 52}
                  y={tooltipY + 14}
                  fill={colors.textPrimary}
                  fontSize="10"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {formatMoney(selectedPoint.point.value, displayCurrency, locale)}
                </SvgText>
                <SvgText
                  x={tooltipX + 52}
                  y={tooltipY + 27}
                  fill={colors.textSecondary}
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {formatDateLabel(selectedPoint.point.date)} · {selectedPoint.point.volume} sales
                </SvgText>
              </>
            ) : null}
          </Svg>
        )}
      </View>

      {(hasAnyData && hasVisiblePlatforms) || marketplaceSales?.length ? (
        <View style={styles.statsRow}>
          {hasAnyData && hasVisiblePlatforms ? (
            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>{t('chart.volume')}</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>
                {totalVolume.toLocaleString(locale)}
              </Text>
            </View>
          ) : null}
          {marketplaceSales?.length ? (
            <View style={styles.marketBadgeRow}>
              {marketplaceSales.map((badge) => (
                <View
                  key={badge.key}
                  style={[
                    styles.marketBadge,
                    {
                      borderColor: badge.color,
                      backgroundColor: `${badge.color}22`,
                    },
                  ]}
                >
                  <Text style={[styles.marketBadgeText, { color: badge.color }]}>
                    {badge.label}
                  </Text>
                  <Text style={[styles.marketBadgeCount, { color: badge.color }]}>
                    {badge.count}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
    maxWidth: 180,
  },
  latest: {
    alignItems: "flex-end",
  },
  latestPrice: {
    fontSize: 16,
    fontWeight: "800",
  },
  latestLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
    maxWidth: 120,
    textAlign: "right",
  },
  segmentedControl: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    padding: 4,
  },
  segment: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "800",
  },
  chartFrame: {
    backgroundColor: colors.background,
    borderRadius: 8,
    minHeight: chartHeight,
    overflow: "hidden",
    paddingRight: 4,
  },
  stateContainer: {
    alignItems: "center",
    gap: 10,
    minHeight: chartHeight,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },
  statsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  metricsRow: {
    alignItems: "baseline",
    flexDirection: "row",
    flexShrink: 0,
    gap: 8,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  marketBadgeRow: {
    flexDirection: "row",
    flex: 1,
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  marketBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  marketBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  marketBadgeCount: {
    fontSize: 10,
    fontWeight: "900",
  },
  });
}
