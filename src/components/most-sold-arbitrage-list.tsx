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
import { AppColors, withAlpha } from "@/theme/colors";
import { MarketplaceKey, PokemonCard } from "@/types/card";
import { resolveCardDisplayNumber } from "@/utils/cardNumber";
import { getCardListDisplayName } from "@/utils/displayNames";
import { useIsFocused } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ViewToken } from "@react-native/virtualized-lists";
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type RefreshSnakeBorderProps = {
  active: boolean;
  color: string;
  radius: number;
};

const RefreshSnakeBorder = memo(function RefreshSnakeBorder({
  active,
  color,
  radius,
}: RefreshSnakeBorderProps) {
  const progress = useSharedValue(0);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const perimeter = Math.max(1, 2 * (size.width + size.height - 4));

  useEffect(() => {
    progress.value = 0;
    if (active) {
      progress.value = withRepeat(withTiming(1, { duration: 900 }), -1, false);
    }
    return () => cancelAnimation(progress);
  }, [active, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: -progress.value * perimeter,
  }));

  const captureSize = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setSize({ height, width });
  }, []);

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      onLayout={captureSize}
      style={styles.refreshSnakeOverlay}
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg width={size.width} height={size.height}>
          <AnimatedRect
            animatedProps={animatedProps}
            x={1}
            y={1}
            width={Math.max(0, size.width - 2)}
            height={Math.max(0, size.height - 2)}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={color}
            strokeDasharray={[28, Math.max(1, perimeter - 28)]}
            strokeLinecap="round"
            strokeWidth={2}
          />
        </Svg>
      ) : null}
    </View>
  );
});

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
  reduceMotion: boolean;
  refreshAnimating: boolean;
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
  reduceMotion,
  refreshAnimating,
  unavailableLabel,
}: MarketplaceCellProps) {
  const average = item.marketplaceAverages?.[marketplace];
  const isBaseline = baseline === marketplace;
  const relativePercent = average?.relativePercent;
  const progress = useSharedValue(0);
  const [cellSize, setCellSize] = useState({ height: 0, width: 0 });
  const highlightColor = getRelativeColor(colors, relativePercent);
  const perimeter = Math.max(1, 2 * (cellSize.width + cellSize.height - 4));

  useEffect(() => {
    progress.value = 0;
    if (highlighted) {
      progress.value = reduceMotion ? 1 : withTiming(1, { duration: 3000 });
    }
  }, [animationKey, highlighted, progress, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 0.04, 0.1, 1],
          [1, 1.035, 1, 1],
        ),
      },
    ],
  }));
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.03, 1],
      [0, 1, 1],
    ),
  }));
  const tracerProps = useAnimatedProps(() => ({
    strokeDashoffset: -progress.value * perimeter * 2,
  }));
  const completedBorderProps = useAnimatedProps(() => {
    const fillProgress = interpolate(
      progress.value,
      [0.5, 1],
      [0, 1],
      "clamp",
    );
    return {
      strokeDashoffset: perimeter * (1 - fillProgress),
    };
  });
  const captureWidth = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setCellSize({ height, width });
  }, []);

  return (
    <Animated.View
      onLayout={captureWidth}
      style={[
        styles.marketCell,
        isBaseline
          ? { backgroundColor: withAlpha(colors.surfaceMuted, 0.3) }
          : null,
        pulseStyle,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.highlightOverlay, highlightStyle]}
      >
        {cellSize.width > 0 && cellSize.height > 0 ? (
          <Svg width={cellSize.width} height={cellSize.height}>
            <Rect
              x={1}
              y={1}
              width={Math.max(0, cellSize.width - 2)}
              height={Math.max(0, cellSize.height - 2)}
              rx={6}
              ry={6}
              fill="none"
              stroke={highlightColor}
              strokeOpacity={0.3}
              strokeWidth={2}
            />
            <AnimatedRect
              animatedProps={completedBorderProps}
              x={1}
              y={1}
              width={Math.max(0, cellSize.width - 2)}
              height={Math.max(0, cellSize.height - 2)}
              rx={6}
              ry={6}
              fill="none"
              stroke={highlightColor}
              strokeDasharray={[perimeter, perimeter]}
              strokeLinecap="round"
              strokeWidth={2}
            />
            {!reduceMotion ? (
              <AnimatedRect
                animatedProps={tracerProps}
                x={1}
                y={1}
                width={Math.max(0, cellSize.width - 2)}
                height={Math.max(0, cellSize.height - 2)}
                rx={6}
                ry={6}
                fill="none"
                stroke={highlightColor}
                strokeDasharray={[24, Math.max(1, perimeter - 24)]}
                strokeLinecap="round"
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        ) : null}
      </Animated.View>
      <RefreshSnakeBorder
        active={refreshAnimating}
        color={colors.primary}
        radius={6}
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
  animationKey: number;
  baseline: MarketplaceKey;
  colors: AppColors;
  currency: "KRW" | "USD" | "JPY";
  highlightedCells: ReadonlySet<string>;
  item: PokemonCard;
  locale: AppLocale;
  onPressCard: (id: string, itemType: "card" | "box") => void;
  reduceMotion: boolean;
  refreshAnimating: boolean;
  unavailableLabel: string;
};

const ArbitrageRow = memo(function ArbitrageRow({
  animationKey,
  baseline,
  colors,
  currency,
  highlightedCells,
  item,
  locale,
  onPressCard,
  reduceMotion,
  refreshAnimating,
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
      <RefreshSnakeBorder
        active={refreshAnimating}
        color={colors.primary}
        radius={7}
      />
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
            <View style={styles.cardNumberRow}>
              <Text
                style={[styles.cardNumber, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
              <PriceTrendIndicator
                colors={colors}
                direction={item.trendDirection}
                percent={item.trendPercent}
              />
            </View>
          ) : null}
        </View>
      </View>

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
          reduceMotion={reduceMotion}
          refreshAnimating={refreshAnimating}
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
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [highlightedCells, setHighlightedCells] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [visibleCardIds, setVisibleCardIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 40 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<PokemonCard>> }) => {
      const nextIds = new Set(
        viewableItems
          .filter(({ isViewable }) => isViewable)
          .map(({ item }) => String(item.id)),
      );
      setVisibleCardIds((currentIds) => {
        if (
          currentIds.size === nextIds.size &&
          [...currentIds].every((id) => nextIds.has(id))
        ) {
          return currentIds;
        }
        return nextIds;
      });
    },
  ).current;

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

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);
    setHighlightedCells(new Set());
    const minimumAnimation = new Promise<void>((resolve) => {
      setTimeout(resolve, 1000);
    });

    try {
      const [nextCards] = await Promise.all([
        getMostSoldArbitrageCards(
          50,
          displayCurrency,
          baseline,
          itemType,
          locale,
        ),
        minimumAnimation,
      ]);
      setCards(nextCards);
      setHasError(false);
    } catch (refreshError) {
      await minimumAnimation;
      console.error(refreshError);
    } finally {
      setRefreshing(false);
    }
  }, [baseline, displayCurrency, itemType, locale, refreshing]);

  useEffect(() => {
    if (!isFocused || loading || refreshing || cards.length === 0) {
      setHighlightedCells(new Set());
      return;
    }

    let nextCycle: ReturnType<typeof setTimeout> | undefined;

    const updateHighlights = () => {
      const marketCandidates = cards
        .filter((card) => visibleCardIds.has(String(card.id)))
        .flatMap((card) =>
          MARKETPLACES.flatMap(({ key }) => {
            const relativePercent =
              card.marketplaceAverages?.[key]?.relativePercent;
            return key !== baseline &&
              typeof relativePercent === "number" &&
              Number.isFinite(relativePercent) &&
              relativePercent !== 0
              ? [`${card.id}:${key}`]
              : [];
          }),
        );

      for (let index = marketCandidates.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [marketCandidates[index], marketCandidates[swapIndex]] = [
          marketCandidates[swapIndex],
          marketCandidates[index],
        ];
      }

      const maximumCount = Math.min(9, marketCandidates.length);
      const minimumCount = Math.min(2, maximumCount);
      const highlightCount =
        minimumCount +
        Math.floor(Math.random() * (maximumCount - minimumCount + 1));

      setHighlightedCells(new Set(marketCandidates.slice(0, highlightCount)));
      setAnimationKey((current) => current + 1);
      nextCycle = setTimeout(updateHighlights, 2000 + Math.random() * 2000);
    };

    updateHighlights();
    return () => {
      if (nextCycle) clearTimeout(nextCycle);
    };
  }, [baseline, cards, isFocused, loading, refreshing, visibleCardIds]);

  const renderColumnHeader = useCallback(
    () => (
      <View
        style={[
          styles.headerRow,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardHeader, { color: colors.textSecondary }]}>
          {t("home.namePriceTrend")}
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
        extraData={`${locale}-${baseline}-${itemType}-${animationKey}-${refreshing}-${reduceMotion}`}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderColumnHeader}
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
            tintColor={colors.primary}
          />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        onViewableItemsChanged={onViewableItemsChanged}
        updateCellsBatchingPeriod={80}
        viewabilityConfig={viewabilityConfig}
        windowSize={7}
        renderItem={({ item }) => (
          <ArbitrageRow
            animationKey={animationKey}
            baseline={baseline}
            colors={colors}
            currency={item.displayCurrency ?? displayCurrency}
            highlightedCells={highlightedCells}
            item={item}
            locale={locale}
            onPressCard={onPressCard}
            reduceMotion={reduceMotion}
            refreshAnimating={refreshing && !reduceMotion}
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
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
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
    gap: 6,
    paddingBottom: 8,
    paddingTop: 8,
  },
  cardHeader: {
    flex: 1.45,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  marketHeader: {
    alignItems: "center",
    borderRadius: 8,
    flex: 0.8,
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
    gap: 6,
    minHeight: 76,
    overflow: "hidden",
    padding: 8,
    position: "relative",
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
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  cardNumberRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    minWidth: 0,
  },
  marketCell: {
    alignItems: "center",
    borderRadius: 7,
    flex: 0.8,
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
  highlightOverlay: {
    ...StyleSheet.absoluteFill,
  },
  refreshSnakeOverlay: {
    ...StyleSheet.absoluteFill,
  },
});
