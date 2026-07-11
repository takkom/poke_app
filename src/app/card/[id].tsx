import { AddToCollectionModal } from "@/components/AddToCollectionModal";
import { MarketplaceArbitragePanel } from "@/components/MarketplaceArbitragePanel";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { useThemeManager } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { getCardById, getPriceHistory, applyBaselineArbitrage, deriveMarketplaceAveragesFromPriceHistory } from "@/services/cardService";
import {
  CardWithPricing,
  MarketplaceKey,
  PriceHistoryPoint,
  QualityBucketCode,
} from "@/types/card";
import {
  MARKETPLACE_BADGE_LABELS,
  MARKETPLACE_COLUMN_ORDER,
} from "@/constants/marketplaces";
import { getDisplayCardName, getCardDetailRarity, getDisplaySetName } from "@/utils/displayNames";
import { resolveCardDisplayNumber } from "@/utils/cardNumber";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";

function formatSalesCount(value: number | null | undefined, locale: string): string {
  return (value ?? 0).toLocaleString(locale);
}

function cardLanguageFlag(language: string | null | undefined): string | null {
  if (language === "ja") return "🇯🇵";
  if (language === "en") return "🇺🇸";
  return null;
}

// Price history is locked to PSA 10 for now. Comparing RAW eBay prices to
// PSA 10 KREAM/SNKRDUNK prices was misleading (e.g. Clefairy 86/80).
const DEFAULT_QUALITY: QualityBucketCode = "PSA_10";

function resolveImageUrl(card: CardWithPricing): string | null {
  if (card.images?.large) {
    return card.images.large;
  }

  if (card.images?.small) {
    return card.images.small;
  }

  return card.image ?? null;
}

const CARD_ASPECT_RATIO = 2.5 / 3.5;

const MARKETPLACE_SALES_ORDER = MARKETPLACE_COLUMN_ORDER;

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();
  const { colors: themeColors, displayCurrency, locale } = useThemeManager();
  const { t } = useI18n();
  const [card, setCard] = useState<CardWithPricing | null>(null);
  const [baseline, setBaseline] = useState<MarketplaceKey>("kream");
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCard() {
      const cardId = Array.isArray(id) ? id[0] : id;
      if (!cardId) {
        setLoading(false);
        return;
      }

      try {
        const cardData = await getCardById(cardId, {
          baseline,
          currency: displayCurrency,
          locale,
        });

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
  }, [id, displayCurrency, locale]);

  const cardWithBaseline = useMemo(
    () => (card ? applyBaselineArbitrage(card, baseline) : null),
    [card, baseline],
  );

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
        const history = await getPriceHistory(
          requestedCardId,
          displayCurrency,
          [DEFAULT_QUALITY],
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
  }, [card?.id, displayCurrency, t]);

  const imageUrl = card ? resolveImageUrl(card) : null;
  const displayName = card ? getDisplayCardName(card, locale) : "";
  const displayNumber = card ? resolveCardDisplayNumber(card) : "";
  const displaySetName = card ? getDisplaySetName(card) : null;
  const displayRarity = card ? getCardDetailRarity(card.rarity, locale) : null;
  const languageFlag = card ? cardLanguageFlag(card.language) : null;
  const hasValidImage = Boolean(
    imageUrl && !imageUrl.includes("placeholder.png"),
  );
  const cardImageSize = useMemo(() => {
    const imageWidth = Math.round(screenWidth * 0.3);
    const imageHeight = imageWidth / CARD_ASPECT_RATIO;

    return { width: imageWidth, height: imageHeight };
  }, [screenWidth]);

  const cardForArbitrage = useMemo(() => {
    if (!card) {
      return null;
    }

    const hasApiAverages = MARKETPLACE_COLUMN_ORDER.some(
      (marketplace) =>
        cardWithBaseline?.marketplaceAverages?.[marketplace]?.avgPrice != null,
    );

    if (hasApiAverages && cardWithBaseline) {
      return cardWithBaseline;
    }

    const derivedAverages = deriveMarketplaceAveragesFromPriceHistory(priceHistory);
    const hasDerivedAverages = MARKETPLACE_COLUMN_ORDER.some(
      (marketplace) => derivedAverages[marketplace]?.avgPrice != null,
    );

    if (!hasDerivedAverages) {
      return cardWithBaseline ?? card;
    }

    return applyBaselineArbitrage(
      {
        ...card,
        marketplaceAverages: derivedAverages,
      },
      baseline,
    );
  }, [baseline, card, cardWithBaseline, priceHistory]);

  const marketplaceSales = card
    ? MARKETPLACE_SALES_ORDER.flatMap((key) => {
        const hasMarketplace =
          (key === "ebay" && card.hasEbay) ||
          (key === "kream" && card.hasKream) ||
          (key === "snkrdunk" && card.hasSnkrdunk);

        if (!hasMarketplace) {
          return [];
        }

        const sales =
          key === "ebay"
            ? card.ebaySales
            : key === "kream"
              ? card.kreamSales
              : card.snkrdunkSales;

        return [
          {
            key,
            label: MARKETPLACE_BADGE_LABELS[key],
            count: formatSalesCount(sales, locale),
            color: themeColors.marketplaces[key],
          },
        ];
      })
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
        <View style={[styles.detailsContainer, { backgroundColor: themeColors.surface }]}>
          <View style={styles.heroRow}>
            <View style={styles.heroImageWrap}>
              {hasValidImage && imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={[styles.cardImage, cardImageSize]}
                  contentFit="contain"
                  transition={200}
                />
              ) : (
                <View
                  style={[
                    styles.fallbackCardImage,
                    cardImageSize,
                    {
                      backgroundColor: themeColors.background,
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="cards-outline"
                    size={48}
                    color={themeColors.textSecondary}
                  />
                  <Text style={[styles.fallbackImageText, { color: themeColors.textSecondary }]}>
                    {t("card.imageUnavailable")}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.heroText}>
              <View style={styles.cardNameRow}>
                {languageFlag ? (
                  <Text
                    style={styles.languageFlag}
                    accessibilityLabel={card.language === "ja" ? "Japanese" : "English"}
                  >
                    {languageFlag}
                  </Text>
                ) : null}
                <Text style={[styles.cardName, { color: themeColors.primary }]} numberOfLines={4}>
                  {displayName}
                </Text>
              </View>
              {displayNumber || displayRarity ? (
                <Text style={[styles.cardNumber, { color: themeColors.textSecondary }]}>
                  {displayNumber ? `#${displayNumber}` : null}
                  {displayNumber && displayRarity ? " · " : null}
                  {displayRarity}
                </Text>
              ) : null}
              {displaySetName ? (
                <Text
                  style={[styles.setName, { color: themeColors.textMuted }]}
                  numberOfLines={2}
                >
                  {displaySetName}
                </Text>
              ) : null}
            </View>
          </View>

          <MarketplaceArbitragePanel
            baseline={baseline}
            card={cardForArbitrage ?? card}
            currency={card.displayCurrency ?? displayCurrency}
            onBaselineChange={setBaseline}
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
              priceHistory={priceHistory}
              displayCurrency={displayCurrency}
              locale={locale}
              showLatestPrice={false}
              marketplaceSales={marketplaceSales}
            />
          )}

        </View>
      </ScrollView>
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: themeColors.surface,
            borderTopColor: themeColors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => setCollectionModalVisible(true)}
          style={[
            styles.addToCollectionButton,
            {
              backgroundColor: themeColors.primary,
              borderColor: themeColors.primary,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="folder-plus-outline"
            size={20}
            color={themeColors.onPrimary}
          />
          <Text style={[styles.addToCollectionText, { color: themeColors.onPrimary }]}>
            {t("card.addToCollection")}
          </Text>
        </Pressable>
      </View>
      <AddToCollectionModal
        visible={collectionModalVisible}
        cardId={card.id}
        onClose={() => setCollectionModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  heroImageWrap: {
    flexShrink: 0,
  },
  heroText: {
    flex: 1,
    gap: 6,
    justifyContent: "center",
    minWidth: 0,
  },
  cardImage: {
    borderRadius: 6,
  },
  fallbackCardImage: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
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
    marginHorizontal: 8,
    marginTop: 12,
    padding: 12,
  },
  cardName: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  cardNameRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageFlag: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: 2,
  },
  cardNumber: {
    fontSize: 15,
    fontWeight: "700",
  },
  setName: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  addToCollectionButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addToCollectionText: {
    fontSize: 15,
    fontWeight: "800",
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
