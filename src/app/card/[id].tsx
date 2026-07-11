import { AddToCollectionModal } from "@/components/AddToCollectionModal";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { useThemeManager } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { getCardById, getPriceHistory } from "@/services/cardService";
import {
  CardWithPricing,
  PriceHistoryPoint,
  QualityBucketCode,
} from "@/types/card";
import { getDisplayCardName } from "@/utils/displayNames";
import { resolveCardDisplayNumber } from "@/utils/cardNumber";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { colors: themeColors, displayCurrency, locale } = useThemeManager();
  const { t } = useI18n();
  const [card, setCard] = useState<CardWithPricing | null>(null);
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
  const languageFlag = card ? cardLanguageFlag(card.language) : null;
  const hasValidImage = Boolean(
    imageUrl && !imageUrl.includes("placeholder.png"),
  );
  const cardImageSize = useMemo(() => {
    const maxWidth = screenWidth * 0.94;
    const maxHeight = screenHeight * 0.62;
    let width = maxWidth;
    let height = width / CARD_ASPECT_RATIO;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * CARD_ASPECT_RATIO;
    }

    return { width, height };
  }, [screenWidth, screenHeight]);

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
            <Image
              source={{ uri: imageUrl }}
              style={[styles.cardImage, cardImageSize]}
            />
          ) : (
            <View
              style={[
                styles.fallbackCardImage,
                cardImageSize,
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
          <View style={styles.titleBlock}>
            <View style={styles.cardNameRow}>
              <Text style={[styles.cardName, { color: themeColors.primary }]}>{displayName}</Text>
              {languageFlag ? (
                <Text
                  style={styles.languageFlag}
                  accessibilityLabel={card.language === "ja" ? "Japanese" : "English"}
                >
                  {languageFlag}
                </Text>
              ) : null}
            </View>
            {displayNumber ? (
              <Text style={[styles.cardNumber, { color: themeColors.textSecondary }]}>
                #{displayNumber}
              </Text>
            ) : null}
          </View>
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
  imageContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cardImage: {
    resizeMode: "contain",
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
    marginHorizontal: 12,
    marginTop: 16,
    padding: 16,
  },
  cardName: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  titleBlock: {
    alignItems: "center",
    gap: 4,
  },
  cardNameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  languageFlag: {
    fontSize: 24,
    lineHeight: 30,
  },
  cardNumber: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
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
