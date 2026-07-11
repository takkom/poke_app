import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeManager, type AppLocale } from "@/hooks/useThemeManager";
import { getMostSoldArbitrageCards } from "@/services/cardService";
import { AppColors } from "@/theme/colors";
import { MarketplaceKey, PokemonCard } from "@/types/card";
import { resolveCardDisplayNumber } from "@/utils/cardNumber";
import { getCardListDisplayName } from "@/utils/displayNames";
import { Image } from "expo-image";
import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/ui/Text";

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
        isBaseline ? { backgroundColor: colors.surfaceMuted } : null,
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
          <View style={styles.cardNameRow}>
            {cardLanguageFlag(item.language) ? (
              <Text style={styles.languageFlag} accessibilityLabel={item.language === "ja" ? "Japanese" : "English"}>
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
                  Baseline
                </Text>
              ) : null}
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
    flex: 0.8,
    gap: 3,
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 6,
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
