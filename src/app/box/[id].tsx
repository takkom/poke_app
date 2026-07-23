import {
  MARKETPLACE_BADGE_LABELS,
  MARKETPLACE_COLUMN_ORDER,
} from "@/constants/marketplaces";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { useThemeManager } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { getBoxById, getBoxPriceHistory } from "@/services/cardService";
import { AppColors } from "@/theme/colors";
import { CardWithPricing, MarketplaceAverage, MarketplaceKey, PriceHistoryPoint } from "@/types/card";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";

function formatSalesCount(value: number | null | undefined, locale: string): string {
  return (value ?? 0).toLocaleString(locale);
}

function formatMoney(
  value: number | null | undefined,
  currency: "KRW" | "USD" | "JPY",
  locale: string,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    currency,
    style: "currency",
    maximumFractionDigits: currency === "USD" ? 2 : 0,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

function resolveBoxImage(box: CardWithPricing): string | null {
  if (box.images?.large) return box.images.large;
  if (box.images?.small) return box.images.small;
  return box.image ?? null;
}

function MarketplaceRow({
  label,
  average,
  currency,
  locale,
  colors,
  isBaseline,
}: {
  label: string;
  average: MarketplaceAverage | undefined;
  currency: "KRW" | "USD" | "JPY";
  locale: string;
  colors: AppColors;
  isBaseline: boolean;
}) {
  const price = average?.avgPrice;
  const volume = average?.volume;
  if (price == null && volume == null) return null;

  return (
    <View
      style={[
        styles.marketRow,
        { borderBottomColor: colors.border },
        isBaseline && { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12 },
      ]}
    >
      <Text style={[styles.marketLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.marketValues}>
        {price != null && (
          <Text style={[styles.marketPrice, { color: isBaseline ? colors.primary : colors.textPrimary }]}>
            {formatMoney(price, currency, locale)}
          </Text>
        )}
        {volume != null && (
          <Text style={[styles.marketVolume, { color: colors.textMuted }]}>
            ×{volume}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function BoxDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors, displayCurrency, locale } = useThemeManager();
  const { t } = useI18n();

  const [box, setBox] = useState<CardWithPricing | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);

  const boxId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    if (!boxId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const data = await getBoxById(boxId as string, {
        currency: displayCurrency,
        locale,
      });
      if (!cancelled) {
        setBox(data);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [boxId, displayCurrency, locale]);

  useEffect(() => {
    if (!boxId) return;

    let cancelled = false;

    async function loadHistory() {
      setPriceHistoryLoading(true);
      setPriceHistoryError(null);
      try {
        const history = await getBoxPriceHistory(
          boxId as string,
          displayCurrency,
          locale,
        );
        if (!cancelled) setPriceHistory(history);
      } catch {
        if (!cancelled) {
          setPriceHistory([]);
          setPriceHistoryError(t("box.priceHistoryUnavailable"));
        }
      } finally {
        if (!cancelled) setPriceHistoryLoading(false);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [boxId, displayCurrency, locale, t]);

  if (loading) {
    return (
      <SafeAreaView
        edges={['bottom', 'left', 'right']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t("box.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!box) {
    return (
      <SafeAreaView
        edges={['bottom', 'left', 'right']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.center}>
          <MaterialCommunityIcons name="package-variant-closed-remove" size={52} color={colors.textSecondary} />
          <Text style={[styles.notFoundText, { color: colors.error }]}>
            {t("box.notFound")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const imageUrl = resolveBoxImage(box);
  const hasImage = Boolean(imageUrl);
  const currency = box.displayCurrency ?? displayCurrency;

  const marketBadges = MARKETPLACE_COLUMN_ORDER.flatMap((key) => {
    const hasMarketplace =
      (key === "ebay" && box.hasEbay) ||
      (key === "kream" && box.hasKream) ||
      (key === "snkrdunk" && box.hasSnkrdunk);

    if (!hasMarketplace) {
      return [];
    }

    const sales =
      key === "ebay"
        ? box.ebaySales
        : key === "kream"
          ? box.kreamSales
          : box.snkrdunkSales;

    return [
      {
        key,
        label: MARKETPLACE_BADGE_LABELS[key],
        count: formatSalesCount(sales, locale),
        color: colors.marketplaces[key],
      },
    ];
  });

  const averages = box.marketplaceAverages;
  const hasAverages = averages && Object.values(averages).some(
    (a) => a?.avgPrice != null || a?.volume != null,
  );

  const MARKETPLACE_LABELS = MARKETPLACE_BADGE_LABELS;

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Hero image */}
        <View style={[styles.imageContainer, { backgroundColor: colors.background }]}>
          {hasImage && imageUrl ? (
            <Image
              source={imageUrl}
              style={[styles.boxImage, { backgroundColor: colors.surfaceMuted }]}
              contentFit="contain"
            />
          ) : (
            <View style={[styles.imageFallback, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="package-variant" size={72} color={colors.textSecondary} />
              <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
                {t("box.imageUnavailable")}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.detailsContainer, { backgroundColor: colors.surface }]}>

          {/* Name */}
          <Text style={[styles.boxName, { color: colors.primary }]} numberOfLines={3}>
            {box.name}
          </Text>

          {/* Meta row: Booster Box · Set · Language */}
          <View style={styles.metaRow}>
            <View style={[styles.metaBadge, { backgroundColor: `${colors.primary}22`, borderColor: colors.primary }]}>
              <Text style={[styles.metaBadgeText, { color: colors.primary }]}>
                {t("box.boosterBox")}
              </Text>
            </View>
            {box.set?.name ? (
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {box.set.name}
              </Text>
            ) : null}
            {box.language ? (
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {box.language.toUpperCase()}
              </Text>
            ) : null}
          </View>

          {/* Marketplace sales badges */}
          {marketBadges.length > 0 && (
            <View style={styles.badgeRow}>
              {marketBadges.map((badge) => (
                <View
                  key={badge.key}
                  style={[styles.salesBadge, { borderColor: badge.color, backgroundColor: `${badge.color}22` }]}
                >
                  <Text style={[styles.salesBadgeLabel, { color: badge.color }]}>{badge.label}</Text>
                  <Text style={[styles.salesBadgeCount, { color: badge.color }]}>{badge.count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Price history chart */}
          {priceHistoryLoading ? (
            <View style={[styles.chartState, { borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t("box.loadingMarket")}
              </Text>
            </View>
          ) : priceHistoryError ? (
            <View style={[styles.chartState, { borderColor: colors.border }]}>
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                {priceHistoryError}
              </Text>
            </View>
          ) : priceHistory.length > 0 ? (
            <PriceHistoryChart
              tcgdexId={box.id}
              priceHistory={priceHistory}
              displayCurrency={displayCurrency}
              locale={locale}
            />
          ) : null}

          {/* Marketplace averages */}
          {hasAverages && (
            <View style={[styles.marketSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t("box.marketPrices")}
              </Text>
              {MARKETPLACE_COLUMN_ORDER.map((key) => (
                <MarketplaceRow
                  key={key}
                  label={MARKETPLACE_LABELS[key]}
                  average={averages?.[key]}
                  currency={currency}
                  locale={locale}
                  colors={colors}
                  isBaseline={box.baselineMarketplace === key}
                />
              ))}
            </View>
          )}

          {!hasAverages && marketBadges.length === 0 && (
            <Text style={[styles.noDataText, { color: colors.textMuted }]}>
              {t("box.noMarketData")}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
  },
  scrollContent: { paddingBottom: 16, paddingTop: 16 },
  imageContainer: {
    alignItems: "center",
    paddingBottom: 16,
  },
  boxImage: {
    borderRadius: 10,
    height: 260,
    width: 260,
  },
  imageFallback: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    height: 260,
    justifyContent: "center",
    width: 260,
    gap: 12,
  },
  fallbackText: {
    fontSize: 13,
    fontWeight: "600",
  },
  detailsContainer: {
    borderRadius: 12,
    gap: 16,
    marginHorizontal: 12,
    marginTop: 4,
    padding: 16,
  },
  boxName: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  metaBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  salesBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  salesBadgeLabel: {
    fontSize: 10,
    fontWeight: "800",
  },
  salesBadgeCount: {
    fontSize: 10,
    fontWeight: "900",
  },
  chartState: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    justifyContent: "center",
    minHeight: 120,
    padding: 16,
  },
  marketSection: {
    borderTopWidth: 1,
    gap: 0,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  marketRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  marketLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  marketValues: {
    alignItems: "flex-end",
    gap: 2,
  },
  marketPrice: {
    fontSize: 15,
    fontWeight: "800",
  },
  marketVolume: {
    fontSize: 11,
    fontWeight: "500",
  },
  noDataText: {
    fontSize: 14,
    paddingVertical: 8,
    textAlign: "center",
  },
  loadingText: { fontSize: 14 },
  notFoundText: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  errorText: { fontSize: 14, textAlign: "center" },
});
