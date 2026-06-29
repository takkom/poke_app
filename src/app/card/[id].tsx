import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { useThemeManager } from "@/hooks/useThemeManager";
import { getCardById, getPriceHistory } from "@/services/cardService";
import { AppColors, colors } from "@/theme/colors";
import { CardPricing, CardWithPricing, PriceHistoryPoint } from "@/types/card";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type VariantKey = "normal" | "reverseHolofoil" | "holofoil";

type Variant = {
  key: VariantKey;
  label: string;
  enabled: boolean;
};

type TcgPrice = NonNullable<
  NonNullable<NonNullable<CardPricing["tcgplayer"]>["prices"]>[VariantKey]
>;

function formatUsd(value?: number): string | null {
  return typeof value === "number" ? `$${value.toFixed(2)}` : null;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function normalizeVariantPrice(value: unknown): TcgPrice | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const row = value as Record<string, unknown>;
  return {
    low: pickNumber(row.low, row.lowPrice),
    mid: pickNumber(row.mid, row.midPrice),
    high: pickNumber(row.high, row.highPrice),
    market: pickNumber(row.market, row.marketPrice),
  };
}

function resolveImageUrl(card: CardWithPricing): string | null {
  if (card.images?.large) {
    return `${card.images.large}/low.webp`;
  }

  if (card.images?.small) {
    return `${card.images.small}/low.webp`;
  }

  return card.image ? `${card.image}/low.webp` : null;
}

function VariantSelector({
  variants,
  selected,
  onSelect,
  colors,
}: {
  variants: readonly Variant[];
  selected: VariantKey;
  onSelect: (variant: VariantKey) => void;
  colors: AppColors;
}) {
  return (
    <View style={styles.variantContainer}>
      {variants.map((variant) => {
        const selectedVariant = selected === variant.key;
        return (
          <Pressable
            key={variant.key}
            disabled={!variant.enabled}
            onPress={() => onSelect(variant.key)}
            style={[
              styles.variantButton,
              { borderColor: colors.border },
              selectedVariant && styles.variantButtonSelected,
              selectedVariant && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
              !variant.enabled && styles.variantButtonDisabled,
              !variant.enabled && { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <Text
              style={[
                styles.variantButtonText,
                { color: colors.textSecondary },
                selectedVariant && styles.variantButtonTextSelected,
                selectedVariant && { color: colors.textPrimary },
              ]}
            >
              {variant.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PriceRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string | null;
  colors: AppColors;
}) {
  if (!value) {
    return null;
  }

  return (
    <View style={[styles.priceRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.priceValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors: themeColors } = useThemeManager();
  const [card, setCard] = useState<CardWithPricing | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<VariantKey>("normal");

  useEffect(() => {
    let cancelled = false;

    async function loadCard() {
      const cardId = Array.isArray(id) ? id[0] : id;
      if (!cardId) {
        setLoading(false);
        return;
      }

      try {
        const cardData = await getCardById(cardId);

        if (!cancelled) {
          setCard(cardData);
        }
      } catch (error) {
        console.error("Failed to load card:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCard();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const cardId = card?.id;

    if (!cardId) {
      setPriceHistory([]);
      setPriceHistoryError(null);
      setPriceHistoryLoading(false);
      return;
    }

    const requestedCardId = cardId;

    async function loadPriceHistory() {
      setPriceHistoryLoading(true);
      setPriceHistoryError(null);

      try {
        const history = await getPriceHistory(requestedCardId);
        if (!cancelled) {
          setPriceHistory(history);
        }
      } catch (error) {
        if (!cancelled) {
          setPriceHistory([]);
          setPriceHistoryError(
            error instanceof Error
              ? error.message
              : "Price history is unavailable.",
          );
        }
      } finally {
        if (!cancelled) {
          setPriceHistoryLoading(false);
        }
      }
    }

    loadPriceHistory();

    return () => {
      cancelled = true;
    };
  }, [card?.id]);

  const tcg = card?.pricing?.tcgplayer;
  const rawTcg = tcg as Record<string, unknown> | undefined;
  const tcgPrices = {
    normal: normalizeVariantPrice(tcg?.prices?.normal ?? rawTcg?.normal),
    reverseHolofoil: normalizeVariantPrice(
      tcg?.prices?.reverseHolofoil ?? rawTcg?.["reverse-holofoil"],
    ),
    holofoil: normalizeVariantPrice(tcg?.prices?.holofoil ?? rawTcg?.holofoil),
  };

  const variants = useMemo(
    () =>
      [
        { key: "normal", label: "Normal", enabled: !!tcgPrices?.normal },
        {
          key: "reverseHolofoil",
          label: "Reverse Holo",
          enabled: !!tcgPrices?.reverseHolofoil,
        },
        { key: "holofoil", label: "Holo", enabled: !!tcgPrices?.holofoil },
      ] as const,
    [tcgPrices],
  );

  useEffect(() => {
    const firstAvailable = variants.find((variant) => variant.enabled)?.key;
    if (firstAvailable) {
      setSelectedVariant(firstAvailable);
    }
  }, [variants]);

  const variantData = tcgPrices[selectedVariant] as TcgPrice | undefined;
  const cardmarket = card?.pricing?.cardmarket;
  const rawCardmarket = cardmarket as unknown as Record<string, unknown> | undefined;
  const cardmarketPrices = {
    avg30: pickNumber(cardmarket?.prices?.avg30, rawCardmarket?.avg30),
    lowPrice: pickNumber(cardmarket?.prices?.lowPrice, rawCardmarket?.lowPrice, rawCardmarket?.low),
  };
  const imageUrl = card ? resolveImageUrl(card) : null;
  const hasValidImage = Boolean(
    imageUrl && !imageUrl.includes("placeholder.png"),
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading card details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: themeColors.error }]}>Card not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.imageContainer, { backgroundColor: themeColors.background }]}>
          {hasValidImage && imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.cardImage} />
          ) : (
            <View
              style={[
                styles.fallbackCardImage,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="cards-outline"
                size={76}
                color={themeColors.textSecondary}
              />
              <Text style={[styles.fallbackImageText, { color: themeColors.textSecondary }]}>Image unavailable</Text>
            </View>
          )}
        </View>

        <View style={[styles.detailsContainer, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.cardName, { color: themeColors.textPrimary }]}>{card.name}</Text>
          {priceHistoryLoading ? (
            <View
              style={[
                styles.priceHistoryState,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <ActivityIndicator color={themeColors.primary} />
              <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading market movement...</Text>
            </View>
          ) : priceHistoryError ? (
            <View
              style={[
                styles.priceHistoryState,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: themeColors.error }]}>{priceHistoryError}</Text>
            </View>
          ) : (
            <PriceHistoryChart
              tcgdexId={card.id}
              cardName={card.name}
              priceHistory={priceHistory}
            />
          )}

          <View style={[styles.pricingSection, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.pricingTitle, { color: themeColors.textPrimary }]}>Market Prices</Text>

            {variantData ? (
              <View
                style={[
                  styles.priceCard,
                  {
                    backgroundColor: themeColors.background,
                    borderLeftColor: themeColors.primary,
                  },
                ]}
              >
                <Text style={[styles.marketName, { color: themeColors.primary }]}>TCGPlayer</Text>
                <VariantSelector
                  variants={variants}
                  selected={selectedVariant}
                  onSelect={setSelectedVariant}
                  colors={themeColors}
                />
                <PriceRow
                  label="Market"
                  value={formatUsd(variantData.market)}
                  colors={themeColors}
                />
                <PriceRow label="Low" value={formatUsd(variantData.low)} colors={themeColors} />
                <PriceRow label="Mid" value={formatUsd(variantData.mid)} colors={themeColors} />
                <PriceRow label="High" value={formatUsd(variantData.high)} colors={themeColors} />
                {tcg?.updatedAt ? (
                  <Text style={[styles.updatedAt, { color: themeColors.textMuted }]}>
                    Updated: {new Date(tcg.updatedAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {cardmarket ? (
              <View
                style={[
                  styles.priceCard,
                  {
                    backgroundColor: themeColors.background,
                    borderLeftColor: themeColors.primary,
                  },
                ]}
              >
                <Text style={[styles.marketName, { color: themeColors.primary }]}>CardMarket</Text>
                <PriceRow
                  label="30-Day Avg"
                  colors={themeColors}
                  value={
                    typeof cardmarket?.prices?.avg30 === "number"
                      ? `EUR ${cardmarket.prices.avg30.toFixed(2)}`
                      : typeof cardmarketPrices.avg30 === "number"
                        ? `EUR ${cardmarketPrices.avg30.toFixed(2)}`
                      : null
                  }
                />
                <PriceRow
                  label="Lowest"
                  colors={themeColors}
                  value={
                    typeof cardmarketPrices.lowPrice === "number"
                      ? `EUR ${cardmarketPrices.lowPrice.toFixed(2)}`
                      : null
                  }
                />
                {cardmarket.updatedAt ? (
                  <Text style={[styles.updatedAt, { color: themeColors.textMuted }]}>
                    Updated:{" "}
                    {new Date(cardmarket.updatedAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.noPricingText, { color: themeColors.textMuted }]}>
                Pricing data not available
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  imageContainer: {
    alignItems: "center",
    backgroundColor: colors.background,
    paddingVertical: 20,
  },
  cardImage: {
    height: 350,
    resizeMode: "contain",
    width: 250,
  },
  fallbackCardImage: {
    alignItems: "center",
    aspectRatio: 300 / 420,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 350,
    justifyContent: "center",
    width: 250,
  },
  fallbackImageText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
  },
  priceHistoryState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    minHeight: 160,
    justifyContent: "center",
    padding: 16,
  },
  detailsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: 18,
    marginHorizontal: 12,
    marginTop: 16,
    padding: 16,
  },
  cardName: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  pricingSection: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 18,
  },
  pricingTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  priceCard: {
    backgroundColor: colors.background,
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
  },
  marketName: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },
  variantContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  variantButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  variantButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  variantButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.5,
  },
  variantButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  variantButtonTextSelected: {
    color: colors.textPrimary,
  },
  priceRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  priceLabel: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  priceValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  updatedAt: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 8,
  },
  noPricingText: {
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: 12,
    textAlign: "center",
  },
  centerContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: "700",
  },
});
