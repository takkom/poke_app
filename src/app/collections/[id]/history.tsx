import { useAuth } from "@/context/AuthContext";
import { useThemeManager, type DisplayCurrency } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { XMON_API_URL } from "@/config";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
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
const PAGE_SIZE = 30;

type AuthState = {
  token?: string | null;
  accessToken?: string | null;
  authToken?: string | null;
};

type TransactionType = "purchase" | "sale";

type CollectionTransaction = {
  id: string;
  card_id: string;
  transaction_type: TransactionType;
  item_type?: string | null;
  item_name?: string | null;
  card_number?: string | null;
  language?: string | null;
  set_name?: string | null;
  rarity?: string | null;
  occurred_at: string;
  price?: number | string | null;
  display_price?: number | string | null;
  display_currency?: DisplayCurrency | string | null;
};

type TransactionsResponse = {
  transactions: CollectionTransaction[];
  page: number;
  limit: number;
  total_count: number;
  has_more: boolean;
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

function formatDate(value: string, locale: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function transactionItemName(
  transaction: CollectionTransaction,
  unknownLabel: string,
): string {
  const name = transaction.item_name ?? unknownLabel;
  if (transaction.item_type === "box") {
    return `${name} | ${transaction.language ?? unknownLabel}`;
  }

  const parts = [
    name,
    transaction.card_number ? `#${transaction.card_number}` : null,
    transaction.language ?? unknownLabel,
    transaction.rarity ?? null,
  ].filter(Boolean);

  return parts.join(" | ");
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

export default function CollectionHistoryScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const auth = useAuth() as AuthState;
  const token = getAuthToken(auth);
  const { colors, displayCurrency } = useThemeManager();
  const { locale, t } = useI18n();
  const [transactions, setTransactions] = useState<CollectionTransaction[]>([]);
  const [filter, setFilter] = useState<"all" | "purchase" | "sale">("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuTransaction, setMenuTransaction] =
    useState<CollectionTransaction | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<CollectionTransaction | null>(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [editedDate, setEditedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editedPriceInputRef = useRef<TextInput>(null);

  const filterQuery = filter === "all" ? "all" : filter;

  const loadTransactions = useCallback(
    async ({
      nextPage = 1,
      append = false,
      showRefresh = false,
    }: {
      nextPage?: number;
      append?: boolean;
      showRefresh?: boolean;
    } = {}) => {
      if (!token || !collectionId) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const body = await requestJson<TransactionsResponse>(
          `/api/collections/${collectionId}/transactions?display_currency=${displayCurrency}&type=${filterQuery}&page=${nextPage}&limit=${PAGE_SIZE}`,
          token,
        );
        setTransactions((current) =>
          append ? [...current, ...body.transactions] : body.transactions,
        );
        setPage(body.page);
        setHasMore(body.has_more);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : t("collections.couldNotLoadTransactions"),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [collectionId, displayCurrency, filterQuery, t, token],
  );

  const filterRef = useRef(filter);

  useEffect(() => {
    if (filterRef.current === filter) {
      return;
    }
    filterRef.current = filter;
    void loadTransactions();
  }, [filter, loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      void loadTransactions();
    }, [loadTransactions]),
  );

  const transactionPrice = useCallback((transaction: CollectionTransaction) => {
    return toNumber(transaction.display_price ?? transaction.price);
  }, []);

  const emptyLabel = useMemo(() => {
    if (filter === "purchase") {
      return t("collections.filterPurchases");
    }
    if (filter === "sale") {
      return t("collections.filterSales");
    }
    return t("collections.transactionHistory");
  }, [filter, t]);

  function openEditTransaction(transaction: CollectionTransaction) {
    setMenuTransaction(null);
    setEditingTransaction(transaction);
    setEditedPrice(String(transactionPrice(transaction) || ""));
    setEditedDate(transaction.occurred_at.slice(0, 16));
    setError(null);
  }

  function confirmDeleteTransaction(transaction: CollectionTransaction) {
    setMenuTransaction(null);
    const typeLabel =
      transaction.transaction_type === "sale"
        ? t("collections.transactionSale")
        : t("collections.transactionPurchase");

    Alert.alert(
      t("collections.deleteTransactionTitle"),
      t("collections.deleteTransactionMessage", {
        name: transaction.item_name ?? t("collections.unknown"),
        type: typeLabel.toLowerCase(),
      }),
      [
        { style: "cancel", text: t("collections.cancel") },
        {
          onPress: () => void deleteTransaction(transaction),
          style: "destructive",
          text: t("collections.delete"),
        },
      ],
    );
  }

  async function deleteTransaction(transaction: CollectionTransaction) {
    if (!token || !collectionId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await requestJson(
        `/api/collections/${collectionId}/transactions/${transaction.id}`,
        token,
        { method: "DELETE" },
      );
      await loadTransactions();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotDeleteTransaction"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedTransaction() {
    if (!token || !collectionId || !editingTransaction || !editedPrice.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const occurredAt = editedDate.trim()
        ? new Date(editedDate).toISOString()
        : editingTransaction.occurred_at;

      await requestJson(
        `/api/collections/${collectionId}/transactions/${editingTransaction.id}`,
        token,
        {
          body: JSON.stringify({
            display_currency: displayCurrency,
            occurred_at: occurredAt,
            price: Number(editedPrice),
          }),
          method: "PATCH",
        },
      );
      setEditingTransaction(null);
      setEditedPrice("");
      setEditedDate("");
      await loadTransactions();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotUpdateTransaction"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("collections.transactionHistory")}
        </Text>
        <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
          {t("collections.signInCollection")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        contentContainerStyle={styles.container}
        data={transactions}
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          if (!loadingMore && hasMore) {
            void loadTransactions({ append: true, nextPage: page + 1 });
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <View
              style={[
                styles.filterToggle,
                {
                  backgroundColor: colors.surfaceAlternate,
                  borderColor: colors.border,
                },
              ]}
            >
              {(["all", "purchase", "sale"] as const).map((value) => {
                const active = filter === value;
                const label =
                  value === "all"
                    ? t("collections.filterAll")
                    : value === "purchase"
                      ? t("collections.filterPurchases")
                      : t("collections.filterSales");
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setFilter(value);
                      setPage(1);
                    }}
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
            {error ? (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {error}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {t("collections.loadingTransactions")}
              </Text>
            </View>
          ) : (
            <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
              {t("collections.emptyTransactions")} ({emptyLabel})
            </Text>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void loadTransactions({ showRefresh: true })}
            refreshing={refreshing}
          />
        }
        renderItem={({ item, index }) => {
          const isSale = item.transaction_type === "sale";
          return (
            <View
              style={[
                styles.row,
                {
                  backgroundColor:
                    index % 2 === 1 ? colors.surfaceAlternate : colors.background,
                },
              ]}
            >
              <View style={styles.rowText}>
                <View style={styles.rowTopLine}>
                  <Text
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: isSale
                          ? colors.surfaceMuted
                          : colors.primary,
                        color: isSale ? colors.textPrimary : colors.onPrimary,
                      },
                    ]}
                  >
                    {isSale
                      ? t("collections.transactionSale")
                      : t("collections.transactionPurchase")}
                  </Text>
                  <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                    {formatDate(item.occurred_at, locale)}
                  </Text>
                </View>
                <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                  {transactionItemName(item, t("collections.unknown"))}
                </Text>
                <Text
                  style={[
                    styles.priceText,
                    {
                      color: isSale
                        ? colors.textPrimary
                        : colors.textPrimary,
                    },
                  ]}
                >
                  {formatMoney(
                    transactionPrice(item),
                    locale,
                    displayCurrency,
                  )}
                </Text>
              </View>
              <Pressable
                onPress={() => setMenuTransaction(item)}
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
        onRequestClose={() => setMenuTransaction(null)}
        transparent
        visible={Boolean(menuTransaction)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuTransaction(null)}
        >
          <View
            style={[styles.menuContent, { backgroundColor: colors.surface }]}
          >
            <Pressable
              onPress={() =>
                menuTransaction && openEditTransaction(menuTransaction)
              }
              style={styles.menuItem}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                color={colors.textPrimary}
                size={20}
              />
              <Text style={[styles.menuText, { color: colors.textPrimary }]}>
                {t("collections.editTransaction")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                menuTransaction && confirmDeleteTransaction(menuTransaction)
              }
              style={styles.menuItem}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                color={colors.error}
                size={20}
              />
              <Text style={[styles.menuText, { color: colors.error }]}>
                {t("collections.delete")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setEditingTransaction(null)}
        transparent
        visible={Boolean(editingTransaction)}
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
                style={[styles.sectionTitle, { color: colors.textPrimary }]}
              >
                {t("collections.editTransaction")}
              </Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {editingTransaction
                  ? transactionItemName(
                      editingTransaction,
                      t("collections.unknown"),
                    )
                  : null}
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
              <TextInput
                onChangeText={setEditedDate}
                placeholder={t("collections.transactionDate")}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={editedDate}
              />
              <View style={styles.modalActions}>
                <Button
                  disabled={saving}
                  onPress={() => setEditingTransaction(null)}
                  title={t("collections.cancel")}
                />
                <Button
                  color={colors.primary}
                  disabled={saving || !editedPrice.trim()}
                  onPress={() => void saveEditedTransaction()}
                  title={
                    saving ? t("collections.saving") : t("collections.save")
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
  dateText: {
    fontSize: 12,
    fontWeight: "600",
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
  itemName: {
    fontSize: 15,
    fontWeight: "700",
  },
  loadingRow: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  menuButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
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
  priceText: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 10,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  screen: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  typeBadge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
