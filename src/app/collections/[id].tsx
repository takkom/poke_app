import { useAuth } from "@/context/AuthContext";
import { useThemeManager, type DisplayCurrency } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { XMON_API_URL } from "@/config";
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
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";

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
  pokemon_name?: string | null;
  card_number?: string | null;
  language?: string | null;
  set_name?: string | null;
  rarity?: string | null;
  image_url?: string | null;
  purchase_price?: number | string | null;
  display_price?: number | string | null;
  display_currency?: DisplayCurrency | string | null;
  sold_at?: string | null;
};

type ItemSheetMode = "purchase" | "sale";

function isBoxItem(item: CollectionCard): boolean {
  return item.item_type === "box" || item.item_type === "booster_box";
}

function itemMetaLine(
  item: CollectionCard,
  labels: { boosterBox: string; unknown: string },
): string {
  if (isBoxItem(item)) {
    const parts = [labels.boosterBox, item.set_name, item.language].filter(
      Boolean,
    );
    return parts.join(" | ");
  }

  return `#${item.card_number ?? "-"} | ${item.language ?? labels.unknown}${
    item.rarity ? ` | ${item.rarity}` : ""
  }`;
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
  labels: { unknownBox: string; unknownCard: string },
): string {
  return (
    item.pokemon_name ??
    (isBoxItem(item) ? labels.unknownBox : labels.unknownCard)
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
  const [collection, setCollection] = useState<Collection | null>(null);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [itemFilter, setItemFilter] = useState<"all" | "card" | "box">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuCard, setMenuCard] = useState<CollectionCard | null>(null);
  const [sheetMode, setSheetMode] = useState<ItemSheetMode | null>(null);
  const [sheetCard, setSheetCard] = useState<CollectionCard | null>(null);
  const [sheetAmount, setSheetAmount] = useState("");
  const [sheetSaving, setSheetSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetAmountInputRef = useRef<TextInput>(null);

  const activeCards = useMemo(
    () => cards.filter((card) => !card.sold_at),
    [cards],
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
    const holdings = activeCards.reduce((sum, card) => sum + cardValue(card), 0);
    const sales = cards.reduce(
      (sum, card) =>
        card.sold_at
          ? sum + toNumber((card as { display_sold_price?: number }).display_sold_price ?? card.purchase_price)
          : sum,
      0,
    );
    return holdings + sales;
  }, [activeCards, cards, collection?.balance_value]);

  const holdings = useMemo(() => {
    if (collection?.holdings_value !== undefined && collection?.holdings_value !== null) {
      return toNumber(collection.holdings_value);
    }
    return activeCards.reduce((sum, card) => sum + cardValue(card), 0);
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
          `/api/collections/${collectionId}?display_currency=${displayCurrency}`,
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
    [collectionId, displayCurrency, t, token],
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
  }

  function openSheet(card: CollectionCard, mode: ItemSheetMode) {
    setMenuCard(null);
    setSheetCard(card);
    setSheetMode(mode);
    setSheetAmount(
      mode === "purchase" ? String(cardValue(card) || "") : "",
    );
    setError(null);
  }

  function openItemDetail(item: CollectionCard) {
    const route = itemDetailRoute(item);
    if (route) {
      router.push(route);
    }
  }

  async function confirmRemoveItem(card: CollectionCard) {
    if (!token || !collectionId) {
      return;
    }

    setRemoving(true);
    setError(null);

    try {
      await requestJson<{ removed: boolean }>(
        `/api/collections/${collectionId}/cards/${card.id}`,
        token,
        { method: "DELETE" },
      );
      await loadCollection();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotRemoveCard"),
      );
    } finally {
      setRemoving(false);
    }
  }

  function confirmRemoveFromCollection(card: CollectionCard) {
    setMenuCard(null);
    Alert.alert(
      t("collections.removeFromCollectionTitle"),
      t("collections.removeFromCollectionMessage", {
        name: itemDisplayName(card, {
          unknownBox: t("collections.unknownBox"),
          unknownCard: t("collections.unknownCard"),
        }),
      }),
      [
        { style: "cancel", text: t("collections.cancel") },
        {
          onPress: () => void confirmRemoveItem(card),
          style: "destructive",
          text: t("collections.removeFromCollection"),
        },
      ],
    );
  }

  async function saveSheet() {
    if (!token || !collectionId || !sheetCard || !sheetMode || !sheetAmount.trim()) {
      return;
    }

    setSheetSaving(true);
    setError(null);

    try {
      if (sheetMode === "purchase") {
        await requestJson<CollectionCard>(
          `/api/collections/${collectionId}/cards/${sheetCard.id}`,
          token,
          {
            body: JSON.stringify({
              display_currency: displayCurrency,
              purchase_price: Number(sheetAmount),
            }),
            method: "PATCH",
          },
        );
      } else {
        await requestJson<{ removed: boolean; sold: boolean }>(
          `/api/collections/${collectionId}/cards/${sheetCard.id}`,
          token,
          {
            body: JSON.stringify({
              display_currency: displayCurrency,
              sold_at: new Date().toISOString(),
              sold_price: Number(sheetAmount),
            }),
            method: "DELETE",
          },
        );
      }

      closeSheet();
      await loadCollection();
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

  if (loading) {
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
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  {collection?.name ?? t("collections.collection")}
                </Text>
                <Text style={[styles.total, { color: colors.textSecondary }]}>
                  {t("collections.itemValueSummary", {
                    items: activeCards.length,
                    balance: formatMoney(balance, locale, displayCurrency),
                    holdings: formatMoney(holdings, locale, displayCurrency),
                    return: formatReturn(returnPct),
                  })}
                </Text>
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
                onPress={() => router.push(`/collections/${collectionId}/add`)}
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
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={
                    isBoxItem(item) ? styles.boxThumbnail : styles.thumbnail
                  }
                />
              ) : (
                <View
                  style={[
                    isBoxItem(item)
                      ? styles.boxThumbnailFallback
                      : styles.thumbnailFallback,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      isBoxItem(item) ? "package-variant" : "cards-outline"
                    }
                    color={colors.textSecondary}
                    size={24}
                  />
                </View>
              )}
              <View style={styles.cardText}>
                <Text style={[styles.cardName, { color: colors.textPrimary }]}>
                  {itemDisplayName(item, {
                    unknownBox: t("collections.unknownBox"),
                    unknownCard: t("collections.unknownCard"),
                  })}
                </Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                  {itemMetaLine(item, {
                    boosterBox: t("collections.boosterBox"),
                    unknown: t("collections.unknown"),
                  })}
                </Text>
                {item.set_name && !isBoxItem(item) ? (
                  <Text
                    style={[styles.mutedText, { color: colors.textSecondary }]}
                  >
                    {item.set_name}
                  </Text>
                ) : null}
                <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
                  {t("collections.purchasedAt", {
                    value: formatMoney(cardValue(item), locale, displayCurrency),
                  })}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setMenuCard(item)}
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

      <Modal
        animationType="fade"
        onRequestClose={() => setMenuCard(null)}
        transparent
        visible={Boolean(menuCard)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuCard(null)}>
          <View
            style={[styles.menuContent, { backgroundColor: colors.surface }]}
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
          </View>
        </Pressable>
      </Modal>

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
          <Pressable style={styles.sheetBackdrop} onPress={closeSheet} />
          <View
            style={[
              styles.sheetPanel,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.border }]}
            />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {sheetMode === "sale"
                ? t("collections.recordSale")
                : t("collections.editPurchasePrice")}
            </Text>
            <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
              {sheetCard
                ? itemDisplayName(sheetCard, {
                    unknownBox: t("collections.unknownBox"),
                    unknownCard: t("collections.unknownCard"),
                  })
                : null}
            </Text>
            {sheetMode === "sale" ? (
              <Text style={[styles.sheetHelp, { color: colors.textSecondary }]}>
                {t("collections.recordSaleHelp")}
              </Text>
            ) : null}
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
              onChangeText={setSheetAmount}
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
            <View style={styles.sheetActions}>
              <Pressable
                disabled={sheetSaving}
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
                disabled={sheetSaving || !sheetAmount.trim()}
                onPress={() => void saveSheet()}
                style={[
                  styles.sheetPrimaryButton,
                  {
                    backgroundColor:
                      sheetMode === "sale" ? colors.primary : colors.primary,
                  },
                  sheetSaving || !sheetAmount.trim()
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
                  {sheetSaving
                    ? t("collections.saving")
                    : sheetMode === "sale"
                      ? t("collections.confirmSale")
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
    fontSize: 16,
    fontWeight: "800",
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
    backgroundColor: "rgba(15, 23, 42, 0.24)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
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
    backgroundColor: "rgba(15, 23, 42, 0.32)",
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
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
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
  total: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
});
