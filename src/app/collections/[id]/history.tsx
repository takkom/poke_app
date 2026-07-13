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
import {
  AnchoredActionMenu,
  type MenuAnchor,
} from "@/components/AnchoredActionMenu";
import {
  formatMoneyInput,
  formatMoneyInputFromNumber,
  parseMoneyInput,
} from "@/utils/moneyInput";
import {
  cardLanguageFlag,
  languageFlagAccessibilityLabel,
} from "@/utils/languageFlag";
import { getReturnColor } from "@/utils/returnDisplay";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function formatDate(value: string | Date, locale: string): string {
  const parsed =
    value instanceof Date ? value.getTime() : Date.parse(String(value ?? ""));
  if (!Number.isFinite(parsed)) {
    return typeof value === "string" ? value : "";
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function parseTransactionDate(value: string | null | undefined): Date {
  const parsed = Date.parse(String(value ?? ""));
  if (!Number.isFinite(parsed)) {
    return new Date();
  }
  return new Date(parsed);
}

function transactionItemName(
  transaction: CollectionTransaction,
  unknownLabel: string,
): string {
  const name = transaction.item_name ?? unknownLabel;
  if (transaction.item_type === "box") {
    return name;
  }

  const number = transaction.card_number ? `#${transaction.card_number}` : null;
  const base = number ? `${name} ${number}` : name;
  const metaParts = [transaction.rarity ?? null].filter(Boolean);

  return metaParts.length ? `${base} [${metaParts.join(" | ")}]` : base;
}

function formatSignedAmount(
  transaction: CollectionTransaction,
  locale: string,
  displayCurrency: DisplayCurrency,
): string {
  const amount = formatMoney(
    toNumber(transaction.display_price ?? transaction.price),
    locale,
    displayCurrency,
  );
  return transaction.transaction_type === "sale" ? `+${amount}` : `-${amount}`;
}

function formatDateInputValue(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseDateInputValue(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const parsed = Date.parse(normalized);
  if (Number.isFinite(parsed)) {
    return new Date(parsed);
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const next = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isNaN(next.getTime()) ? null : next;
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
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
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
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<CollectionTransaction[]>([]);
  const [filter, setFilter] = useState<"all" | "purchase" | "sale">("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuTransaction, setMenuTransaction] =
    useState<CollectionTransaction | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const menuButtonRefs = useRef<Record<string, View | null>>({});
  const [editingTransaction, setEditingTransaction] =
    useState<CollectionTransaction | null>(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [editedOccurredAt, setEditedOccurredAt] = useState(new Date());
  const [editedDateText, setEditedDateText] = useState("");
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
        const nextTransactions = Array.isArray(body?.transactions)
          ? body.transactions
          : [];
        setTransactions((current) =>
          append ? [...current, ...nextTransactions] : nextTransactions,
        );
        setPage(typeof body?.page === "number" ? body.page : nextPage);
        setHasMore(Boolean(body?.has_more));
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

  function openTransactionMenu(
    transaction: CollectionTransaction,
    anchor: MenuAnchor,
  ) {
    setMenuTransaction(transaction);
    setMenuAnchor(anchor);
  }

  function closeTransactionMenu() {
    setMenuTransaction(null);
    setMenuAnchor(null);
  }

  function openEditTransaction(transaction: CollectionTransaction) {
    closeTransactionMenu();
    setEditingTransaction(transaction);
    setEditedPrice(
      formatMoneyInputFromNumber(
        transactionPrice(transaction),
        locale,
        displayCurrency,
      ),
    );
    const nextDate = parseTransactionDate(transaction.occurred_at);
    setEditedOccurredAt(nextDate);
    setEditedDateText(formatDateInputValue(nextDate));
    setError(null);
  }

  function handlePriceChange(value: string) {
    setEditedPrice(formatMoneyInput(value, locale, displayCurrency));
  }

  function confirmDeleteTransaction(transaction: CollectionTransaction) {
    closeTransactionMenu();
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
    const price = parseMoneyInput(editedPrice);
    const parsedDate =
      parseDateInputValue(editedDateText) ??
      (Number.isNaN(editedOccurredAt.getTime()) ? null : editedOccurredAt);
    if (
      !token ||
      !collectionId ||
      !editingTransaction ||
      price === null ||
      !parsedDate
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await requestJson(
        `/api/collections/${collectionId}/transactions/${editingTransaction.id}`,
        token,
        {
          body: JSON.stringify({
            display_currency: displayCurrency,
            occurred_at: parsedDate.toISOString(),
            price,
          }),
          method: "PATCH",
        },
      );
      setEditingTransaction(null);
      setEditedPrice("");
      setEditedDateText("");
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
        keyExtractor={(item, index) =>
          item?.id ? String(item.id) : `tx-${index}`
        }
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
          const signedAmount = formatSignedAmount(item, locale, displayCurrency);
          const occurredAt = item.occurred_at ?? "";
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
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                  {formatDate(occurredAt, locale)}
                </Text>
                <View style={styles.namePriceRow}>
                  <View style={styles.itemNameRow}>
                    {cardLanguageFlag(item.language) ? (
                      <Text
                        accessibilityLabel={
                          languageFlagAccessibilityLabel(item.language) ??
                          undefined
                        }
                        style={styles.languageFlag}
                      >
                        {cardLanguageFlag(item.language)}
                      </Text>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={[styles.itemName, { color: colors.textPrimary }]}
                    >
                      {transactionItemName(item, t("collections.unknown"))}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.amountText,
                      {
                        color: getReturnColor(
                          colors,
                          isSale ? 1 : -1,
                        ),
                      },
                    ]}
                  >
                    {signedAmount}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  const node = menuButtonRefs.current[item.id];
                  node?.measureInWindow((x, y, width, height) => {
                    openTransactionMenu(item, { top: y, left: x, width, height });
                  });
                }}
                ref={(node) => {
                  menuButtonRefs.current[item.id] = node;
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
        estimatedHeight={96}
        onClose={closeTransactionMenu}
        visible={Boolean(menuTransaction)}
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
      </AnchoredActionMenu>

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
          <View
            style={[
              styles.modalOverlay,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
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
                onChangeText={handlePriceChange}
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
              <Text
                style={[styles.sheetFieldLabel, { color: colors.textSecondary }]}
              >
                {t("collections.transactionDate")}
              </Text>
              <TextInput
                onChangeText={(value) => {
                  setEditedDateText(value);
                  const parsed = parseDateInputValue(value);
                  if (parsed) {
                    setEditedOccurredAt(parsed);
                  }
                }}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={editedDateText}
              />
              <Text style={[styles.dateHint, { color: colors.textSecondary }]}>
                {formatDate(editedOccurredAt, locale)}
              </Text>
              <View style={styles.modalActions}>
                <Button
                  disabled={saving}
                  onPress={() => setEditingTransaction(null)}
                  title={t("collections.cancel")}
                />
                <Button
                  color={colors.primary}
                  disabled={
                    saving ||
                    parseMoneyInput(editedPrice) === null ||
                    parseDateInputValue(editedDateText) === null
                  }
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
  amountText: {
    flexShrink: 0,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    marginLeft: 12,
  },
  container: {
    gap: 10,
    padding: 20,
  },
  dateField: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateFieldText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  dateHint: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: -4,
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
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    minWidth: 0,
  },
  itemNameRow: {
    alignItems: "flex-start",
    flex: 1,
    flexDirection: "row",
    gap: 4,
    minWidth: 0,
  },
  languageFlag: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  loadingRow: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  menuButton: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  menuItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 16,
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
  screen: {
    flex: 1,
  },
  namePriceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
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
    minWidth: 0,
  },
  sheetFieldLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
});
