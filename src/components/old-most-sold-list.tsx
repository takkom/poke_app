import { useThemeManager, type AppLocale } from "@/hooks/useThemeManager";
import { getMostSoldCards } from "@/services/cardService";
import { AppColors } from "@/theme/colors";
import { PokemonCard } from "@/types/card";
import {
  cleanMarketplaceTitle,
  getDisplayCardName,
  getDisplayRarity,
} from "@/utils/displayNames";
import { Image } from "expo-image";
import { memo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type HomeTranslator = (
  key:
    | "home.kreamSales"
    | "home.avgUnavailable"
    | "home.trendUnknown",
  values?: Record<string, string | number>,
) => string;

type OldMostSoldListProps = {
  onPressCard: (id: string) => void;
  t: HomeTranslator;
};

type TopSellerRowProps = {
  colors: AppColors;
  item: PokemonCard;
  index: number;
  locale: AppLocale;
  onPress: (id: string) => void;
  t: HomeTranslator;
};

function formatCardNumber(item: PokemonCard): string | null {
  if (!item.number) {
    return null;
  }

  if (item.number.includes("/")) {
    return item.number;
  }

  const total = item.set?.cardCount?.total || item.set?.cardCount?.official;
  if (!total) {
    return item.number;
  }

  const paddedTotal = String(total).padStart(
    Math.max(3, String(total).length),
    "0",
  );
  const paddedNumber = /^\d+$/.test(item.number)
    ? item.number.padStart(paddedTotal.length, "0")
    : item.number;

  return `${paddedNumber}/${paddedTotal}`;
}

function formatMoney(
  value: number | null | undefined,
  currency: "KRW" | "USD" | "JPY",
  locale: AppLocale,
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    style: "currency",
  }).format(value);
}

function getSafeTrendDisplay(
  direction: PokemonCard["trendDirection"],
  percent: number | null | undefined,
) {
  const label =
    typeof percent === "number"
      ? `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`
      : null;

  if (direction === "up") {
    return { color: "#16a34a", label, symbol: "\u25b2" };
  }

  if (direction === "down") {
    return { color: "#dc2626", label, symbol: "\u25bc" };
  }

  return { color: "#ca8a04", label, symbol: "\u25cf" };
}

function formatSalesCount(value: number | null | undefined, locale: AppLocale): string {
  return (value ?? 0).toLocaleString(locale);
}

const TopSellerRow = memo(function TopSellerRow({
  colors,
  item,
  index,
  locale,
  onPress,
  t,
}: TopSellerRowProps) {
  const displayName =
    locale === "ko-KR"
      ? (cleanMarketplaceTitle(item.kreamTitle) ??
        getDisplayCardName(item, locale))
      : getDisplayCardName(item, locale);
  const printedNumber = formatCardNumber(item);
  const metadata = [
    printedNumber,
    getDisplayRarity(item.rarity, locale),
    item.set?.name,
  ]
    .filter(Boolean)
    .join(" | ");
  const avgPrice = formatMoney(
    item.avgPrice,
    item.displayCurrency ?? (locale === "ko-KR" ? "KRW" : "USD"),
    locale,
  );
  const trend = getSafeTrendDisplay(item.trendDirection, item.trendPercent);
  const marketBadges = [
    item.hasKream
      ? {
          key: "kream",
          label: "KREAM",
          count: formatSalesCount(item.kreamSales, locale),
          color: colors.marketplaces.kream,
        }
      : null,
    item.hasEbay
      ? {
          key: "ebay",
          label: "eBay",
          count: formatSalesCount(item.ebaySales, locale),
          color: colors.marketplaces.ebay,
        }
      : null,
    item.hasSnkrdunk
      ? {
          key: "snkrdunk",
          label: "SNK",
          count: formatSalesCount(item.snkrdunkSales, locale),
          color: colors.marketplaces.snkrdunk,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    count: string;
    color: string;
  }>;

  return (
    <TouchableOpacity
      style={[
        styles.cardRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => onPress(item.id)}
    >
      <Image
        source={
          item.image ??
          item.images?.small ??
          "https://images.tcgdex.net/placeholder.png"
        }
        style={[styles.cardImage, { backgroundColor: colors.surfaceMuted }]}
        contentFit="cover"
      />
      <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.rankText}>{index + 1}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text
          style={[styles.cardName, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {displayName}
        </Text>
        <Text
          style={[styles.cardMeta, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {metadata || item.id}
        </Text>

        <View style={styles.priceRow}>
          <Text
            style={[styles.avgPrice, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {avgPrice ?? t("home.avgUnavailable")}
          </Text>
          <Text
            accessibilityLabel={trend.label ?? t("home.trendUnknown")}
            style={[styles.trendIcon, { color: trend.color }]}
          >
            {trend.symbol}
          </Text>
        </View>

        {marketBadges.length ? (
          <View style={styles.marketBadgeRow}>
            {marketBadges.map((badge) => (
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
                <Text
                  style={[
                    styles.marketBadgeLabel,
                    { color: badge.color },
                  ]}
                >
                  {badge.label}
                </Text>
                <Text
                  style={[
                    styles.marketBadgeCount,
                    { color: badge.color },
                  ]}
                >
                  {badge.count}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

// OLD MOST SOLD - BEFORE ARBITRAGE: preserved for quick rollback/reference.
export function OldMostSoldList({ onPressCard, t }: OldMostSoldListProps) {
  const { colors, displayCurrency, locale } = useThemeManager();
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMostSold() {
      setLoading(true);
      setHasError(false);

      try {
        const nextCards = await getMostSoldCards(50, displayCurrency);
        if (!cancelled) {
          setCards(nextCards);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setCards([]);
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMostSold();

    return () => {
      cancelled = true;
    };
  }, [displayCurrency]);

  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          Loading most sold cards...
        </Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.state}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          Most sold cards are unavailable.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={cards}
      extraData={locale}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      removeClippedSubviews
      updateCellsBatchingPeriod={80}
      windowSize={5}
      renderItem={({ item, index }) => (
        <TopSellerRow
          colors={colors}
          item={item}
          index={index}
          locale={locale}
          onPress={onPressCard}
          t={t}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 18,
    paddingHorizontal: 12,
  },
  cardRow: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    minHeight: 136,
    overflow: "hidden",
    padding: 10,
  },
  rankBadge: {
    alignItems: "center",
    borderRadius: 6,
    height: 28,
    justifyContent: "center",
    left: 8,
    position: "absolute",
    top: 8,
    width: 32,
    zIndex: 2,
  },
  rankText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  cardImage: {
    borderRadius: 6,
    height: 116,
    width: 82,
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
  },
  cardName: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 5,
  },
  avgPrice: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
  },
  trendIcon: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  marketBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
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
  marketBadgeLabel: {
    fontSize: 10,
    fontWeight: "800",
  },
  marketBadgeCount: {
    fontSize: 10,
    fontWeight: "900",
  },
});
