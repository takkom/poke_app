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
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  getCardListDisplayName,
  getDisplayRarity,
} from "@/utils/displayNames";
import { resolveCollectionSearchImageUrl } from "@/utils/mediaUrl";
import {
  formatMoneyInput,
  formatMoneyInputFromNumber,
  parseMoneyInput,
} from "@/utils/moneyInput";
import {
  cardLanguageFlag,
  languageFlagAccessibilityLabel,
} from "@/utils/languageFlag";
import { QualityBucketCode } from "@/types/card";
import { QUALITY_BUCKET_OPTIONS } from "@/utils/qualityBucket";

type AuthState = {
  token?: string | null;
  accessToken?: string | null;
  authToken?: string | null;
};

type SearchItemType = "card" | "box";

type SearchCandidate = {
  id?: string;
  canonical_id?: string | null;
  tcgdex_id?: string | null;
  name?: string | null;
  display_name?: string | null;
  local_id?: string | null;
  card_code?: string | null;
  language?: string | null;
  set_id?: string | null;
  set_name?: string | null;
  set_code?: string | null;
  rarity?: string | null;
  image_url?: string | null;
  projected_image_asset_path?: string | null;
  avgPrice?: number | null;
  displayCurrency?: DisplayCurrency | "JPY";
};

type SearchResponse = {
  status?: "matched" | "review" | "unresolved" | "manual_override";
  item_type?: SearchItemType;
  card?: SearchCandidate | null;
  box?: SearchCandidate | null;
  candidates?: SearchCandidate[];
};

function getAuthToken(auth: AuthState): string | null {
  return auth.accessToken ?? auth.authToken ?? auth.token ?? null;
}

function candidateName(
  item: SearchCandidate,
  locale: AppLocale,
): string | null {
  const localizedName = item.display_name ?? item.name;
  if (!localizedName) {
    return null;
  }

  return getCardListDisplayName(
    {
      name: localizedName,
      pokemon_name: item.name ?? null,
    },
    locale,
  );
}

function cardNumber(card: SearchCandidate): string {
  const slashCode = card.card_code?.match(
    /\b([A-Z]*\d+|SV\d+)\s*\/\s*(\d+)\b/i,
  );
  if (slashCode) {
    return `${slashCode[1].toUpperCase()}/${slashCode[2]}`;
  }

  return card.local_id ?? card.card_code ?? "-";
}

function itemIdentity(item: SearchCandidate): string {
  return item.canonical_id ?? item.id ?? item.tcgdex_id ?? "";
}

function itemImage(item: SearchCandidate): string | null {
  return resolveCollectionSearchImageUrl(item, "low");
}

function formatMoney(
  value: number,
  currency: DisplayCurrency | "JPY",
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
    style: "currency",
  }).format(value);
}

function boxMetaLine(item: SearchCandidate): string {
  const parts = [item.set_name, item.set_code].filter(Boolean);
  return parts.join(" | ");
}

function cardMetaLine(item: SearchCandidate, locale: AppLocale): string {
  const rarity = getDisplayRarity(item.rarity, locale);
  return `#${cardNumber(item)}${rarity ? ` | ${rarity}` : ""}`;
}

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
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const rawMessage =
      body && typeof body === "object" && body !== null && "message" in body
        ? (body as { message: unknown }).message
        : null;
    const message = Array.isArray(rawMessage)
      ? rawMessage.map(String).join(", ")
      : typeof rawMessage === "string" && rawMessage.trim()
        ? rawMessage
        : "Request failed. Please try again.";
    throw new Error(message);
  }

  return body as T;
}

function resolveSearchItemType(
  value: string | string[] | undefined,
): SearchItemType {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "box" ? "box" : "card";
}

export default function AddCollectionCardScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    type?: string | string[];
  }>();
  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const auth = useAuth() as AuthState;
  const token = getAuthToken(auth);
  const { colors, displayCurrency } = useThemeManager();
  const { locale, t } = useI18n();
  const [itemType, setItemType] = useState<SearchItemType>(() =>
    resolveSearchItemType(params.type),
  );
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchCandidate | null>(
    null,
  );
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [qualityBucket, setQualityBucket] =
    useState<QualityBucketCode>("RAW");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");

  const selectedImage = useMemo(
    () => (selectedItem ? itemImage(selectedItem) : null),
    [selectedItem],
  );

  const selectedDefaultPrice = useMemo(
    () =>
      typeof selectedItem?.avgPrice === "number"
        ? formatMoney(
            selectedItem.avgPrice,
            selectedItem.displayCurrency ?? displayCurrency,
            locale,
          )
        : null,
    [displayCurrency, locale, selectedItem],
  );

  function showMessage(next: string | null, tone: "info" | "error" = "info") {
    setMessage(next);
    setMessageTone(tone);
  }

  function resetResults() {
    setSelectedItem(null);
    setCandidates([]);
    setPrice("");
    setQuantity(1);
    setQualityBucket("RAW");
    showMessage(null);
  }

  function changeItemType(next: SearchItemType) {
    if (next === itemType) {
      return;
    }
    setItemType(next);
    resetResults();
  }

  function selectItem(item: SearchCandidate) {
    setSelectedItem(item);
    setPrice(formatMoneyInputFromNumber(0, locale, displayCurrency));
    setQuantity(1);
    setQualityBucket("RAW");
    showMessage(null);
  }

  async function search() {
    if (!token || !query.trim()) {
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    showMessage(null);
    setSelectedItem(null);
    setCandidates([]);

    try {
      const body = await requestJson<SearchResponse>(
        "/api/resolution/search",
        token,
        {
          body: JSON.stringify({
            display_currency: displayCurrency,
            item_type: itemType,
            locale,
            query: query.trim(),
          }),
          method: "POST",
        },
      );
      const bestMatch =
        itemType === "box" ? (body.box ?? null) : (body.card ?? null);
      const nextCandidates = body.candidates ?? [];

      if (
        (body.status === "matched" ||
          body.status === "manual_override" ||
          (!body.status && bestMatch)) &&
        bestMatch
      ) {
        setCandidates([bestMatch]);
        selectItem(bestMatch);
        return;
      }

      setCandidates(nextCandidates);
      showMessage(
        nextCandidates.length
          ? itemType === "box"
            ? t("collections.chooseExactBox")
            : t("collections.chooseExactCard")
          : itemType === "box"
            ? t("collections.noMatchingBoxes")
            : t("collections.noMatchingCards"),
      );
    } catch (caught) {
      showMessage(
        caught instanceof Error
          ? caught.message
          : t("collections.searchFailed"),
        "error",
      );
    } finally {
      setSearching(false);
    }
  }

  async function saveItem() {
    if (!token || !collectionId || !selectedItem) {
      return;
    }

    const selectedId = itemIdentity(selectedItem);
    if (!selectedId) {
      showMessage(
        itemType === "box"
          ? t("collections.boxMissingId")
          : t("collections.cardMissingId"),
        "error",
      );
      return;
    }

    setSaving(true);
    showMessage(null);

    try {
      const purchasePrice = parseMoneyInput(price);
      const payload =
        itemType === "box"
          ? {
              box_id: selectedId,
              display_currency: displayCurrency,
              item_type: "box" as const,
              locale,
              purchase_price:
                purchasePrice !== null ? purchasePrice : undefined,
              quantity,
            }
          : {
              card_id: selectedId,
              display_currency: displayCurrency,
              item_type: "card" as const,
              locale,
              purchase_price:
                purchasePrice !== null ? purchasePrice : undefined,
              quantity,
              quality_bucket: qualityBucket,
            };

      await requestJson(`/api/collections/${collectionId}/cards`, token, {
        body: JSON.stringify(payload),
        method: "POST",
      });
      router.replace(`/collections/${collectionId}`);
    } catch (caught) {
      showMessage(
        caught instanceof Error
          ? caught.message
          : itemType === "box"
            ? t("collections.couldNotAddBox")
            : t("collections.couldNotAddCard"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("collections.addItem")}
        </Text>
        <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
          {t("collections.signInAddCards")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        contentContainerStyle={styles.container}
        data={candidates}
        extraData={locale}
        keyExtractor={(item, index) => `${itemIdentity(item)}-${index}`}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {itemType === "box"
                ? t("collections.addBox")
                : t("collections.addCard")}
            </Text>

            <View
              style={[
                styles.typeToggle,
                {
                  backgroundColor: colors.surfaceAlternate,
                  borderColor: colors.border,
                },
              ]}
            >
              {(["card", "box"] as const).map((type) => {
                const active = itemType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => changeItemType(type)}
                    style={[
                      styles.typeToggleButton,
                      active
                        ? { backgroundColor: colors.primary }
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeToggleText,
                        {
                          color: active
                            ? colors.onPrimary
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {type === "box"
                        ? t("collections.itemTypeBox")
                        : t("collections.itemTypeCard")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.searchRow}>
              <TextInput
                autoCapitalize="none"
                onChangeText={setQuery}
                onSubmitEditing={() => void search()}
                placeholder={
                  itemType === "box"
                    ? t("collections.searchBoxPlaceholder")
                    : t("collections.searchPlaceholder")
                }
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceAlternate,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={query}
              />
              <Pressable
                disabled={searching || !query.trim()}
                onPress={() => void search()}
                style={[
                  styles.iconButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: searching || !query.trim() ? 0.5 : 1,
                  },
                ]}
              >
                {searching ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <MaterialCommunityIcons
                    name="magnify"
                    color={colors.onPrimary}
                    size={22}
                  />
                )}
              </Pressable>
            </View>

            {selectedItem ? (
              <View
                style={[
                  styles.selectedPanel,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionTitle, { color: colors.textSecondary }]}
                >
                  {t("collections.selected")}
                </Text>
                <View style={styles.selectedRow}>
                  <CardListImage
                    uri={selectedImage}
                    recyclingKey={
                      selectedItem ? itemIdentity(selectedItem) : "selected"
                    }
                    style={
                      itemType === "box"
                        ? styles.selectedBoxThumbnail
                        : styles.selectedThumbnail
                    }
                    backgroundColor={colors.surfaceMuted}
                    iconColor={colors.textSecondary}
                    fallbackIcon={
                      itemType === "box" ? "package-variant" : "cards-outline"
                    }
                  />
                  <View style={styles.selectedDetails}>
                    <View style={styles.cardNameRow}>
                      {cardLanguageFlag(selectedItem.language) ? (
                        <Text
                          accessibilityLabel={
                            languageFlagAccessibilityLabel(
                              selectedItem.language,
                            ) ?? undefined
                          }
                          style={styles.languageFlag}
                        >
                          {cardLanguageFlag(selectedItem.language)}
                        </Text>
                      ) : null}
                      <Text
                        numberOfLines={1}
                        style={[styles.cardName, { color: colors.textPrimary }]}
                      >
                        {candidateName(selectedItem, locale) ??
                          (itemType === "box"
                            ? t("collections.unknownBox")
                            : t("collections.unknownCard"))}
                      </Text>
                    </View>
                    <Text
                      style={[styles.mutedText, { color: colors.textSecondary }]}
                    >
                      {itemType === "box"
                        ? boxMetaLine(selectedItem)
                        : cardMetaLine(selectedItem, locale)}
                    </Text>
                  </View>
                </View>
                {selectedDefaultPrice ? (
                  <Text
                    style={[styles.mutedText, { color: colors.textSecondary }]}
                  >
                    {t("collections.avg30", { value: selectedDefaultPrice })}
                  </Text>
                ) : null}

                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  {t("collections.quantity")}
                </Text>
                <View style={styles.quantityRow}>
                  <Pressable
                    disabled={quantity <= 1}
                    onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: colors.surfaceAlternate,
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
                  <Text
                    style={[styles.quantityValue, { color: colors.textPrimary }]}
                  >
                    {quantity}
                  </Text>
                  <Pressable
                    onPress={() => setQuantity((current) => current + 1)}
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: colors.surfaceAlternate,
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

                {itemType === "card" ? (
                  <>
                    <Text
                      style={[styles.fieldLabel, { color: colors.textSecondary }]}
                    >
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
                                  : colors.surfaceAlternate,
                                borderColor: active
                                  ? colors.primary
                                  : colors.border,
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
                  </>
                ) : null}

                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  {t("collections.purchasePrice")}
                </Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setPrice(formatMoneyInput(value, locale, displayCurrency))
                  }
                  placeholder={t("collections.purchasePrice")}
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={price}
                />
                <Pressable
                  disabled={saving}
                  onPress={() => void saveItem()}
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: saving ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.saveButtonText, { color: colors.onPrimary }]}
                  >
                    {saving
                      ? t("collections.adding")
                      : t("collections.addToCollection")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {message ? (
              <Text
                style={[
                  styles.messageText,
                  {
                    color:
                      messageTone === "error"
                        ? colors.error
                        : colors.textSecondary,
                  },
                ]}
              >
                {message}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          searching ? null : (
            <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
              {itemType === "box"
                ? t("collections.searchBoxToBegin")
                : t("collections.searchToBegin")}
            </Text>
          )
        }
        renderItem={({ item, index }) => {
          const selected =
            selectedItem &&
            itemIdentity(selectedItem) === itemIdentity(item);
          const image = itemImage(item);
          return (
            <Pressable
              onPress={() => selectItem(item)}
              style={[
                styles.resultRow,
                {
                  backgroundColor:
                    index % 2 === 1
                      ? colors.surfaceAlternate
                      : colors.background,
                  borderColor: selected ? colors.primary : "transparent",
                },
              ]}
            >
              <CardListImage
                uri={image}
                recyclingKey={itemIdentity(item)}
                style={itemType === "box" ? styles.boxThumbnail : styles.thumbnail}
                backgroundColor={colors.surfaceMuted}
                iconColor={colors.textSecondary}
                fallbackIcon={
                  itemType === "box" ? "package-variant" : "cards-outline"
                }
              />
              <View style={styles.resultText}>
                <View style={styles.cardNameRow}>
                  {cardLanguageFlag(item.language) ? (
                    <Text
                      accessibilityLabel={
                        languageFlagAccessibilityLabel(item.language) ?? undefined
                      }
                      style={styles.languageFlag}
                    >
                      {cardLanguageFlag(item.language)}
                    </Text>
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={[styles.cardName, { color: colors.textPrimary }]}
                  >
                    {candidateName(item, locale) ??
                      (itemType === "box"
                        ? t("collections.unknownBox")
                        : t("collections.unknownCard"))}
                  </Text>
                </View>
                <Text
                  style={[styles.mutedText, { color: colors.textSecondary }]}
                >
                  {itemType === "box"
                    ? boxMetaLine(item)
                    : cardMetaLine(item, locale)}
                </Text>
                {typeof item.avgPrice === "number" ? (
                  <Text
                    style={[styles.priceText, { color: colors.textPrimary }]}
                  >
                    {formatMoney(
                      item.avgPrice,
                      item.displayCurrency ?? displayCurrency,
                      locale,
                    )}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    minWidth: 0,
  },
  cardNameRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 4,
  },
  languageFlag: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  header: {
    gap: 14,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageText: {
    fontSize: 14,
  },
  mutedText: {
    fontSize: 13,
  },
  priceText: {
    fontSize: 14,
    fontWeight: "800",
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
  resultRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 10,
  },
  resultText: {
    flex: 1,
    gap: 4,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  screen: {
    flex: 1,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  selectedDetails: {
    flex: 1,
    gap: 4,
  },
  selectedBoxThumbnail: {
    borderRadius: 6,
    height: 76,
    resizeMode: "cover",
    width: 76,
  },
  selectedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  selectedThumbnail: {
    borderRadius: 6,
    height: 76,
    resizeMode: "cover",
    width: 54,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  selectedPanel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  thumbnail: {
    borderRadius: 6,
    height: 70,
    resizeMode: "cover",
    width: 50,
  },
  boxThumbnail: {
    borderRadius: 6,
    height: 70,
    resizeMode: "cover",
    width: 70,
  },
  thumbnailFallback: {
    alignItems: "center",
    borderRadius: 6,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  typeToggle: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 4,
  },
  typeToggleButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  typeToggleText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
