import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeManager, type AppLocale } from "@/hooks/useThemeManager";
import { getMostSoldArbitrageCards } from "@/services/cardService";
import { AppColors } from "@/theme/colors";
import { MarketplaceKey, PokemonCard } from "@/types/card";
import {
  cleanMarketplaceTitle,
  getDisplayCardName,
} from "@/utils/displayNames";
import { Image } from "expo-image";
import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ItemType = "card" | "box";

type MostSoldArbitrageListProps = {
  onPressCard: (id: string, itemType: "card" | "box") => void;
  loadingLabel: string;
  unavailableLabel: string;
  avgUnavailableLabel: string;
};

const MARKETPLACES: Array<{ key: MarketplaceKey; label: string }> = [
  { key: "kream", label: "Kream" },
  { key: "ebay", label: "ebay" },
  { key: "snkrdunk", label: "SNKR" },
];

function formatCardNumber(item: PokemonCard): string {
  if (!item.number) {
    return item.id;
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

function getDisplayName(item: PokemonCard, locale: AppLocale): string {
  return locale === "ko-KR"
    ? (cleanMarketplaceTitle(item.kreamTitle) ?? getDisplayCardName(item, locale))
    : getDisplayCardName(item, locale);
}

type MarketplaceCellProps = {
  baseline: MarketplaceKey;
  colors: AppColors;
  currency: "KRW" | "USD" | "JPY";
  item: PokemonCard;
  locale: AppLocale;
  marketplace: MarketplaceKey;
  unavailableLabel: string;
};

const MarketplaceCell = memo(function MarketplaceCell({
  baseline,
  colors,
  currency,
  item,
  locale,
  marketplace,
  unavailableLabel,
}: MarketplaceCellProps) {
  const average = item.marketplaceAverages?.[marketplace];
  const isBaseline = baseline === marketplace;
  const relativePercent = average?.relativePercent;

  return (
    <View
      style={[
        styles.marketCell,
        isBaseline
          ? {
              backgroundColor: `${colors.primary}18`,
              borderColor: colors.primary,
            }
          : { borderColor: "transparent" },
      ]}
    >
      <Text
        style={[styles.marketPrice, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {average?.avgPrice == null
          ? unavailableLabel
          : formatMoney(average.avgPrice, currency, locale)}
      </Text>
      <Text
        style={[
          styles.marketPercent,
          {
            color: isBaseline
              ? colors.primary
              : getRelativeColor(colors, relativePercent),
          },
        ]}
        numberOfLines={1}
      >
        {isBaseline ? "Baseline" : formatPercent(relativePercent)}
      </Text>
    </View>
  );
});

type ArbitrageRowProps = {
  baseline: MarketplaceKey;
  colors: AppColors;
  currency: "KRW" | "USD" | "JPY";
  item: PokemonCard;
  locale: AppLocale;
  onPressCard: (id: string, itemType: "card" | "box") => void;
  unavailableLabel: string;
};

const ArbitrageRow = memo(function ArbitrageRow({
  baseline,
  colors,
  currency,
  item,
  locale,
  onPressCard,
  unavailableLabel,
}: ArbitrageRowProps) {
  const isBox = item.item_type === "box";
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
        {isBox && !item.image && !item.images?.small ? (
          <View
            style={[
              styles.boxThumbnail,
              styles.imageFallback,
              { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <MaterialCommunityIcons
              name="package-variant"
              color={colors.textSecondary}
              size={26}
            />
          </View>
        ) : (
          <Image
            source={
              item.image ??
              item.images?.small ??
              "https://images.tcgdex.net/placeholder.png"
            }
            style={[
              isBox ? styles.boxThumbnail : styles.thumbnail,
              { backgroundColor: colors.surfaceMuted },
            ]}
            contentFit="cover"
          />
        )}
        <View style={styles.cardText}>
          <Text
            style={[styles.cardName, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {getDisplayName(item, locale)}
          </Text>
          {item.set?.name ? (
            <Text
              style={[styles.cardNumber, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.set.name}
            </Text>
          ) : formatCardNumber(item) ? (
            <Text
              style={[styles.cardNumber, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {formatCardNumber(item)}
            </Text>
          ) : null}
        </View>
      </View>

      {MARKETPLACES.map((marketplace) => (
        <MarketplaceCell
          key={marketplace.key}
          baseline={baseline}
          colors={colors}
          currency={currency}
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
  const [baseline, setBaseline] = useState<MarketplaceKey>("kream");
  const [itemType, setItemType] = useState<ItemType>("card");
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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
  }, [baseline, displayCurrency, itemType]);

  const renderColumnHeader = useCallback(
    () => (
      <View
        style={[
          styles.headerRow,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardHeader, { color: colors.textSecondary }]}>
          {itemType === "box" ? "Box" : "Card"}
        </Text>
        {MARKETPLACES.map((marketplace) => {
          const isSelected = baseline === marketplace.key;
          return (
            <Pressable
              key={marketplace.key}
              style={[
                styles.marketHeader,
                {
                  backgroundColor: isSelected
                    ? `${colors.primary}22`
                    : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setBaseline(marketplace.key)}
            >
              <Text
                style={[
                  styles.marketHeaderText,
                  { color: isSelected ? colors.primary : colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {marketplace.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [baseline, colors, itemType],
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
              {type === "box" ? "Box" : "Card"}
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
        extraData={`${locale}-${baseline}-${itemType}`}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderColumnHeader}
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        removeClippedSubviews
        updateCellsBatchingPeriod={80}
        windowSize={7}
        renderItem={({ item }) => (
          <ArbitrageRow
            baseline={baseline}
            colors={colors}
            currency={item.displayCurrency ?? displayCurrency}
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
  },
  listContent: {
    gap: 8,
    paddingBottom: 18,
    paddingHorizontal: 10,
  },
  typeToggle: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
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
    borderWidth: 1,
    flex: 0.8,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 2,
  },
  marketHeaderText: {
    fontSize: 11,
    fontWeight: "900",
  },
  row: {
    alignItems: "stretch",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 76,
    padding: 8,
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
  imageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  cardName: {
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
    borderWidth: 1,
    flex: 0.8,
    gap: 3,
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: 2,
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
});
