import { CardListImage } from "@/components/CardListImage";
import { PriceTrendIndicator } from "@/components/price-trend-indicator";
import { Text } from "@/components/ui/Text";
import {
  MARKETPLACE_COLUMN_ORDER,
  MARKETPLACE_LIST_LABELS,
} from "@/constants/marketplaces";
import { useThemeManager, type AppLocale } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { getMostSoldArbitrageCards } from "@/services/cardService";
import { AppColors } from "@/theme/colors";
import { MarketplaceKey, PokemonCard } from "@/types/card";
import { resolveCardDisplayNumber } from "@/utils/cardNumber";
import { getCardListDisplayName } from "@/utils/displayNames";
import { useIsFocused } from "expo-router";
import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type ItemType = "card" | "box";

type MostSoldArbitrageListProps = {
  onPressCard: (id: string, itemType: "card" | "box") => void;
  loadingLabel: string;
  unavailableLabel: string;
  avgUnavailableLabel: string;
};

const MARKETPLACES = MARKETPLACE_COLUMN_ORDER.map((key) => ({
  key,
  label: MARKETPLACE_LIST_LABELS[key],
}));

function cardLanguageFlag(language: string | null | undefined): string | null {
  if (language === "ja") return "🇯🇵";
  if (language === "en") return "🇺🇸";
  return null;
}

function formatCardNumber(item: PokemonCard): string {
  const resolved = resolveCardDisplayNumber(item);
  return resolved || item.id;
}

function getCardSubtitle(item: PokemonCard): string | null {
  if (item.item_type === "box") {
    return item.set?.name ?? null;
  }
  return formatCardNumber(item) || null;
}

function formatMoney(
  value: number | null | undefined,
  currency: "KRW" | "USD" | "JPY",
  locale: AppLocale,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getRelativeColor(
  colors: AppColors,
  value: number | null | undefined,
): string {
  if (typeof value !== "number" || value === 0) {
    return colors.textSecondary;
  }

  return value > 0 ? colors.arbitragePositive : colors.arbitrageNegative;
}

type MarketplaceCellProps = {
  animationKey: number;
  baseline: MarketplaceKey;
  colors: AppColors;
  currency: "KRW" | "USD" | "JPY";
  highlighted: boolean;
  item: PokemonCard;
  locale: AppLocale;
  marketplace: MarketplaceKey;
  unavailableLabel: string;
};

const MarketplaceCell = memo(function MarketplaceCell({
  animationKey,
  baseline,
  colors,
  currency,
  highlighted,
  item,
  locale,
  marketplace,
  unavailableLabel,
}: MarketplaceCellProps) {
  const average = item.marketplaceAverages?.[marketplace];
  const isBaseline = baseline === marketplace;
  const relativePercent = average?.relativePercent;
  const progress = useSharedValue(0);
  const [cellWidth, setCellWidth] = useState(0);
  const highlightColor = getRelativeColor(colors, relativePercent);

  useEffect(() => {
    progress.value = 0;
    if (highlighted) {
      progress.value = withTiming(1, { duration: 900 });
    }
  }, [animationKey, highlighted, progress]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 0.16, 0.34, 1],
          [1, 1.035, 1, 1],
        ),
      },
    ],
  }));
  const borderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.08, 0.72, 1],
      [0, 0.9, 0.9, 0],
    ),
  }));
  const tracerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.08, 0.78, 1],
      [0, 1, 1, 0],
    ),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 0.08, 0.82, 1],
          [-20, -20, cellWidth, cellWidth],
        ),
      },
    ],
  }));
  const captureWidth = useCallback((event: LayoutChangeEvent) => {
    setCellWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <Animated.View
      onLayout={captureWidth}
      style={[
        styles.marketCell,
        isBaseline ? { backgroundColor: colors.surfaceMuted } : null,
        pulseStyle,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.highlightBorder,
          { borderColor: highlightColor },
          borderStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.highlightTracer,
          { backgroundColor: highlightColor },
          tracerStyle,
        ]}
      />
      <Text
        style={[styles.marketPrice, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {average?.avgPrice == null
          ? unavailableLabel
          : formatMoney(average.avgPrice, currency, locale)}
      </Text>
      {!isBaseline ? (
        <Text
          style={[
            styles.marketPercent,
            { color: getRelativeColor(colors, relativePercent) },
          ]}
          numberOfLines={1}
        >
          {formatPercent(relativePercent)}
        </Text>
      ) : null}
    </Animated.View>
  );
});

type ArbitrageRowProps = {
  animatedTrendIds: ReadonlySet<string>;
  animationKey: number;
  baseline: MarketplaceKey;
  colors: AppColors;
  currency: "KRW" | "USD" | "JPY";
  highlightedCells: ReadonlySet<string>;
  item: PokemonCard;
  locale: AppLocale;
  onPressCard: (id: string, itemType: "card" | "box") => void;
  unavailableLabel: string;
};

const ArbitrageRow = memo(function ArbitrageRow({
  animatedTrendIds,
  animationKey,
  baseline,
  colors,
  currency,
  highlightedCells,
  item,
  locale,
  onPressCard,
  unavailableLabel,
}: ArbitrageRowProps) {
  const { t } = useI18n();
  const isBox = item.item_type === "box";
  const subtitle = getCardSubtitle(item);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={() => onPressCard(item.id, item.item_type ?? "card")}
    >
      <View style={styles.cardCell}>
        <CardListImage
          uri={item.image ?? item.images?.small}
          recyclingKey={String(item.id)}
          style={isBox ? styles.boxThumbnail : styles.thumbnail}
          backgroundColor={colors.surfaceMuted}
          iconColor={colors.textSecondary}
          fallbackIcon={isBox ? "package-variant" : "cards-outline"}
        />
        <View style={styles.cardText}>
          <View style={styles.cardNameRow}>
            {cardLanguageFlag(item.language) ? (
              <Text
                style={styles.languageFlag}
                accessibilityLabel={
                  item.language === "ja"
                    ? t("home.languageJapanese")
                    : t("home.languageEnglish")
                }
              >
                {cardLanguageFlag(item.language)}
              </Text>
            ) : null}
            <Text
              style={[styles.cardName, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {getCardListDisplayName(item, locale)}
            </Text>
          </View>
          {subtitle ? (
            <Text
              style={[styles.cardNumber, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <PriceTrendIndicator
        animationKey={animationKey}
        animate={animatedTrendIds.has(String(item.id))}
        colors={colors}
        percent={item.trendPercent}
      />

      {MARKETPLACES.map((marketplace) => (
        <MarketplaceCell
          key={marketplace.key}
          animationKey={animationKey}
          baseline={baseline}
          colors={colors}
          currency={currency}
          highlighted={highlightedCells.has(`${item.id}:${marketplace.key}`)}
          item={item}
          locale={locale}
          marketplace={marketplace.key}
          unavailableLabel={unavailableLabel}
        />
      ))}
    </Pressable>
  );
});

export function MostSoldArbitrageList({
  onPressCard,
  loadingLabel,
  unavailableLabel,
  avgUnavailableLabel,
}: MostSoldArbitrageListProps) {
  const { colors, displayCurrency, locale } = useThemeManager();
  const { t } = useI18n();
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [baseline, setBaseline] = useState<MarketplaceKey>("kream");
  const [itemType, setItemType] = useState<ItemType>("card");
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [highlightedCells, setHighlightedCells] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [animatedTrendIds, setAnimatedTrendIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadArbitrageCards() {
      setLoading(true);
      setHasError(false);

      try {
        const nextCards = await getMostSoldArbitrageCards(
          50,
          displayCurrency,
          baseline,
          itemType,
          locale,
        );
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

    loadArbitrageCards();

    return () => {
      cancelled = true;
    };
  }, [baseline, displayCurrency, itemType, locale]);

  useEffect(() => {
    if (!isFocused || loading || cards.length === 0 || reduceMotion) {
      setHighlightedCells(new Set());
      setAnimatedTrendIds(new Set());
      return;
    }

    const visibleCards = cards.slice(0, 4);
    const marketCandidates = visibleCards.flatMap((card) =>
      MARKETPLACES.flatMap(({ key }) => {
        const relativePercent = card.marketplaceAverages?.[key]?.relativePercent;
        return key !== baseline &&
          typeof relativePercent === "number" &&
          Number.isFinite(relativePercent) &&
          relativePercent !== 0
          ? [`${card.id}:${key}`]
          : [];
      }),
    );
    const trendCandidates = visibleCards
      .filter(
        (card) =>
          typeof card.trendPercent === "number" &&
          Number.isFinite(card.trendPercent),
      )
      .map((card) => String(card.id));

    const shuffledMarkets = [...marketCandidates].sort(() => Math.random() - 0.5);
    const shuffledTrends = [...trendCandidates].sort(() => Math.random() - 0.5);
    const marketCount = Math.min(
      shuffledMarkets.length,
      1 + Math.floor(Math.random() * 3),
    );
    const trendCount = Math.min(
      shuffledTrends.length,
      Math.floor(Math.random() * 4),
    );

    setHighlightedCells(new Set(shuffledMarkets.slice(0, marketCount)));
    setAnimatedTrendIds(new Set(shuffledTrends.slice(0, trendCount)));
    setAnimationKey((current) => current + 1);
  }, [baseline, cards, isFocused, loading, reduceMotion]);

  const renderColumnHeader = useCallback(
    () => (
      <View
        style={[
          styles.headerRow,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardHeader, { color: colors.textSecondary }]}>
          {itemType === "box" ? t("home.itemBox") : t("home.itemCard")}
        </Text>
        <Text style={[styles.trendHeader, { color: colors.textSecondary }]}>
          {t("home.priceTrend")}
        </Text>
        {MARKETPLACES.map((marketplace) => {
          const isBaseline = baseline === marketplace.key;
          return (
            <Pressable
              key={marketplace.key}
              style={[
                styles.marketHeader,
                isBaseline
                  ? {
                      backgroundColor: `${colors.primary}14`,
                      borderColor: colors.primary,
                      borderWidth: 1,
                    }
                  : {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
              ]}
              onPress={() => setBaseline(marketplace.key)}
            >
              <Text
                style={[
                  styles.marketHeaderText,
                  { color: isBaseline ? colors.primary : colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {marketplace.label}
              </Text>
              {isBaseline ? (
                <Text
                  style={[
                    styles.marketHeaderBaseline,
                    { color: colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {t("home.baseline")}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    ),
    [baseline, colors, itemType, t],
  );

  const typeToggle = (
    <View
      style={[
        styles.typeToggle,
        {
          backgroundColor: colors.surfaceAlternate,
          borderColor: colors.border,
        },
      ]}
    >
      {(["card", "box"] as const).map((type) => {
        const active = itemType === type;
        return (
          <Pressable
            key={type}
            onPress={() => {
              if (type !== itemType) {
                setItemType(type);
                setCards([]);
              }
            }}
            style={[
              styles.typeToggleButton,
              active ? { backgroundColor: colors.primary } : null,
            ]}
          >
            <Text
              style={[
                styles.typeToggleText,
                { color: active ? colors.onPrimary : colors.textSecondary },
              ]}
            >
              {type === "box" ? t("home.itemBox") : t("home.itemCard")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.outerContainer}>
        {typeToggle}
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            {loadingLabel}
          </Text>
        </View>
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.outerContainer}>
        {typeToggle}
        <View style={styles.state}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {unavailableLabel}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      {typeToggle}
      <FlatList
        data={cards}
        extraData={`${locale}-${baseline}-${itemType}-${animationKey}`}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderColumnHeader}
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={80}
        windowSize={7}
        renderItem={({ item }) => (
          <ArbitrageRow
            animatedTrendIds={animatedTrendIds}
            animationKey={animationKey}
            baseline={baseline}
            colors={colors}
            currency={item.displayCurrency ?? displayCurrency}
            highlightedCells={highlightedCells}
            item={item}
            locale={locale}
            onPressCard={onPressCard}
            unavailableLabel={avgUnavailableLabel}
          />
        )}
      />
    </View>
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
  outerContainer: {
    flex: 1,
    paddingTop: 16,
  },
  listContent: {
    gap: 6,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  typeToggle: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 16,
    padding: 4,
  },
  typeToggleButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 10,
  },
  typeToggleText: {
    fontSize: 14,
    fontWeight: "700",
  },
  headerRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingBottom: 8,
    paddingTop: 8,
  },
  cardHeader: {
    flex: 1.45,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  trendHeader: {
    flex: 0.54,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  marketHeader: {
    alignItems: "center",
    borderRadius: 8,
    flex: 0.68,
    gap: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  marketHeaderText: {
    fontSize: 11,
    fontWeight: "900",
  },
  marketHeaderBaseline: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  row: {
    alignItems: "stretch",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 76,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  cardCell: {
    alignItems: "center",
    flex: 1.45,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  thumbnail: {
    borderRadius: 4,
    height: 58,
    width: 42,
  },
  boxThumbnail: {
    borderRadius: 4,
    height: 58,
    width: 58,
  },
  cardText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  cardNameRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 4,
  },
  languageFlag: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  cardName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  cardNumber: {
    fontSize: 11,
    fontWeight: "700",
  },
  marketCell: {
    alignItems: "center",
    borderRadius: 7,
    flex: 0.68,
    gap: 3,
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 6,
    overflow: "hidden",
    position: "relative",
  },
  marketPrice: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    textAlign: "center",
  },
  marketPercent: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    textAlign: "center",
  },
  highlightBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  highlightTracer: {
    borderRadius: 2,
    height: 2,
    left: 0,
    position: "absolute",
    top: 0,
    width: 20,
  },
});
