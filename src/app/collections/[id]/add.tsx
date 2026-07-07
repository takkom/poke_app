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
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type AuthState = {
  token?: string | null;
  accessToken?: string | null;
  authToken?: string | null;
};

type SearchCandidate = {
  id?: string;
  canonical_id?: string | null;
  tcgdex_id?: string | null;
  name?: string | null;
  local_id?: string | null;
  card_code?: string | null;
  language?: string | null;
  set_id?: string | null;
  rarity?: string | null;
  image_url?: string | null;
  projected_image_asset_path?: string | null;
  avgPrice?: number | null;
  displayCurrency?: DisplayCurrency | "JPY";
};

type SearchResponse = {
  status: "matched" | "review" | "unresolved" | "manual_override";
  card?: SearchCandidate | null;
  candidates?: SearchCandidate[];
};

function getAuthToken(auth: AuthState): string | null {
  return auth.accessToken ?? auth.authToken ?? auth.token ?? null;
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

function cardIdentity(card: SearchCandidate): string {
  return card.canonical_id ?? card.id ?? card.tcgdex_id ?? "";
}

function cardImage(card: SearchCandidate): string | null {
  const image = card.image_url ?? card.projected_image_asset_path ?? null;
  if (!image || image.startsWith("/")) {
    return null;
  }
  return image;
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
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [selectedCard, setSelectedCard] = useState<SearchCandidate | null>(
    null,
  );
  const [price, setPrice] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedDefaultPrice = useMemo(
    () =>
      typeof selectedCard?.avgPrice === "number"
        ? formatMoney(
            selectedCard.avgPrice,
            selectedCard.displayCurrency ?? displayCurrency,
            locale,
          )
        : null,
    [displayCurrency, locale, selectedCard],
  );

  function selectCard(card: SearchCandidate) {
    setSelectedCard(card);
    setPrice(
      typeof card.avgPrice === "number"
        ? String(Math.floor(card.avgPrice))
        : "",
    );
    setMessage(null);
  }

  async function search() {
    if (!token || !query.trim()) {
      return;
    }

    setSearching(true);
    setMessage(null);
    setSelectedCard(null);
    setCandidates([]);

    try {
      const body = await requestJson<SearchResponse>(
        "/api/resolution/search",
        token,
        {
          body: JSON.stringify({
            display_currency: displayCurrency,
            query: query.trim(),
          }),
          method: "POST",
        },
      );
      const nextCandidates = body.candidates ?? [];

      if (
        (body.status === "matched" || body.status === "manual_override") &&
        body.card
      ) {
        setCandidates([body.card]);
        selectCard(body.card);
        return;
      }

      setCandidates(nextCandidates);
      setMessage(
        nextCandidates.length
          ? t("collections.chooseExactCard")
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

  async function saveCard() {
    if (!token || !collectionId || !selectedCard) {
      return;
    }

    const selectedId = cardIdentity(selectedCard);
    if (!selectedId) {
      setMessage(t("collections.cardMissingId"));
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await requestJson(`/api/collections/${collectionId}/cards`, token, {
        body: JSON.stringify({
          card_id: selectedId,
          display_currency: displayCurrency,
          purchase_price: price.trim() ? Number(price) : undefined,
        }),
        method: "POST",
      });
      router.replace(`/collections/${collectionId}`);
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
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
          {t("collections.addCard")}
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
        keyExtractor={(item, index) => `${cardIdentity(item)}-${index}`}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.primary }]}>
              {t("collections.addCard")}
            </Text>
            <View style={styles.searchRow}>
              <TextInput
                autoCapitalize="none"
                onChangeText={setQuery}
                onSubmitEditing={() => void search()}
                placeholder={t("collections.searchPlaceholder")}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
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

            {selectedCard ? (
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
                  style={[styles.sectionTitle, { color: colors.primary }]}
                >
                  {t("collections.selected")}
                </Text>
                <Text style={[styles.cardName, { color: colors.primary }]}>
                  {selectedCard.name ?? t("collections.unknownCard")}
                </Text>
                <Text
                  style={[styles.mutedText, { color: colors.textSecondary }]}
                >
                  #{cardNumber(selectedCard)} |{" "}
                  {selectedCard.language ?? t("collections.unknown")}
                  {selectedCard.rarity ? ` | ${selectedCard.rarity}` : ""}
                </Text>
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
                  onPress={() => void saveCard()}
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: saving ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>
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
              {t("collections.searchToBegin")}
            </Text>
          )
        }
        renderItem={({ item }) => {
          const selected =
            selectedCard && cardIdentity(selectedCard) === cardIdentity(item);
          const image = cardImage(item);
          return (
            <Pressable
              onPress={() => selectCard(item)}
              style={[
                styles.resultRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.thumbnail} />
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
              <View style={styles.resultText}>
                <Text style={[styles.cardName, { color: colors.primary }]}>
                  {item.name ?? t("collections.unknownCard")}
                </Text>
                <Text
                  style={[styles.mutedText, { color: colors.textSecondary }]}
                >
                  #{cardNumber(item)} |{" "}
                  {item.language ?? t("collections.unknown")}
                  {item.rarity ? ` | ${item.rarity}` : ""}
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
  thumbnailFallback: {
    alignItems: "center",
    borderRadius: 6,
    height: 70,
    justifyContent: "center",
    width: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
});
