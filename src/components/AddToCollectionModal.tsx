import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { XMON_API_URL } from "@/config";
import { useAuth } from "@/context/AuthContext";
import { useThemeManager, type DisplayCurrency } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { AppColors } from "@/theme/colors";
import type { QualityBucketCode } from "@/types/card";
import { QUALITY_BUCKET_OPTIONS } from "@/utils/qualityBucket";

type Collection = {
  id: string | number;
  name: string;
  description?: string | null;
  card_count?: number | string | null;
  cardCount?: number | string | null;
  active_card_count?: number | string | null;
  cards_count?: number | string | null;
  cardsCount?: number | string | null;
};

type CollectionListResponse =
  | Collection[]
  | { collections?: Collection[]; data?: Collection[] };

type AddToCollectionModalProps = {
  visible: boolean;
  cardId: string;
  onClose: () => void;
};

async function requestJson<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${XMON_API_URL}${path}`, {
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

function collectionCardCount(collection: Collection): number {
  const raw =
    collection.active_card_count ??
    collection.card_count ??
    collection.cardCount ??
    collection.cards_count ??
    collection.cardsCount;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function AddToCollectionModal({
  visible,
  cardId,
  onClose,
}: AddToCollectionModalProps) {
  const { token } = useAuth();
  const { colors, displayCurrency, locale } = useThemeManager();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [qualityBucket, setQualityBucket] =
    useState<QualityBucketCode>("RAW");

  const exitCreateForm = useCallback(() => {
    Keyboard.dismiss();
    setShowCreateForm(false);
    setNewName("");
    setNewDescription("");
    setError(null);
  }, []);

  const handleRequestClose = useCallback(() => {
    if (showCreateForm) {
      exitCreateForm();
      return;
    }
    Keyboard.dismiss();
    onClose();
  }, [exitCreateForm, onClose, showCreateForm]);

  const loadCollections = useCallback(async () => {
    if (!token) {
      setCollections([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body = await requestJson<CollectionListResponse>(
        `/api/collections?display_currency=${displayCurrency}&locale=${encodeURIComponent(locale)}`,
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
    }
  }, [displayCurrency, locale, t, token]);

  useEffect(() => {
    if (!visible) {
      setShowCreateForm(false);
      setNewName("");
      setNewDescription("");
      setQuantity(1);
      setQualityBucket("RAW");
      setError(null);
      return;
    }

    void loadCollections();
  }, [loadCollections, visible]);

  async function addToCollection(collection: Collection) {
    if (!token || adding) {
      return;
    }

    setAdding(true);
    setError(null);

    try {
      await requestJson(`/api/collections/${collection.id}/cards`, token, {
        body: JSON.stringify({
          card_id: cardId,
          display_currency: displayCurrency as DisplayCurrency,
          item_type: "card" as const,
          locale,
          quantity,
          quality_bucket: qualityBucket,
        }),
        method: "POST",
      });

      Alert.alert(
        t("card.addedToCollectionTitle"),
        t("card.addedToCollection", { name: collection.name }),
      );
      Keyboard.dismiss();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotAddCard"),
      );
    } finally {
      setAdding(false);
    }
  }

  async function createAndAdd() {
    const trimmedName = newName.trim();
    if (!token || !trimmedName || creating) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const created = await requestJson<Collection>("/api/collections", token, {
        body: JSON.stringify({
          description: newDescription.trim() || undefined,
          name: trimmedName,
        }),
        method: "POST",
      });

      await requestJson(`/api/collections/${created.id}/cards`, token, {
        body: JSON.stringify({
          card_id: cardId,
          display_currency: displayCurrency as DisplayCurrency,
          item_type: "card" as const,
          locale,
          quantity,
          quality_bucket: qualityBucket,
        }),
        method: "POST",
      });

      Alert.alert(
        t("card.addedToCollectionTitle"),
        t("card.addedToCollection", { name: created.name }),
      );
      Keyboard.dismiss();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("collections.couldNotAddCard"),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleRequestClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlayHost}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlayStrong }]}
          onPress={handleRequestClose}
        />
        <View
          onStartShouldSetResponder={() => true}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {showCreateForm
                ? t("collections.createTitle")
                : t("card.selectCollection")}
            </Text>
            <Pressable onPress={handleRequestClose} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {!token ? (
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              {t("collections.signInAddCards")}
            </Text>
          ) : showCreateForm ? (
            <ScrollView
              contentContainerStyle={styles.createForm}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {t("collections.name")}
                </Text>
                <TextInput
                  autoFocus
                  onChangeText={setNewName}
                  placeholder={t("collections.namePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={newName}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {t("collections.description")}
                </Text>
                <TextInput
                  multiline
                  onChangeText={setNewDescription}
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
                  value={newDescription}
                />
              </View>
              {error ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  disabled={creating}
                  onPress={exitCreateForm}
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                    {t("collections.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={creating || !newName.trim()}
                  onPress={() => void createAndAdd()}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                    creating || !newName.trim() ? styles.disabledButton : null,
                  ]}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    {creating ? t("collections.saving") : t("collections.create")}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <>
              <View style={styles.optionsBlock}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {t("collections.quantity")}
                </Text>
                <View style={styles.quantityRow}>
                  <Pressable
                    disabled={quantity <= 1}
                    onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity: quantity <= 1 ? 0.5 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="minus"
                      color={colors.textPrimary}
                      size={18}
                    />
                  </Pressable>
                  <Text style={[styles.quantityValue, { color: colors.textPrimary }]}>
                    {quantity}
                  </Text>
                  <Pressable
                    onPress={() => setQuantity((current) => current + 1)}
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
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

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {t("collections.quality")}
                </Text>
                <View style={styles.qualityRow}>
                  {QUALITY_BUCKET_OPTIONS.map((option) => {
                    const active = qualityBucket === option.code;
                    return (
                      <Pressable
                        key={option.code}
                        onPress={() => setQualityBucket(option.code)}
                        style={[
                          styles.qualityChip,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : colors.background,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.qualityChipText,
                            {
                              color: active
                                ? colors.onPrimary
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          {t(option.labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {loading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    {t("collections.loading")}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={collections}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                      {t("collections.empty")}
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      disabled={adding}
                      onPress={() => void addToCollection(item)}
                      style={[
                        styles.collectionRow,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.collectionIdentity}>
                        <Text
                          style={[styles.collectionName, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {item.description ? (
                          <Text
                            style={[styles.collectionDescription, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.collectionCount, { color: colors.textMuted }]}>
                        {t("collections.cardLine", {
                          count: collectionCardCount(item),
                          value: "",
                        }).replace(/\s*\|\s*$/, "")}
                      </Text>
                    </Pressable>
                  )}
                />
              )}

              {error ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </Text>
              ) : null}

              <Pressable
                disabled={adding || creating}
                onPress={() => {
                  setShowCreateForm(true);
                  setError(null);
                }}
                style={[styles.createLink, { borderColor: colors.border }]}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.createLinkText, { color: colors.primary }]}>
                  {t("collections.createTitle")}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlayHost: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "85%",
      minHeight: 320,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
    },
    closeButton: {
      alignItems: "center",
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    helperText: {
      fontSize: 14,
      lineHeight: 20,
      paddingVertical: 16,
      textAlign: "center",
    },
    loadingState: {
      alignItems: "center",
      gap: 10,
      paddingVertical: 24,
    },
    listContent: {
      gap: 8,
      paddingBottom: 8,
    },
    optionsBlock: {
      gap: 10,
      marginBottom: 12,
    },
    qualityChip: {
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    qualityChipText: {
      fontSize: 12,
      fontWeight: "800",
    },
    qualityRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
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
    collectionRow: {
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    collectionIdentity: {
      flex: 1,
      gap: 2,
    },
    collectionName: {
      fontSize: 15,
      fontWeight: "800",
    },
    collectionDescription: {
      fontSize: 12,
      fontWeight: "600",
    },
    collectionCount: {
      fontSize: 12,
      fontWeight: "700",
    },
    createLink: {
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      marginTop: 8,
      minHeight: 44,
    },
    createLinkText: {
      fontSize: 14,
      fontWeight: "800",
    },
    createForm: {
      gap: 14,
      paddingBottom: 8,
    },
    fieldGroup: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    input: {
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 15,
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    descriptionInput: {
      minHeight: 88,
      textAlignVertical: "top",
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    primaryButton: {
      alignItems: "center",
      borderRadius: 8,
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: "800",
    },
    secondaryButton: {
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: "800",
    },
    disabledButton: {
      opacity: 0.5,
    },
    errorText: {
      fontSize: 13,
      fontWeight: "600",
      marginTop: 8,
      textAlign: "center",
    },
  });
}
