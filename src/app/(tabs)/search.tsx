import { useThemeManager } from '@/hooks/useThemeManager';
import { useI18n } from '@/i18n';
import { LOCAL_API_BASE_URL } from '@/services/cardService';
import { CardPricing, PokemonCard } from '@/types/card';
import { getDisplayCardName } from '@/utils/displayNames';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ResolutionCardBlueprint = {
  id?: string;
  tcgdex_id?: string | null;
  name?: string | null;
  local_id?: string | null;
  card_code?: string | null;
  rarity?: string | null;
  image_url?: string | null;
  projected_image_asset_path?: string | null;
  set_id?: string | null;
  hasEbay?: boolean;
  hasKream?: boolean;
  hasSnkrdunk?: boolean;
  hasTcgplayer?: boolean;
  hasCardmarket?: boolean;
};

type ResolutionSearchResponse = {
  tcgdex_id?: string | null;
  card?: ResolutionCardBlueprint | null;
  candidates?: ResolutionCardBlueprint[];
};

type TcgDexCard = {
  id: string;
  name: string;
  localId?: string;
  image?: string;
  rarity?: string;
  pricing?: CardPricing;
  set?: {
    id?: string;
    name?: string;
    cardCount?: {
      official?: number;
      total?: number;
    };
  };
};

function normalizeImageUrl(image?: string | null): string | undefined {
  if (!image || image.startsWith('/')) {
    return undefined;
  }

  if (/\.(png|jpg|jpeg|webp)$/i.test(image)) {
    return image;
  }

  return `${image}/low.webp`;
}

function normalizeDisplayNumber(cardCode?: string | null, localId?: string | null): string {
  const slashCode = cardCode?.match(/\b([A-Z]*\d+|SV\d+)\s*\/\s*(\d+)\b/i);
  if (slashCode) {
    return `${slashCode[1].toUpperCase()}/${slashCode[2]}`;
  }

  return localId ?? cardCode ?? '';
}

function mapResolutionCard(card: ResolutionCardBlueprint, fallbackId?: string | null): PokemonCard {
  const tcgdexId = fallbackId ?? card.tcgdex_id ?? card.id ?? '';
  const image = normalizeImageUrl(card.image_url ?? card.projected_image_asset_path);

  return {
    id: tcgdexId,
    name: card.name ?? tcgdexId,
    number: normalizeDisplayNumber(card.card_code, card.local_id),
    rarity: card.rarity ?? undefined,
    image,
    images: image ? { small: image, large: image } : undefined,
    set: card.set_id ? { id: card.set_id, name: card.set_id } : undefined,
    hasEbay: Boolean(card.hasEbay),
    hasKream: Boolean(card.hasKream),
    hasSnkrdunk: Boolean(card.hasSnkrdunk),
    hasTcgplayer: Boolean(card.hasTcgplayer),
    hasCardmarket: Boolean(card.hasCardmarket),
  };
}

function mapTcgDexCard(card: TcgDexCard): PokemonCard {
  const image = normalizeImageUrl(card.image);

  return {
    id: card.id,
    name: card.name,
    number: card.localId ?? '',
    rarity: card.rarity,
    pricing: card.pricing,
    image,
    images: image ? { small: image, large: image } : undefined,
    set: card.set,
    hasTcgplayer: Boolean(card.pricing?.tcgplayer),
    hasCardmarket: Boolean(card.pricing?.cardmarket),
  };
}

async function searchLocal(query: string): Promise<PokemonCard[]> {
  const response = await fetch(`${LOCAL_API_BASE_URL}/api/resolution/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Local search failed with ${response.status}`);
  }

  const data = (await response.json()) as ResolutionSearchResponse;
  const blueprints = data.card ? [data.card] : data.candidates ?? [];
  return blueprints.map((card) => mapResolutionCard(card, data.tcgdex_id));
}

async function searchTcgDex(query: string): Promise<PokemonCard[]> {
  const trimmed = query.trim();
  const params = new URLSearchParams();
  const fractionMatch = trimmed.match(/\b(\d{1,4})\s*[/-]\s*(\d{1,4})\b/);
  const localId = fractionMatch?.[1] ?? trimmed.match(/\b\d{1,4}\b/)?.[0];

  if (fractionMatch) {
    params.set('localId', String(Number(fractionMatch[1])));
  } else if (localId && trimmed.replace(/[#/]/g, '').trim() === localId) {
    params.set('localId', String(Number(localId)));
  } else {
    params.set('name', trimmed);
  }

  const response = await fetch(`https://api.tcgdex.net/v2/en/cards?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`TCGdex search failed with ${response.status}`);
  }

  const data = (await response.json()) as TcgDexCard[];
  if (!Array.isArray(data)) {
    return [];
  }

  if (fractionMatch) {
    const printedTotal = Number(fractionMatch[2]);
    return data
      .filter((card) => {
        const official = card.set?.cardCount?.official;
        const total = card.set?.cardCount?.total;
        return official === printedTotal || total === printedTotal;
      })
      .map(mapTcgDexCard);
  }

  return data.map(mapTcgDexCard);
}

export default function SearchTab() {
  const router = useRouter();
  const { colors, searchMode, locale } = useThemeManager();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const hasQuery = Boolean(query.trim());

  async function performSearch() {
    const currentQuery = query.trim();
    if (!currentQuery) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextResults =
        searchMode === 'local'
          ? await searchLocal(currentQuery)
          : await searchTcgDex(currentQuery);
      setResults(nextResults);
    } catch (searchError) {
      console.error(searchError);
      setError(t('search.failed'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('search.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {t('search.subtitle')}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel={t('search.infoLabel')}
          onPress={() => setInfoVisible(true)}
          style={[styles.infoButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <Modal
        allowSwipeDismissal
        animationType="fade"
        transparent
        visible={infoVisible}
        onRequestClose={() => setInfoVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoVisible(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('search.pricingBadges')}</Text>
            {[
              ['eBay', t('search.ebayDescription'), colors.marketplaces.ebay],
              ['KREAM', t('search.kreamDescription'), colors.marketplaces.kream],
              ['SNKRDUNK', t('search.snkrdunkDescription'), colors.marketplaces.snkrdunk],
              ['TCGplayer', t('search.tcgplayerDescription'), colors.primary],
              ['Cardmarket', t('search.cardmarketDescription'), colors.success],
            ].map(([label, description, color]) => (
              <View key={label} style={styles.legendRow}>
                <View style={[styles.legendBadge, { borderColor: color, backgroundColor: `${color}22` }]}>
                  <Text style={[styles.legendBadgeText, { color }]}>{label}</Text>
                </View>
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                  {description}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setInfoVisible(false)}
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.closeButtonText}>{t('search.close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={performSearch}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
        <TouchableOpacity
          onPress={performSearch}
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.submitText}>{t('search.submit')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {searchMode === 'local' ? t('search.localBackend') : t('search.externalTcgdex')}
        </Text>
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {hasQuery ? t('search.results', { count: results.length }) : ''}
        </Text>
      </View>

      <View style={styles.resultsArea}>
        {hasQuery && loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>{t('search.searching')}</Text>
          </View>
        ) : hasQuery && error ? (
          <View style={styles.state}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : hasQuery && results.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>{t('search.noCards')}</Text>
          </View>
        ) : !hasQuery ? (
          <View style={styles.state}>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>
              {t('search.empty')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            extraData={locale}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            removeClippedSubviews
            windowSize={7}
            renderItem={({ item }) => {
              const displayName = getDisplayCardName(item, locale);

              return (
                <TouchableOpacity
                  style={[
                    styles.cardRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => router.push(`/card/${item.id}`)}
                >
                <Image
                  source={
                    item.image ??
                    item.images?.small ??
                    'https://images.tcgdex.net/placeholder.png'
                  }
                  style={[styles.cardImage, { backgroundColor: colors.surfaceMuted }]}
                  contentFit="cover"
                  transition={120}
                />
                <View style={styles.cardBody}>
                  <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={2}>
                    {displayName}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {item.number ? `#${item.number}` : item.id}
                  </Text>
                  {item.set?.name ? (
                    <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.set.name}
                    </Text>
                  ) : null}
                  {item.rarity ? (
                    <Text style={[styles.rarity, { color: colors.primary }]}>{item.rarity}</Text>
                  ) : null}
                  {item.hasEbay ||
                  item.hasKream ||
                  item.hasSnkrdunk ||
                  item.hasTcgplayer ||
                  item.hasCardmarket ? (
                    <View style={styles.marketBadgeRow}>
                      {item.hasEbay ? (
                        <View
                          style={[
                            styles.marketBadge,
                            {
                              borderColor: colors.marketplaces.ebay,
                              backgroundColor: `${colors.marketplaces.ebay}22`,
                            },
                          ]}
                        >
                          <Text style={[styles.marketBadgeText, { color: colors.marketplaces.ebay }]}>
                            eBay
                          </Text>
                        </View>
                      ) : null}
                      {item.hasKream ? (
                        <View
                          style={[
                            styles.marketBadge,
                            {
                              borderColor: colors.marketplaces.kream,
                              backgroundColor: `${colors.marketplaces.kream}22`,
                            },
                          ]}
                        >
                          <Text style={[styles.marketBadgeText, { color: colors.marketplaces.kream }]}>
                            KREAM
                          </Text>
                        </View>
                      ) : null}
                      {item.hasSnkrdunk ? (
                        <View
                          style={[
                            styles.marketBadge,
                            {
                              borderColor: colors.marketplaces.snkrdunk,
                              backgroundColor: `${colors.marketplaces.snkrdunk}22`,
                            },
                          ]}
                        >
                          <Text style={[styles.marketBadgeText, { color: colors.marketplaces.snkrdunk }]}>
                            SNKRDUNK
                          </Text>
                        </View>
                      ) : null}
                      {item.hasTcgplayer ? (
                        <View
                          style={[
                            styles.marketBadge,
                            {
                              borderColor: colors.primary,
                              backgroundColor: `${colors.primary}22`,
                            },
                          ]}
                        >
                          <Text style={[styles.marketBadgeText, { color: colors.primary }]}>
                            TCGplayer
                          </Text>
                        </View>
                      ) : null}
                      {item.hasCardmarket ? (
                        <View
                          style={[
                            styles.marketBadge,
                            {
                              borderColor: colors.success,
                              backgroundColor: `${colors.success}22`,
                            },
                          ]}
                        >
                          <Text style={[styles.marketBadgeText, { color: colors.success }]}>
                            Cardmarket
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  infoButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 18,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  legendBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 86,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  legendBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  legendText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 4,
    minHeight: 42,
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultsArea: {
    flex: 1,
    minHeight: 1,
  },
  state: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 44,
  },
  listContent: {
    paddingBottom: 18,
    paddingHorizontal: 12,
  },
  listHeader: {
    gap: 3,
    paddingBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  listSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  cardRow: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    minHeight: 126,
    overflow: 'hidden',
    padding: 10,
  },
  rankBadge: {
    alignItems: 'center',
    borderRadius: 6,
    height: 28,
    justifyContent: 'center',
    left: 8,
    position: 'absolute',
    top: 8,
    width: 32,
    zIndex: 2,
  },
  rankText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  cardImage: {
    borderRadius: 6,
    height: 108,
    width: 78,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  rarity: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  salesSummary: {
    gap: 2,
    marginTop: 4,
  },
  salesTotal: {
    fontSize: 13,
    fontWeight: '900',
  },
  salesBreakdown: {
    fontSize: 11,
    fontWeight: '700',
  },
  marketBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  marketBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  marketBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
