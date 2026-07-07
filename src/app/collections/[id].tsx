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
  Button,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

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
  display_currency?: DisplayCurrency | string | null;
  active_card_count?: number | string | null;
  card_count?: number | string | null;
};

type CollectionCard = {
  id: string | number;
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

function cardValue(card: CollectionCard): number {
  return toNumber(card.display_price ?? card.purchase_price);
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuCard, setMenuCard] = useState<CollectionCard | null>(null);
  const [editingPriceCard, setEditingPriceCard] =
    useState<CollectionCard | null>(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removingCard, setRemovingCard] = useState<CollectionCard | null>(null);
  const [soldPrice, setSoldPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editedPriceInputRef = useRef<TextInput>(null);
  const soldPriceInputRef = useRef<TextInput>(null);

  const total = useMemo(
    () =>
      collection?.total_value !== undefined && collection?.total_value !== null
        ? toNumber(collection.total_value)
        : cards.reduce(
            (sum, card) => (card.sold_at ? sum : sum + cardValue(card)),
            0,
          ),
    [cards, collection?.total_value],
  );

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
    if (!editingPriceCard) {
      return undefined;
    }

    const focusPriceInput = () => editedPriceInputRef.current?.focus();
    const animationFrame = requestAnimationFrame(focusPriceInput);
    const retryTimers = [80, 220, 420].map((delay) =>
      setTimeout(focusPriceInput, delay),
    );

    return () => {
      cancelAnimationFrame(animationFrame);
      retryTimers.forEach(clearTimeout);
    };
  }, [editingPriceCard]);

  useEffect(() => {
    if (!removingCard) {
      return undefined;
    }

    const focusSoldPriceInput = () => soldPriceInputRef.current?.focus();
    const animationFrame = requestAnimationFrame(focusSoldPriceInput);
    const retryTimers = [80, 220, 420].map((delay) =>
      setTimeout(focusSoldPriceInput, delay),
    );

    return () => {
      cancelAnimationFrame(animationFrame);
      retryTimers.forEach(clearTimeout);
    };
  }, [removingCard]);

  async function confirmRemoveCard() {
    if (!token || !collectionId || !removingCard) {
      return;
    }

    setRemoving(true);
    setError(null);

    try {
      const body = soldPrice.trim()
        ? {
            display_currency: displayCurrency,
            sold_at: new Date().toISOString(),
            sold_price: Number(soldPrice),
          }
        : {};

      await requestJson<{ removed: boolean }>(
        `/api/collections/${collectionId}/cards/${removingCard.id}`,
        token,
        {
          body: JSON.stringify(body),
          method: "DELETE",
        },
      );
      setRemovingCard(null);
      setSoldPrice("");
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

  function openEditPrice(card: CollectionCard) {
    setMenuCard(null);
    setEditingPriceCard(card);
    setEditedPrice(String(cardValue(card) || ""));
    setError(null);
  }

  function openRemoveCard(card: CollectionCard) {
    setMenuCard(null);
    setRemovingCard(card);
    setSoldPrice("");
  }

  async function saveEditedPrice() {
    if (!token || !collectionId || !editingPriceCard || !editedPrice.trim()) {
      return;
    }

    setUpdatingPrice(true);
    setError(null);

    try {
      await requestJson<CollectionCard>(
        `/api/collections/${collectionId}/cards/${editingPriceCard.id}`,
        token,
        {
          body: JSON.stringify({
            display_currency: displayCurrency,
            purchase_price: Number(editedPrice),
          }),
          method: "PATCH",
        },
      );
      setEditingPriceCard(null);
      setEditedPrice("");
      await loadCollection();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotUpdatePrice"),
      );
    } finally {
      setUpdatingPrice(false);
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
        data={cards}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <Text style={[styles.title, { color: colors.primary }]}>
                  {collection?.name ?? t("collections.collection")}
                </Text>
                <Text style={[styles.total, { color: colors.textSecondary }]}>
                  {t("collections.cardValueSummary", {
                    cards: cards.length,
                    value: formatMoney(total, locale, displayCurrency),
                  })}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/collections/${collectionId}/add`)}
                style={[styles.addButton, { backgroundColor: colors.primary }]}
              >
                <MaterialCommunityIcons name="plus" color={colors.onPrimary} size={22} />
              </Pressable>
            </View>
            {error ? (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {error}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
            {t("collections.emptyCards")}
          </Text>
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void loadCollection(true)}
            refreshing={refreshing}
          />
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.cardRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.thumbnail}
              />
            ) : (
              <View
                style={[
                  styles.thumbnailFallback,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <MaterialCommunityIcons
                  name="cards-outline"
                  color={colors.textSecondary}
                  size={24}
                />
              </View>
            )}
            <View style={styles.cardText}>
              <Text style={[styles.cardName, { color: colors.primary }]}>
                {item.pokemon_name ?? t("collections.unknownCard")}
              </Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                #{item.card_number ?? "-"} |{" "}
                {item.language ?? t("collections.unknown")}
                {item.rarity ? ` | ${item.rarity}` : ""}
              </Text>
              {item.set_name ? (
                <Text
                  style={[styles.mutedText, { color: colors.textSecondary }]}
                >
                  {item.set_name}
                </Text>
              ) : null}
              <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
                {formatMoney(cardValue(item), locale, displayCurrency)}
              </Text>
            </View>
            <Pressable
              onPress={() => setMenuCard(item)}
              style={[styles.removeButton, { borderColor: colors.border }]}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                color={colors.textPrimary}
                size={20}
              />
            </Pressable>
          </View>
        )}
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
              onPress={() => menuCard && openEditPrice(menuCard)}
              style={styles.menuItem}
            >
              <MaterialCommunityIcons
                name="currency-krw"
                color={colors.textPrimary}
                size={20}
              />
              <Text style={[styles.menuText, { color: colors.textPrimary }]}>
                {t("collections.editPrice")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => menuCard && openRemoveCard(menuCard)}
              style={styles.menuItem}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                color={colors.error}
                size={20}
              />
              <Text style={[styles.menuText, { color: colors.error }]}>
                {t("collections.remove")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setEditingPriceCard(null)}
        transparent
        visible={Boolean(editingPriceCard)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={24}
          style={styles.modalKeyboardView}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
              <Text
                style={[styles.sectionTitle, { color: colors.primary }]}
              >
                {t("collections.editPrice")}
              </Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {editingPriceCard?.pokemon_name ??
                  t("collections.collectionCard")}
              </Text>
              <TextInput
                autoFocus
                ref={editedPriceInputRef}
                keyboardType="decimal-pad"
                onChangeText={setEditedPrice}
                placeholder={t("collections.price")}
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
                value={editedPrice}
              />
              <View style={styles.modalActions}>
                <Button
                  disabled={updatingPrice}
                  onPress={() => setEditingPriceCard(null)}
                  title={t("collections.cancel")}
                />
                <Button
                  color={colors.primary}
                  disabled={updatingPrice || !editedPrice.trim()}
                  onPress={() => void saveEditedPrice()}
                  title={
                    updatingPrice
                      ? t("collections.saving")
                      : t("collections.save")
                  }
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setRemovingCard(null)}
        transparent
        visible={Boolean(removingCard)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={24}
          style={styles.modalKeyboardView}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
              <Text
                style={[styles.sectionTitle, { color: colors.primary }]}
              >
                {t("collections.removeCard")}
              </Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {t("collections.removeCardHelp")}
              </Text>
              <TextInput
                autoFocus
                ref={soldPriceInputRef}
                keyboardType="decimal-pad"
                onChangeText={setSoldPrice}
                placeholder={t("collections.soldPricePlaceholder")}
                placeholderTextColor={colors.textMuted}
                showSoftInputOnFocus
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={soldPrice}
              />
              <View style={styles.modalActions}>
                <Button
                  disabled={removing}
                  onPress={() => setRemovingCard(null)}
                  title={t("collections.cancel")}
                />
                <Button
                  color={colors.error}
                  disabled={removing}
                  onPress={() => void confirmRemoveCard()}
                  title={
                    removing ? t("collections.remove") : t("collections.remove")
                  }
                />
              </View>
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
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 10,
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
  modalActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderRadius: 8,
    gap: 12,
    maxWidth: 420,
    padding: 20,
    width: "100%",
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  mutedText: {
    fontSize: 13,
  },
  removeButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  screen: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
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
  total: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
});
