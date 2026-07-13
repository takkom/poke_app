import { useAuth } from "@/context/AuthContext";
import { useThemeManager, type DisplayCurrency } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { XMON_API_URL } from "@/config";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { resolveCollectionSearchImageUrl } from "@/utils/mediaUrl";

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

function candidateName(item: SearchCandidate): string | null {
  return item.display_name ?? item.name ?? null;
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

function boxMetaLine(item: SearchCandidate, unknownLabel: string): string {
  const parts = [
    item.set_name,
    item.set_code,
    item.language,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : unknownLabel;
}

function cardMetaLine(
  item: SearchCandidate,
  unknownLabel: string,
): string {
  return `#${cardNumber(item)} | ${item.language ?? unknownLabel}${
    item.rarity ? ` | ${item.rarity}` : ""
  }`;
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

export default function AddCollectionCardScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const auth = useAuth() as AuthState;
  const token = getAuthToken(auth);
  const { colors, displayCurrency } = useThemeManager();
  const { locale, t } = useI18n();
  const [itemType, setItemType] = useState<SearchItemType>("card");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchCandidate | null>(
    null,
  );
  const [price, setPrice] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  function resetResults() {
    setSelectedItem(null);
    setCandidates([]);
    setPrice("");
    setMessage(null);
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
    setPrice("0");
    setMessage(null);
  }

  async function search() {
    if (!token || !query.trim()) {
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setMessage(null);
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
      setMessage(
        nextCandidates.length
          ? itemType === "box"
            ? t("collections.chooseExactBox")
            : t("collections.chooseExactCard")
          : itemType === "box"
            ? t("collections.noMatchingBoxes")
            : t("collections.noMatchingCards"),
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : t("collections.searchFailed"),
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
      setMessage(
        itemType === "box"
          ? t("collections.boxMissingId")
          : t("collections.cardMissingId"),
      );
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload =
        itemType === "box"
          ? {
              box_id: selectedId,
              display_currency: displayCurrency,
              item_type: "box" as const,
              purchase_price: price.trim() ? Number(price) : undefined,
            }
          : {
              card_id: selectedId,
              display_currency: displayCurrency,
              item_type: "card" as const,
              purchase_price: price.trim() ? Number(price) : undefined,
            };

      await requestJson(`/api/collections/${collectionId}/cards`, token, {
        body: JSON.stringify(payload),
        method: "POST",
      });
      router.replace(`/collections/${collectionId}`);
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : itemType === "box"
            ? t("collections.couldNotAddBox")
            : t("collections.couldNotAddCard"),
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
                  {selectedImage ? (
                    <Image
                      source={{ uri: selectedImage }}
                      style={
                        itemType === "box"
                          ? styles.selectedBoxThumbnail
                          : styles.selectedThumbnail
                      }
                    />
                  ) : (
                    <View
                      style={[
                        itemType === "box"
                          ? styles.selectedBoxThumbnail
                          : styles.selectedThumbnail,
                        styles.thumbnailFallback,
                        { backgroundColor: colors.surfaceMuted },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          itemType === "box" ? "package-variant" : "cards-outline"
                        }
                        color={colors.textSecondary}
                        size={24}
                      />
                    </View>
                  )}
                  <View style={styles.selectedDetails}>
                    <Text style={[styles.cardName, { color: colors.textPrimary }]}>
                      {candidateName(selectedItem) ??
                        (itemType === "box"
                          ? t("collections.unknownBox")
                          : t("collections.unknownCard"))}
                    </Text>
                    <Text
                      style={[styles.mutedText, { color: colors.textSecondary }]}
                    >
                      {itemType === "box"
                        ? boxMetaLine(selectedItem, t("collections.boosterBox"))
                        : cardMetaLine(selectedItem, t("collections.unknown"))}
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
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setPrice}
                  placeholder={t("collections.valuePlaceholder")}
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
                style={[styles.messageText, { color: colors.textSecondary }]}
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
              {image ? (
                <Image
                  source={{ uri: image }}
                  style={itemType === "box" ? styles.boxThumbnail : styles.thumbnail}
                />
              ) : (
                <View
                  style={[
                    itemType === "box" ? styles.boxThumbnail : styles.thumbnail,
                    styles.thumbnailFallback,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={itemType === "box" ? "package-variant" : "cards-outline"}
                    color={colors.textSecondary}
                    size={24}
                  />
                </View>
              )}
              <View style={styles.resultText}>
                <Text style={[styles.cardName, { color: colors.textPrimary }]}>
                  {candidateName(item) ??
                    (itemType === "box"
                      ? t("collections.unknownBox")
                      : t("collections.unknownCard"))}
                </Text>
                <Text
                  style={[styles.mutedText, { color: colors.textSecondary }]}
                >
                  {itemType === "box"
                    ? boxMetaLine(item, t("collections.boosterBox"))
                    : cardMetaLine(item, t("collections.unknown"))}
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
    fontSize: 16,
    fontWeight: "700",
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
