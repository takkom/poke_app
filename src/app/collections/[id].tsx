import { CardListImage } from "@/components/CardListImage";
import { Text } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/context/AuthContext";
import { XMON_API_URL } from "@/config";
import {
  useThemeManager,
  type AppLocale,
  type DisplayCurrency,
} from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCardListDisplayName,
  getDisplayRarity,
} from "@/utils/displayNames";
import {
  AnchoredActionMenu,
  type MenuAnchor,
} from "@/components/AnchoredActionMenu";
import { getReturnColor } from "@/utils/returnDisplay";
import {
  cardLanguageFlag,
  languageFlagAccessibilityLabel,
} from "@/utils/languageFlag";
import {
  formatMoneyInput,
  formatMoneyInputFromNumber,
  parseMoneyInput,
} from "@/utils/moneyInput";
import { qualityBucketLabelKey } from "@/utils/qualityBucket";
import type { QualityBucketCode } from "@/types/card";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? XMON_API_URL;

type AuthState = {
  token?: string | null;
  accessToken?: string | null;
  authToken?: string | null;
};

type Collection = {
  id: string | number;
  name: string;
  total_value?: number | string | null;
  balance_value?: number | string | null;
  holdings_value?: number | string | null;
  return_pct?: number | string | null;
  display_currency?: DisplayCurrency | string | null;
  active_card_count?: number | string | null;
  card_count?: number | string | null;
};

type CollectionItemType = "card" | "box" | "booster_box";

type CollectionCard = {
  id: string | number;
  item_type?: CollectionItemType | string | null;
  canonical_card_id?: string | null;
  tcgdex_card_id?: string | null;
  box_canonical_id?: string | null;
  name?: string | null;
  display_name?: string | null;
  pokemon_name?: string | null;
  card_number?: string | null;
  language?: string | null;
  set_name?: string | null;
  rarity?: string | null;
  image_url?: string | null;
  purchase_price?: number | string | null;
  display_price?: number | string | null;
  display_currency?: DisplayCurrency | string | null;
  display_sold_price?: number | string | null;
  sold_price?: number | string | null;
  quantity?: number | string | null;
  quality_bucket?: QualityBucketCode | string | null;
  sold_at?: string | null;
};

type ItemSheetMode = "purchase" | "sale" | "remove";

function itemQuantity(item: CollectionCard): number {
  const parsed = toNumber(item.quantity ?? 1);
  return parsed >= 1 ? Math.floor(parsed) : 1;
}

function isBoxItem(item: CollectionCard): boolean {
  return item.item_type === "box" || item.item_type === "booster_box";
}

function itemMetaLine(
  item: CollectionCard,
  locale: AppLocale,
  labels: { boosterBox: string },
): string {
  if (isBoxItem(item)) {
    const parts = [labels.boosterBox, item.set_name].filter(Boolean);
    return parts.join(" | ");
  }

  const rarity = getDisplayRarity(item.rarity, locale);
  return `#${item.card_number ?? "-"}${rarity ? ` | ${rarity}` : ""}`;
}

type CollectionDetailResponse = {
  collection: Collection;
  cards: CollectionCard[];
};

function getAuthToken(auth: AuthState): string | null {
  return auth.accessToken ?? auth.authToken ?? auth.token ?? null;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(
  value: number,
  locale: string,
  displayCurrency: DisplayCurrency,
): string {
  return new Intl.NumberFormat(locale, {
    currency: displayCurrency,
    maximumFractionDigits: displayCurrency === "KRW" ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatReturn(value: number | null): string {
  if (value === null) {
    return "0%";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function cardValue(card: CollectionCard): number {
  return toNumber(card.display_price ?? card.purchase_price);
}

function itemDisplayName(
  item: CollectionCard,
  locale: AppLocale,
  labels: { unknownBox: string; unknownCard: string },
): string {
  const localizedName = item.display_name ?? item.name ?? item.pokemon_name;
  if (!localizedName) {
    return isBoxItem(item) ? labels.unknownBox : labels.unknownCard;
  }

  return getCardListDisplayName(
    {
      name: localizedName,
      pokemon_name: item.pokemon_name ?? null,
    },
    locale,
  );
}

function itemDetailRoute(item: CollectionCard): string | null {
  if (isBoxItem(item)) {
    const boxId = item.box_canonical_id?.trim();
    return boxId ? `/box/${boxId}` : null;
  }

  const cardId = item.canonical_card_id?.trim() ?? item.tcgdex_card_id?.trim();
  return cardId ? `/card/${cardId}` : null;
}

async function requestJson<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String(body.message)
        : "Request failed. Please try again.";
    throw new Error(message);
  }

  return body as T;
}

export default function CollectionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const auth = useAuth() as AuthState;
  const token = getAuthToken(auth);
  const { colors, displayCurrency } = useThemeManager();
  const { locale, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [itemFilter, setItemFilter] = useState<"all" | "card" | "box">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuCard, setMenuCard] = useState<CollectionCard | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const menuButtonRefs = useRef<Record<string, View | null>>({});
  const [sheetMode, setSheetMode] = useState<ItemSheetMode | null>(null);
  const [sheetCard, setSheetCard] = useState<CollectionCard | null>(null);
  const [sheetAmount, setSheetAmount] = useState("");
  const [sheetQuantity, setSheetQuantity] = useState(1);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetAmountInputRef = useRef<TextInput>(null);

  const activeCards = useMemo(
    () => cards.filter((card) => !card.sold_at),
    [cards],
  );

  const activeItemCount = useMemo(
    () => activeCards.reduce((sum, card) => sum + itemQuantity(card), 0),
    [activeCards],
  );

  const visibleCards = useMemo(() => {
    if (itemFilter === "all") return activeCards;
    if (itemFilter === "box") return activeCards.filter(isBoxItem);
    return activeCards.filter((c) => !isBoxItem(c));
  }, [activeCards, itemFilter]);

  const balance = useMemo(() => {
    if (collection?.balance_value !== undefined && collection?.balance_value !== null) {
      return toNumber(collection.balance_value);
    }
    const holdingsTotal = activeCards.reduce(
      (sum, card) => sum + cardValue(card) * itemQuantity(card),
      0,
    );
    const sales = cards.reduce(
      (sum, card) =>
        card.sold_at
          ? sum +
            toNumber(card.display_sold_price ?? card.sold_price ?? 0) *
              itemQuantity(card)
          : sum,
      0,
    );
    return holdingsTotal + sales;
  }, [activeCards, cards, collection?.balance_value]);

  const holdings = useMemo(() => {
    if (collection?.holdings_value !== undefined && collection?.holdings_value !== null) {
      return toNumber(collection.holdings_value);
    }
    return activeCards.reduce(
      (sum, card) => sum + cardValue(card) * itemQuantity(card),
      0,
    );
  }, [activeCards, collection?.holdings_value]);

  const returnPct = useMemo(() => {
    if (collection?.return_pct !== undefined && collection?.return_pct !== null) {
      return toNumber(collection.return_pct);
    }
    return null;
  }, [collection?.return_pct]);

  const loadCollection = useCallback(
    async (showRefresh = false) => {
      if (!token || !collectionId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const body = await requestJson<CollectionDetailResponse>(
          `/api/collections/${collectionId}?display_currency=${displayCurrency}&locale=${encodeURIComponent(locale)}`,
          token,
        );
        setCollection(body.collection);
        setCards(body.cards);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : t("collections.couldNotLoadCollection"),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [collectionId, displayCurrency, locale, t, token],
  );

  useFocusEffect(
    useCallback(() => {
      void loadCollection();
    }, [loadCollection]),
  );

  useEffect(() => {
    if (!sheetMode) {
      return undefined;
    }

    const focusAmountInput = () => sheetAmountInputRef.current?.focus();
    const animationFrame = requestAnimationFrame(focusAmountInput);
    const retryTimers = [80, 220, 420].map((delay) =>
      setTimeout(focusAmountInput, delay),
    );

    return () => {
      cancelAnimationFrame(animationFrame);
      retryTimers.forEach(clearTimeout);
    };
  }, [sheetMode, sheetCard]);

  function closeSheet() {
    setSheetMode(null);
    setSheetCard(null);
    setSheetAmount("");
    setSheetQuantity(1);
  }

  function openItemMenu(item: CollectionCard, anchor: MenuAnchor) {
    setMenuCard(item);
    setMenuAnchor(anchor);
  }

  function closeItemMenu() {
    setMenuCard(null);
    setMenuAnchor(null);
  }

  function openSheet(card: CollectionCard, mode: ItemSheetMode) {
    closeItemMenu();
    setSheetCard(card);
    setSheetMode(mode);
    setSheetQuantity(mode === "purchase" ? itemQuantity(card) : 1);
    setSheetAmount(
      mode === "purchase"
        ? formatMoneyInputFromNumber(cardValue(card), locale, displayCurrency)
        : "",
    );
    setError(null);
  }

  function openItemDetail(item: CollectionCard) {
    const route = itemDetailRoute(item);
    if (route) {
      router.push(route);
    }
  }

  async function confirmRemoveItem(card: CollectionCard, quantity: number) {
    if (!token || !collectionId) {
      return;
    }

    setRemoving(true);
    setError(null);

    try {
      await requestJson<{ removed: boolean }>(
        `/api/collections/${collectionId}/cards/${card.id}`,
        token,
        {
          body: JSON.stringify({ quantity }),
          method: "DELETE",
        },
      );
      await loadCollection(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotRemoveCard"),
      );
      throw caught;
    } finally {
      setRemoving(false);
    }
  }

  function confirmRemoveFromCollection(card: CollectionCard) {
    closeItemMenu();
    if (itemQuantity(card) > 1) {
      openSheet(card, "remove");
      return;
    }

    Alert.alert(
      t("collections.removeFromCollectionTitle"),
      t("collections.removeFromCollectionMessage", {
        name: itemDisplayName(card, locale, {
          unknownBox: t("collections.unknownBox"),
          unknownCard: t("collections.unknownCard"),
        }),
      }),
      [
        { style: "cancel", text: t("collections.cancel") },
        {
          onPress: () => {
            void confirmRemoveItem(card, 1).catch(() => undefined);
          },
          style: "destructive",
          text: t("collections.removeFromCollection"),
        },
      ],
    );
  }

  async function saveSheet() {
    if (!token || !collectionId || !sheetCard || !sheetMode) {
      return;
    }

    const maxQuantity = itemQuantity(sheetCard);
    if (sheetQuantity < 1 || sheetQuantity > maxQuantity) {
      setError(t("collections.invalidQuantity", { max: maxQuantity }));
      return;
    }

    if (sheetMode === "remove") {
      setSheetSaving(true);
      setError(null);
      try {
        await confirmRemoveItem(sheetCard, sheetQuantity);
        closeSheet();
      } catch {
        // Error already surfaced via confirmRemoveItem.
      } finally {
        setSheetSaving(false);
      }
      return;
    }

    const amount = parseMoneyInput(sheetAmount);
    if (amount === null) {
      return;
    }

    setSheetSaving(true);
    setError(null);

    try {
      if (sheetMode === "purchase") {
        const updated = await requestJson<CollectionCard>(
          `/api/collections/${collectionId}/cards/${sheetCard.id}`,
          token,
          {
            body: JSON.stringify({
              display_currency: displayCurrency,
              locale,
              purchase_price: amount,
            }),
            method: "PATCH",
          },
        );
        setCards((prev) =>
          prev.map((card) =>
            String(card.id) === String(updated.id)
              ? { ...card, ...updated }
              : card,
          ),
        );
      } else {
        await requestJson<{ removed: boolean; sold: boolean }>(
          `/api/collections/${collectionId}/cards/${sheetCard.id}`,
          token,
          {
            body: JSON.stringify({
              display_currency: displayCurrency,
              locale,
              quantity: sheetQuantity,
              sold_at: new Date().toISOString(),
              sold_price: amount,
            }),
            method: "DELETE",
          },
        );
      }

      closeSheet();
      await loadCollection(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : sheetMode === "purchase"
            ? t("collections.couldNotUpdatePrice")
            : t("collections.couldNotRecordSale"),
      );
    } finally {
      setSheetSaving(false);
    }
  }

  if (!token) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("collections.collection")}
        </Text>
        <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
          {t("collections.signInCollection")}
        </Text>
      </View>
    );
  }

  if (loading && !collection) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
          {t("collections.loadingCollection")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        contentContainerStyle={styles.container}
        data={visibleCards}
        extraData={locale}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <View style={styles.titleNameRow}>
                  <Text
                    numberOfLines={1}
                    style={[styles.title, { color: colors.textPrimary, flexShrink: 1 }]}
                  >
                    {collection?.name ?? t("collections.collection")}
                  </Text>
                  <Text
                    style={[styles.titleItemCount, { color: colors.textSecondary }]}
                  >
                    ({activeItemCount})
                  </Text>
                </View>
                <View style={styles.metricsBlock}>
                  <Text style={[styles.metricLine, { color: colors.textPrimary }]}>
                    {t("collections.balanceLabel")}{" "}
                    {formatMoney(balance, locale, displayCurrency)}
                    <Text style={{ color: getReturnColor(colors, returnPct) }}>
                      {" "}
                      ({formatReturn(returnPct)})
                    </Text>
                  </Text>
                  <Text style={[styles.metricLine, { color: colors.textPrimary }]}>
                    {t("collections.holdingsLabel")}{" "}
                    {formatMoney(holdings, locale, displayCurrency)}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    router.push(`/collections/${collectionId}/history`)
                  }
                  style={[
                    styles.historyButton,
                    {
                      backgroundColor: colors.surfaceAlternate,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="history"
                    color={colors.textPrimary}
                    size={18}
                  />
                  <Text
                    style={[styles.historyButtonText, { color: colors.textPrimary }]}
                  >
                    {t("collections.transactionHistory")}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  const type = itemFilter === "box" ? "box" : "card";
                  router.push(`/collections/${collectionId}/add?type=${type}`);
                }}
                style={[styles.addButton, { backgroundColor: colors.primary }]}
              >
                <MaterialCommunityIcons name="plus" color={colors.onPrimary} size={22} />
              </Pressable>
            </View>
              {activeCards.length > 0 ? (
                <View
                  style={[
                    styles.filterToggle,
                    {
                      backgroundColor: colors.surfaceAlternate,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {(["all", "card", "box"] as const).map((f) => {
                    const active = itemFilter === f;
                    const label =
                      f === "all"
                        ? t("collections.filterAll")
                        : f === "box"
                          ? t("collections.itemTypeBox")
                          : t("collections.itemTypeCard");
                    return (
                      <Pressable
                        key={f}
                        onPress={() => setItemFilter(f)}
                        style={[
                          styles.filterToggleButton,
                          active ? { backgroundColor: colors.primary } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterToggleText,
                            {
                              color: active
                                ? colors.onPrimary
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            {error ? (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {error}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
            {itemFilter === "box"
              ? t("collections.emptyFilterBoxes")
              : itemFilter === "card"
                ? t("collections.emptyFilterCards")
                : t("collections.emptyItems")}
          </Text>
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void loadCollection(true)}
            refreshing={refreshing}
          />
        }
        renderItem={({ item, index }) => {
          const detailRoute = itemDetailRoute(item);
          return (
          <View
            style={[
              styles.cardRow,
              {
                backgroundColor:
                  index % 2 === 1 ? colors.surfaceAlternate : colors.background,
                borderColor: "transparent",
              },
            ]}
          >
            <Pressable
              disabled={!detailRoute}
              onPress={() => openItemDetail(item)}
              style={({ pressed }) => [
                styles.cardRowMain,
                pressed && detailRoute ? styles.cardRowPressed : null,
              ]}
            >
              <CardListImage
                uri={item.image_url}
                recyclingKey={String(item.id)}
                style={
                  isBoxItem(item) ? styles.boxThumbnail : styles.thumbnail
                }
                backgroundColor={colors.surfaceMuted}
                iconColor={colors.textSecondary}
                fallbackIcon={
                  isBoxItem(item) ? "package-variant" : "cards-outline"
                }
              />
              <View style={styles.cardText}>
                <View style={styles.cardNameRow}>
                  {cardLanguageFlag(item.language) ? (
                    <Text
                      accessibilityLabel={languageFlagAccessibilityLabel(
                        item.language,
                      ) ?? undefined}
                      style={styles.languageFlag}
                    >
                      {cardLanguageFlag(item.language)}
                    </Text>
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={[styles.cardName, { color: colors.textPrimary }]}
                  >
                    {itemDisplayName(item, locale, {
                      unknownBox: t("collections.unknownBox"),
                      unknownCard: t("collections.unknownCard"),
                    })}
                  </Text>
                </View>
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                  {itemMetaLine(item, locale, {
                    boosterBox: t("collections.boosterBox"),
                  })}
                </Text>
                {item.set_name && !isBoxItem(item) ? (
                  <Text
                    style={[styles.mutedText, { color: colors.textSecondary }]}
                  >
                    {item.set_name}
                  </Text>
                ) : null}
                <View style={styles.cardMetaRow}>
                  {itemQuantity(item) > 1 ? (
                    <Text
                      style={[styles.quantityBadge, { color: colors.textPrimary }]}
                    >
                      {t("collections.quantityTimes", {
                        count: itemQuantity(item),
                      })}
                    </Text>
                  ) : null}
                  {!isBoxItem(item) && qualityBucketLabelKey(item.quality_bucket) ? (
                    <Text
                      style={[styles.mutedText, { color: colors.textSecondary }]}
                    >
                      {t(qualityBucketLabelKey(item.quality_bucket)!)}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
                  {t("collections.purchasedAt", {
                    value: formatMoney(cardValue(item), locale, displayCurrency),
                  })}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                const node = menuButtonRefs.current[String(item.id)];
                node?.measureInWindow((x, y, width, height) => {
                  openItemMenu(item, { top: y, left: x, width, height });
                });
              }}
              ref={(node) => {
                menuButtonRefs.current[String(item.id)] = node;
              }}
              style={[styles.menuButton, { borderColor: colors.border }]}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                color={colors.textPrimary}
                size={20}
              />
            </Pressable>
          </View>
          );
        }}
      />

      <AnchoredActionMenu
        anchor={menuAnchor}
        estimatedHeight={144}
        onClose={closeItemMenu}
        visible={Boolean(menuCard)}
      >
        <Pressable
          onPress={() => menuCard && openSheet(menuCard, "purchase")}
          style={styles.menuItem}
        >
          <MaterialCommunityIcons
            name="receipt-text-outline"
            color={colors.textPrimary}
            size={20}
          />
          <Text style={[styles.menuText, { color: colors.textPrimary }]}>
            {t("collections.editPurchasePrice")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => menuCard && openSheet(menuCard, "sale")}
          style={styles.menuItem}
        >
          <MaterialCommunityIcons
            name="cash-check"
            color={colors.textPrimary}
            size={20}
          />
          <Text style={[styles.menuText, { color: colors.textPrimary }]}>
            {t("collections.recordSale")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => menuCard && confirmRemoveFromCollection(menuCard)}
          style={styles.menuItem}
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            color={colors.error}
            size={20}
          />
          <Text style={[styles.menuText, { color: colors.error }]}>
            {t("collections.removeFromCollection")}
          </Text>
        </Pressable>
      </AnchoredActionMenu>

      <Modal
        animationType="slide"
        onRequestClose={closeSheet}
        transparent
        visible={Boolean(sheetMode && sheetCard)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={styles.sheetHost}
        >
          <Pressable
            style={[styles.sheetBackdrop, { backgroundColor: colors.overlayStrong }]}
            onPress={closeSheet}
          />
          <View
            style={[
              styles.sheetPanel,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.border }]}
            />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {sheetMode === "sale"
                ? t("collections.recordSale")
                : sheetMode === "remove"
                  ? t("collections.removeFromCollection")
                  : t("collections.editPurchasePrice")}
            </Text>
            <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
              {sheetCard
                ? itemDisplayName(sheetCard, locale, {
                    unknownBox: t("collections.unknownBox"),
                    unknownCard: t("collections.unknownCard"),
                  })
                : null}
            </Text>
            {sheetMode === "sale" ? (
              <Text style={[styles.sheetHelp, { color: colors.textSecondary }]}>
                {sheetCard && itemQuantity(sheetCard) > 1
                  ? t("collections.recordSaleHelpQuantity")
                  : t("collections.recordSaleHelp")}
              </Text>
            ) : null}
            {sheetMode === "remove" ? (
              <Text style={[styles.sheetHelp, { color: colors.textSecondary }]}>
                {t("collections.removeQuantityHelp")}
              </Text>
            ) : null}
            {sheetMode === "sale" || sheetMode === "remove" ? (
              sheetCard && itemQuantity(sheetCard) > 1 ? (
              <>
                <Text
                  style={[styles.sheetFieldLabel, { color: colors.textSecondary }]}
                >
                  {t("collections.quantity")}
                  {` (1–${itemQuantity(sheetCard)})`}
                </Text>
                <View style={styles.quantityRow}>
                  <Pressable
                    disabled={sheetQuantity <= 1}
                    onPress={() =>
                      setSheetQuantity((current) => Math.max(1, current - 1))
                    }
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity: sheetQuantity <= 1 ? 0.5 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="minus"
                      color={colors.textPrimary}
                      size={18}
                    />
                  </Pressable>
                  <Text
                    style={[styles.quantityValue, { color: colors.textPrimary }]}
                  >
                    {sheetQuantity}
                  </Text>
                  <Pressable
                    disabled={sheetQuantity >= itemQuantity(sheetCard)}
                    onPress={() =>
                      setSheetQuantity((current) =>
                        Math.min(itemQuantity(sheetCard), current + 1),
                      )
                    }
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity:
                          sheetQuantity >= itemQuantity(sheetCard) ? 0.5 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      color={colors.textPrimary}
                      size={18}
                    />
                  </Pressable>
                </View>
              </>
              ) : null
            ) : null}
            {sheetMode !== "remove" ? (
              <>
                <Text
                  style={[styles.sheetFieldLabel, { color: colors.textSecondary }]}
                >
                  {sheetMode === "sale"
                    ? t("collections.salePrice")
                    : t("collections.purchasePrice")}
                </Text>
                <TextInput
                  autoFocus
                  ref={sheetAmountInputRef}
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setSheetAmount(formatMoneyInput(value, locale, displayCurrency))
                  }
                  placeholder={
                    sheetMode === "sale"
                      ? t("collections.salePrice")
                      : t("collections.purchasePrice")
                  }
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                  showSoftInputOnFocus
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={sheetAmount}
                />
              </>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable
                disabled={sheetSaving || removing}
                onPress={closeSheet}
                style={[
                  styles.sheetSecondaryButton,
                  { borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.sheetSecondaryButtonText,
                    { color: colors.textPrimary },
                  ]}
                >
                  {t("collections.cancel")}
                </Text>
              </Pressable>
              <Pressable
                disabled={
                  sheetSaving ||
                  removing ||
                  (sheetMode !== "remove" &&
                    parseMoneyInput(sheetAmount) === null)
                }
                onPress={() => void saveSheet()}
                style={[
                  styles.sheetPrimaryButton,
                  {
                    backgroundColor:
                      sheetMode === "remove" ? colors.error : colors.primary,
                  },
                  sheetSaving ||
                  removing ||
                  (sheetMode !== "remove" &&
                    parseMoneyInput(sheetAmount) === null)
                    ? styles.sheetButtonDisabled
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.sheetPrimaryButtonText,
                    { color: colors.onPrimary },
                  ]}
                >
                  {sheetSaving || removing
                    ? t("collections.saving")
                    : sheetMode === "sale"
                      ? t("collections.confirmSale")
                      : sheetMode === "remove"
                        ? t("collections.removeFromCollection")
                        : t("collections.save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    minWidth: 0,
  },
  cardNameRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 4,
  },
  cardMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageFlag: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  cardRow: {
    alignItems: "center",
    borderRadius: 0,
    borderWidth: 0,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  cardRowMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
    minWidth: 0,
  },
  cardRowPressed: {
    opacity: 0.72,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  quantityBadge: {
    fontSize: 13,
    fontWeight: "800",
  },
  quantityButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  quantityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "center",
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 20,
  },
  container: {
    gap: 10,
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "700",
  },
  filterToggle: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 4,
  },
  filterToggleButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: "700",
  },
  header: {
    gap: 12,
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuContent: {
    borderRadius: 8,
    minWidth: 180,
    paddingVertical: 6,
  },
  menuItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  menuOverlay: {
    alignItems: "flex-end",
    flex: 1,
    justifyContent: "flex-end",
  },
  menuText: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetButtonDisabled: {
    opacity: 0.5,
  },
  sheetFieldLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  sheetHandle: {
    alignSelf: "center",
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 40,
  },
  sheetHelp: {
    fontSize: 13,
    lineHeight: 18,
  },
  sheetHost: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetPanel: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetPrimaryButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14,
  },
  sheetPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  sheetSecondaryButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
  },
  sheetSecondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  mutedText: {
    fontSize: 13,
  },
  screen: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  boxThumbnail: {
    borderRadius: 6,
    height: 76,
    resizeMode: "cover",
    width: 76,
  },
  boxThumbnailFallback: {
    alignItems: "center",
    borderRadius: 6,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  thumbnail: {
    borderRadius: 6,
    height: 76,
    resizeMode: "cover",
    width: 54,
  },
  thumbnailFallback: {
    alignItems: "center",
    borderRadius: 6,
    height: 76,
    justifyContent: "center",
    width: 54,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  titleNameRow: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  titleItemCount: {
    fontSize: 16,
    fontWeight: "600",
  },
  metricsBlock: {
    gap: 2,
    marginTop: 4,
  },
  metricLine: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  titleText: {
    flex: 1,
  },
  historyButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
