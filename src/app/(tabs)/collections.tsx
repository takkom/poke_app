import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { XMON_API_URL } from "@/config";
import { Text } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { darkColors, type AppColors } from "@/theme/colors";
import { useAuth } from "../../context/AuthContext";
import {
  useThemeManager,
  type DisplayCurrency,
} from "../../hooks/useThemeManager";
import { useI18n } from "../../i18n";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? XMON_API_URL;
const ROW_DRAG_HEIGHT = 108;

type AuthState = {
  token?: string | null;
  accessToken?: string | null;
  authToken?: string | null;
};

type Collection = {
  id: string | number;
  name: string;
  description?: string | null;
  order_number?: number | string | null;
  orderNumber?: number | string | null;
  total_value?: number | string | null;
  totalValue?: number | string | null;
  card_count?: number | string | null;
  cardCount?: number | string | null;
  active_card_count?: number | string | null;
  cards_count?: number | string | null;
  cardsCount?: number | string | null;
  display_currency?: DisplayCurrency | string | null;
};

type CollectionListResponse =
  | Collection[]
  | { collections?: Collection[]; data?: Collection[] };

function getAuthToken(auth: AuthState): string | null {
  return auth.accessToken ?? auth.authToken ?? auth.token ?? null;
}

function currency(
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

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function collectionValue(collection: Collection): number {
  return toNumber(collection.total_value ?? collection.totalValue);
}

function collectionCardCount(collection: Collection): number {
  return toNumber(
    collection.active_card_count ??
      collection.card_count ??
      collection.cardCount ??
      collection.cards_count ??
      collection.cardsCount,
  );
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
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

function CollectionPlate({
  collection,
  colors,
  index,
  isAlternate,
  locale,
  displayCurrency,
  onDragEnd,
  onDragTargetChange,
  onDragStart,
  onMenu,
  onOpen,
  itemCount,
  targetIndex,
  t,
}: {
  collection: Collection;
  colors: AppColors;
  index: number;
  isAlternate: boolean;
  itemCount: number;
  locale: string;
  displayCurrency: DisplayCurrency;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragTargetChange: (fromIndex: number, toIndex: number) => void;
  onDragStart: () => void;
  onMenu: (collection: Collection) => void;
  onOpen: (collection: Collection) => void;
  targetIndex: number | null;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [dragging, setDragging] = useState(false);
  const originIndexRef = useRef(index);
  const targetIndexRef = useRef(index);
  const cardCount = collectionCardCount(collection);
  const valueText = currency(collectionValue(collection), locale, displayCurrency);
  const cardCountText = t("collections.cardLine", {
    count: cardCount,
    value: "",
  }).replace(/\s*\|\s*$/, "");
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          setDragging(true);
          onDragStart();
          originIndexRef.current = index;
          targetIndexRef.current = index;
          onDragTargetChange(index, index);
        },
        onPanResponderMove: (_, gesture) => {
          const step = Math.round(gesture.dy / ROW_DRAG_HEIGHT);
          const targetIndex = Math.max(
            0,
            Math.min(itemCount - 1, originIndexRef.current + step),
          );
          if (targetIndex !== targetIndexRef.current) {
            targetIndexRef.current = targetIndex;
            onDragTargetChange(originIndexRef.current, targetIndex);
          }
        },
        onPanResponderRelease: () => {
          setDragging(false);
          onDragEnd(originIndexRef.current, targetIndexRef.current);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          onDragEnd(originIndexRef.current, targetIndexRef.current);
        },
      }),
    [index, itemCount, onDragEnd, onDragStart, onDragTargetChange],
  );

  return (
    <View
      style={[
        styles.collectionPlate,
        {
          backgroundColor: isAlternate
            ? colors.surfaceAlternate
            : colors.background,
        },
        dragging
          ? [styles.collectionPlateDragging, { borderColor: colors.primary }]
          : null,
        targetIndex === index && !dragging
          ? [styles.collectionPlateTarget, { borderColor: colors.primary }]
          : null,
      ]}
    >
      <View style={styles.dragHandle} {...panResponder.panHandlers}>
        <MaterialCommunityIcons
          name="drag-vertical"
          color={colors.textSecondary}
          size={24}
        />
      </View>

      <Pressable
        onPress={() => onOpen(collection)}
        style={styles.collectionText}
      >
        <View
          style={[
            styles.collectionNumberBlock,
            { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Text style={[styles.collectionNumber, { color: colors.textSecondary }]}>
            {index + 1}
          </Text>
        </View>
        <View style={styles.collectionIdentity}>
          <Text
            numberOfLines={1}
            style={[styles.collectionName, { color: darkColors.primary }]}
          >
            {collection.name}
          </Text>
          {collection.description ? (
            <Text
              numberOfLines={1}
              style={[styles.mutedText, { color: colors.textSecondary }]}
            >
              {collection.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.collectionStats}>
          <Text
            numberOfLines={1}
            style={[styles.collectionValue, { color: darkColors.arbitragePositive }]}
          >
            {valueText}
            <Text style={{ color: colors.textPrimary }}> ({cardCountText})</Text>
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={() => onMenu(collection)} style={styles.iconButton}>
        <MaterialCommunityIcons
          name="dots-vertical"
          color={colors.textPrimary}
          size={22}
        />
      </Pressable>
    </View>
  );
}

export default function CollectionsScreen() {
  const router = useRouter();
  const auth = useAuth() as AuthState;
  const { colors, displayCurrency } = useThemeManager();
  const { locale, t } = useI18n();
  const token = getAuthToken(auth);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orderPosition, setOrderPosition] = useState(1);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [menuCollection, setMenuCollection] = useState<Collection | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [dragTarget, setDragTarget] = useState<{
    fromIndex: number;
    toIndex: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  const collectionsRef = useRef<Collection[]>([]);
  collectionsRef.current = collections;

  const totalCards = useMemo(
    () =>
      collections.reduce(
        (sum, collection) => sum + collectionCardCount(collection),
        0,
      ),
    [collections],
  );

  const totalValue = useMemo(
    () =>
      collections.reduce(
        (sum, collection) => sum + collectionValue(collection),
        0,
      ),
    [collections],
  );

  const loadCollections = useCallback(
    async (showRefresh = false) => {
      if (!token) {
        setCollections([]);
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
        const body = await requestJson<CollectionListResponse>(
          `/api/collections?display_currency=${displayCurrency}`,
          token,
        );
        const nextCollections = Array.isArray(body)
          ? body
          : (body.collections ?? body.data ?? []);
        setCollections(nextCollections);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : t("collections.couldNotLoad"),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [displayCurrency, t, token],
  );

  useFocusEffect(
    useCallback(() => {
      void loadCollections();
    }, [loadCollections]),
  );

  useEffect(() => {
    if (!modalMode) {
      return undefined;
    }

    const focusNameInput = () => {
      nameInputRef.current?.focus();
    };
    const interaction = InteractionManager.runAfterInteractions(() => {
      focusNameInput();
    });
    const animationFrame = requestAnimationFrame(focusNameInput);
    const retryTimers = [80, 220, 420].map((delay) =>
      setTimeout(focusNameInput, delay),
    );

    return () => {
      interaction.cancel();
      cancelAnimationFrame(animationFrame);
      retryTimers.forEach(clearTimeout);
    };
  }, [modalMode]);

  function openCreateModal() {
    setName("");
    setDescription("");
    setOrderPosition(1);
    setEditingCollection(null);
    setModalMode("create");
    setError(null);
  }

  function openEditModal(collection: Collection) {
    const currentIndex = collectionsRef.current.findIndex(
      (item) => String(item.id) === String(collection.id),
    );
    setName(collection.name);
    setDescription(collection.description ?? "");
    setOrderPosition(currentIndex >= 0 ? currentIndex + 1 : 1);
    setEditingCollection(collection);
    setMenuCollection(null);
    setModalMode("edit");
    setError(null);
  }

  function closeFormModal() {
    setModalMode(null);
    setEditingCollection(null);
    setName("");
    setDescription("");
    setOrderPosition(1);
  }

  async function saveCollection() {
    const trimmedName = name.trim();
    if (!token || !trimmedName) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (modalMode === "edit" && editingCollection) {
        await requestJson<Collection>(
          `/api/collections/${editingCollection.id}`,
          token,
          {
            body: JSON.stringify({
              description: description.trim() || undefined,
              name: trimmedName,
            }),
            method: "PATCH",
          },
        );

        const currentIndex = collectionsRef.current.findIndex(
          (item) => String(item.id) === String(editingCollection.id),
        );
        const targetIndex = Math.max(
          0,
          Math.min(collectionsRef.current.length - 1, orderPosition - 1),
        );

        if (currentIndex >= 0 && currentIndex !== targetIndex) {
          const reordered = moveItem(
            collectionsRef.current,
            currentIndex,
            targetIndex,
          );
          setCollections(reordered);
          await persistOrder(reordered);
        }
      } else {
        await requestJson<Collection>("/api/collections", token, {
          body: JSON.stringify({
            description: description.trim() || undefined,
            name: trimmedName,
          }),
          method: "POST",
        });
      }

      closeFormModal();
      await loadCollections();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotSave"),
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(collection: Collection) {
    if (!token) {
      return;
    }

    setMenuCollection(null);
    Alert.alert(
      t("collections.deleteTitle"),
      t("collections.deleteMessage", { name: collection.name }),
      [
        { style: "cancel", text: t("collections.cancel") },
        {
          onPress: () => void deleteCollection(collection),
          style: "destructive",
          text: t("collections.delete"),
        },
      ],
    );
  }

  async function deleteCollection(collection: Collection) {
    if (!token) {
      return;
    }

    setError(null);

    try {
      await requestJson<{ deleted: boolean }>(
        `/api/collections/${collection.id}`,
        token,
        {
          method: "DELETE",
        },
      );
      setCollections((current) =>
        current.filter((item) => item.id !== collection.id),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotDelete"),
      );
    }
  }

  const persistOrder = useCallback(
    async (orderedCollections: Collection[]) => {
      setDragActive(false);
      setDragTarget(null);

      if (!token) {
        return;
      }

      const orderedIds = orderedCollections.map((collection) =>
        String(collection.id),
      );
      try {
        await requestJson<Collection[]>("/api/collections/reorder", token, {
          body: JSON.stringify({ collection_ids: orderedIds }),
          method: "PATCH",
        });
        await loadCollections();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : t("collections.couldNotUpdateOrder"),
        );
        await loadCollections();
      }
    },
    [loadCollections, t, token],
  );

  const startCollectionDrag = useCallback(() => {
    setDragActive(true);
  }, []);

  const previewCollectionDrop = useCallback(
    (fromIndex: number, toIndex: number) => {
      setDragActive(true);
      setDragTarget({ fromIndex, toIndex });
    },
    [],
  );

  const finishCollectionDrag = useCallback(
    (fromIndex: number, toIndex: number) => {
      const current = collectionsRef.current;
      const boundedToIndex = Math.max(0, Math.min(current.length - 1, toIndex));

      if (
        !current.length ||
        fromIndex === boundedToIndex ||
        fromIndex < 0 ||
        fromIndex >= current.length
      ) {
        setDragActive(false);
        setDragTarget(null);
        return;
      }

      const nextCollections = moveItem(current, fromIndex, boundedToIndex);
      setCollections(nextCollections);
      void persistOrder(nextCollections);
    },
    [persistOrder],
  );

  const maxOrderPosition = Math.max(1, collections.length);

  if (!token) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("collections.title")}
        </Text>
        <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
          {t("collections.signInManage")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        contentContainerStyle={styles.container}
        data={collections}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={!dragActive}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  {t("collections.title")}
                </Text>
                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                  {t("collections.summary", {
                    collections: collections.length,
                    cards: totalCards,
                    value: currency(totalValue, locale, displayCurrency),
                  })}
                </Text>
              </View>
              <Pressable
                onPress={openCreateModal}
                style={[
                  styles.primaryIconButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <MaterialCommunityIcons
                  name="plus"
                  color={colors.onPrimary}
                  size={24}
                />
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
          loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {t("collections.loading")}
              </Text>
            </View>
          ) : (
            <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
              {t("collections.empty")}
            </Text>
          )
        }
        refreshControl={
          <RefreshControl
            enabled={!dragActive}
            onRefresh={() => void loadCollections(true)}
            refreshing={!dragActive && refreshing}
          />
        }
        renderItem={({ item, index }) => (
          <CollectionPlate
            collection={item}
            colors={colors}
            index={index}
            isAlternate={true}
            itemCount={collections.length}
            locale={locale}
            displayCurrency={displayCurrency}
            onDragEnd={finishCollectionDrag}
            onDragStart={startCollectionDrag}
            onDragTargetChange={previewCollectionDrop}
            onMenu={setMenuCollection}
            onOpen={(collection) =>
              router.push(`/collections/${collection.id}`)
            }
            targetIndex={dragTarget?.toIndex ?? null}
            t={t}
          />
        )}
      />

      {modalMode ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={24}
          style={styles.formOverlayHost}
        >
          <View style={styles.modalOverlay}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[styles.modalTitle, { color: colors.textPrimary }]}
                >
                  {modalMode === "edit"
                    ? t("collections.editTitle")
                    : t("collections.createTitle")}
                </Text>
                <View style={styles.fieldGroup}>
                  <Text
                    style={[styles.fieldLabel, { color: colors.textSecondary }]}
                  >
                    {t("collections.name")}
                  </Text>
                  <TextInput
                    autoFocus
                    ref={nameInputRef}
                    onChangeText={setName}
                    placeholder={t("collections.namePlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    selectTextOnFocus={modalMode === "edit"}
                    showSoftInputOnFocus
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={name}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text
                    style={[styles.fieldLabel, { color: colors.textSecondary }]}
                  >
                    {t("collections.description")}
                  </Text>
                  <TextInput
                    multiline
                    onChangeText={setDescription}
                    placeholder={t("collections.descriptionPlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.input,
                      styles.descriptionInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={description}
                  />
                </View>
                {modalMode === "edit" ? (
                  <View style={styles.fieldGroup}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("collections.position")}
                    </Text>
                    <View style={styles.positionControl}>
                      <Pressable
                        disabled={orderPosition <= 1}
                        onPress={() =>
                          setOrderPosition((current) =>
                            Math.max(1, current - 1),
                          )
                        }
                        style={[
                          styles.positionButton,
                          { backgroundColor: colors.surfaceMuted },
                          orderPosition <= 1 ? styles.disabledButton : null,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="minus"
                          color={colors.textPrimary}
                          size={20}
                        />
                      </Pressable>
                      <View
                        style={[
                          styles.positionReadout,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.positionNumber,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {orderPosition}
                        </Text>
                        <Text
                          style={[
                            styles.positionHint,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("collections.positionOf", {
                            count: maxOrderPosition,
                          })}
                        </Text>
                      </View>
                      <Pressable
                        disabled={orderPosition >= maxOrderPosition}
                        onPress={() =>
                          setOrderPosition((current) =>
                            Math.min(maxOrderPosition, current + 1),
                          )
                        }
                        style={[
                          styles.positionButton,
                          { backgroundColor: colors.surfaceMuted },
                          orderPosition >= maxOrderPosition
                            ? styles.disabledButton
                            : null,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="plus"
                          color={colors.textPrimary}
                          size={20}
                        />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    disabled={saving}
                    onPress={closeFormModal}
                    style={[
                      styles.secondaryButton,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {t("collections.cancel")}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={saving || !name.trim()}
                    onPress={() => void saveCollection()}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.primary },
                      saving || !name.trim() ? styles.disabledButton : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        { color: colors.onPrimary },
                      ]}
                    >
                      {saving
                        ? t("collections.saving")
                        : modalMode === "edit"
                          ? t("collections.save")
                          : t("collections.create")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setMenuCollection(null)}
        transparent
        visible={Boolean(menuCollection)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuCollection(null)}
        >
          <View
            style={[styles.menuContent, { backgroundColor: colors.surface }]}
          >
            <Pressable
              onPress={() => menuCollection && openEditModal(menuCollection)}
              style={styles.menuItem}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                color={colors.textPrimary}
                size={20}
              />
              <Text style={[styles.menuText, { color: colors.textPrimary }]}>
                {t("collections.edit")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => menuCollection && confirmDelete(menuCollection)}
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
  collectionName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    minWidth: 0,
  },
  collectionPlate: {
    alignItems: "center",
    borderRadius: 0,
    borderWidth: 0,
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
    marginBottom: 2,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  collectionPlateDragging: {
    borderColor: "#007aff",
    borderWidth: 1,
    opacity: 0.86,
  },
  collectionPlateTarget: {
    borderColor: "#007aff",
    borderWidth: 2,
  },
  collectionText: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  collectionNumberBlock: {
    alignItems: "center",
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  collectionNumber: {
    color: "#64748b",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
  },
  collectionIdentity: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  collectionStats: {
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
  },
  collectionValue: {
    color: "#0f172a",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
  },
  container: {
    gap: 0,
    padding: 20,
  },
  deleteText: {
    color: "#dc2626",
  },
  descriptionInput: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  disabledButton: {
    opacity: 0.5,
  },
  dragHandle: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    width: 30,
  },
  errorText: {
    color: "#b00020",
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },
  formOverlayHost: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  header: {
    gap: 12,
    marginBottom: 4,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 36,
  },
  input: {
    borderColor: "#bbbbbb",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loadingRow: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  menuContent: {
    backgroundColor: "#ffffff",
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
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
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
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalScrollContent: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  mutedText: {
    color: "#666666",
    fontSize: 13,
  },
  positionButton: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  positionControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  positionHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  positionNumber: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
  },
  positionReadout: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 54,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#007aff",
    borderRadius: 8,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  primaryIconButton: {
    alignItems: "center",
    backgroundColor: "#007aff",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  screen: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "800",
  },
  summary: {
    color: "#444444",
    marginTop: 6,
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800",
  },
});
