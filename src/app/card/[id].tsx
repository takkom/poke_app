import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { QualitySelector } from "@/components/QualitySelector";
import { useThemeManager } from "@/hooks/useThemeManager";
import { useI18n, type TranslationKey } from "@/i18n";
import {
  getCardById,
  getPriceHistory,
  getPriceHistoryQualities,
} from "@/services/cardService";
import { AppColors } from "@/theme/colors";
import {
  CardPricing,
  CardWithPricing,
  PriceHistoryPoint,
  QualityBucket,
  QualityBucketCode,
} from "@/types/card";
import { getDisplayCardName } from "@/utils/displayNames";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";

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

function formatSalesCount(value: number | null | undefined, locale: string): string {
  return (value ?? 0).toLocaleString(locale);
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

// Coarse quality buckets, shown as chips regardless of whether the backend's
// /price-history/qualities endpoint is available yet. Mirrors
// api/src/price-history/quality-bucket.ts on the backend - keep in sync.
const ALL_QUALITY_BUCKETS: Array<{ code: QualityBucketCode; labelKey: TranslationKey }> = [
  { code: "PSA_10", labelKey: "quality.psa10" },
  { code: "RAW", labelKey: "quality.raw" },
  { code: "PSA_9", labelKey: "quality.psa9" },
  { code: "OTHER_GRADED", labelKey: "quality.otherGraded" },
  { code: "PSA_8_OR_LOWER", labelKey: "quality.psa8OrLower" },
];

const DEFAULT_QUALITY: QualityBucketCode = "PSA_10";

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
    return card.images.large;
  }

  if (card.images?.small) {
    return card.images.small;
  }

  return card.image ?? null;
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
                selectedVariant && { color: colors.onPrimary },
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
  const { colors: themeColors, displayCurrency, locale } = useThemeManager();
  const { t } = useI18n();
  const [card, setCard] = useState<CardWithPricing | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<VariantKey>("normal");
  const [qualityOptions, setQualityOptions] = useState<QualityBucket[]>([]);
  const [selectedQualities, setSelectedQualities] = useState<QualityBucketCode[]>([
    DEFAULT_QUALITY,
  ]);

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

    setQualityOptions([]);
    // Default to PSA 10 immediately so the very first price-history fetch
    // for this card already goes out with a quality filter, instead of
    // waiting on the (optional) counts endpoint to resolve first.
    setSelectedQualities([DEFAULT_QUALITY]);

    if (!cardId) {
      return;
    }

    async function loadQualities() {
      // Fails soft (returns []) if the backend counts endpoint isn't live
      // yet - the chips below still render from the static bucket list.
      const options = await getPriceHistoryQualities(cardId as string);
      if (!cancelled) {
        setQualityOptions(options);
      }
    }

    loadQualities();

    return () => {
      cancelled = true;
    };
  }, [card?.id]);

  const displayQualityOptions = useMemo<QualityBucket[]>(() => {
    const byCode = new Map(qualityOptions.map((option) => [option.code, option]));
    return ALL_QUALITY_BUCKETS.map(({ code, labelKey }) => {
      const remote = byCode.get(code);
      return {
        code,
        label: remote?.label ?? t(labelKey),
        count: remote?.count ?? 0,
        avg_price_krw: remote?.avg_price_krw ?? null,
        min_price_krw: remote?.min_price_krw ?? null,
        max_price_krw: remote?.max_price_krw ?? null,
      };
    });
  }, [qualityOptions, t]);

  const toggleQuality = (code: QualityBucketCode) => {
    setSelectedQualities((current) => {
      if (current.includes(code)) {
        // Always keep at least one quality selected so the chart never
        // silently falls back to showing every quality mixed together.
        return current.length === 1 ? current : current.filter((item) => item !== code);
      }
      return [...current, code];
    });
  };

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
    // Empty selection means "no quality filter yet" (e.g. qualities are
    // still loading, or the bucket endpoint isn't available) - fall back to
    // the old unfiltered behavior instead of blocking the chart entirely.
    const requestedQualities = selectedQualities.length
      ? selectedQualities
      : undefined;

    async function loadPriceHistory() {
      setPriceHistoryLoading(true);
      setPriceHistoryError(null);

      try {
        const history = await getPriceHistory(
          requestedCardId,
          displayCurrency,
          requestedQualities,
        );
        if (!cancelled) {
          setPriceHistory(history);
        }
      } catch (error) {
        if (!cancelled) {
          setPriceHistory([]);
          setPriceHistoryError(
            error instanceof Error
              ? error.message
              : t('card.priceHistoryUnavailable'),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, displayCurrency, selectedQualities.join(",")]);

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
  const displayName = card ? getDisplayCardName(card, locale) : "";
  const hasValidImage = Boolean(
    imageUrl && !imageUrl.includes("placeholder.png"),
  );
  const marketBadges = card
    ? [
        card.hasKream
          ? {
              key: "kream",
              label: "KREAM",
              count: formatSalesCount(card.kreamSales, locale),
              color: themeColors.marketplaces.kream,
            }
          : null,
        card.hasEbay
          ? {
              key: "ebay",
              label: "eBay",
              count: formatSalesCount(card.ebaySales, locale),
              color: themeColors.marketplaces.ebay,
            }
          : null,
        card.hasSnkrdunk
          ? {
              key: "snkrdunk",
              label: "SNK",
              count: formatSalesCount(card.snkrdunkSales, locale),
              color: themeColors.marketplaces.snkrdunk,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; count: string; color: string }>
    : [];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('card.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: themeColors.error }]}>{t('card.notFound')}</Text>
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
              <Text style={[styles.fallbackImageText, { color: themeColors.textSecondary }]}>{t('card.imageUnavailable')}</Text>
            </View>
          )}
        </View>

        <View style={[styles.detailsContainer, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.cardName, { color: themeColors.primary }]}>{displayName}</Text>
          {marketBadges.length ? (
            <View style={styles.marketBadgeRow}>
              {marketBadges.map((badge) => (
                <View
                  key={badge.key}
                  style={[
                    styles.marketBadge,
                    { borderColor: badge.color, backgroundColor: `${badge.color}22` },
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
          <QualitySelector
            qualities={displayQualityOptions}
            selected={selectedQualities}
            onToggle={toggleQuality}
            locale={locale}
          />
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
              <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('card.loadingMarket')}</Text>
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
              cardName={displayName}
              priceHistory={priceHistory}
              displayCurrency={displayCurrency}
              locale={locale}
            />
          )}

          <View style={[styles.pricingSection, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.pricingTitle, { color: themeColors.textPrimary }]}>{t('card.marketPrices')}</Text>

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
                  label={t('card.market')}
                  value={formatUsd(variantData.market)}
                  colors={themeColors}
                />
                <PriceRow label={t('card.low')} value={formatUsd(variantData.low)} colors={themeColors} />
                <PriceRow label={t('card.mid')} value={formatUsd(variantData.mid)} colors={themeColors} />
                <PriceRow label={t('card.high')} value={formatUsd(variantData.high)} colors={themeColors} />
                {tcg?.updatedAt ? (
                  <Text style={[styles.updatedAt, { color: themeColors.textMuted }]}>
                    {t('card.updated', { date: new Date(tcg.updatedAt).toLocaleDateString(locale) })}
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
                  label={t('card.avg30')}
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
                  label={t('card.lowest')}
                  colors={themeColors}
                  value={
                    typeof cardmarketPrices.lowPrice === "number"
                      ? `EUR ${cardmarketPrices.lowPrice.toFixed(2)}`
                      : null
                  }
                />
                {cardmarket.updatedAt ? (
                  <Text style={[styles.updatedAt, { color: themeColors.textMuted }]}>
                    {t('card.updated', { date: new Date(cardmarket.updatedAt).toLocaleDateString(locale) })}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.noPricingText, { color: themeColors.textMuted }]}>
                {t('card.noPricing')}
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
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  imageContainer: {
    alignItems: "center",
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
    borderRadius: 8,
    borderWidth: 1,
    height: 350,
    justifyContent: "center",
    width: 250,
  },
  fallbackImageText: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
  },
  priceHistoryState: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    minHeight: 160,
    justifyContent: "center",
    padding: 16,
  },
  detailsContainer: {
    borderRadius: 8,
    gap: 18,
    marginHorizontal: 12,
    marginTop: 16,
    padding: 16,
  },
  cardName: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  marketBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginTop: -6,
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
  pricingSection: {
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 18,
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  priceCard: {
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
  },
  marketName: {
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
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  variantButtonSelected: {
  },
  variantButtonDisabled: {
    opacity: 0.5,
  },
  variantButtonText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  variantButtonTextSelected: {
  },
  priceRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  priceLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  updatedAt: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 8,
  },
  noPricingText: {
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
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
