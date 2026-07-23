import { CardListImage } from '@/components/CardListImage';
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';
import { XMON_API_URL } from '@/config';
import { useThemeManager } from '@/hooks/useThemeManager';
import { useI18n } from '@/i18n';
import { searchCard, searchBox, type BoosterBoxBlueprint } from '@/services/cardService';
import { CardPricing, PokemonCard } from '@/types/card';
import { getDisplayCardName } from '@/utils/displayNames';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TcgDexCard = {
  id: string;
  name: string;
  localId?: string;
  image?: string;
  rarity?: string;
  variants?: {
    firstEdition?: boolean;
    holo?: boolean;
    normal?: boolean;
    reverse?: boolean;
    wPromo?: boolean;
  };
  pricing?: CardPricing;
  set?: {
    id?: string;
    name?: string;
    cardCount?: {
      official?: number;
      total?: number;
    };
  };
  [key: string]: unknown;
};

type TcgDexLanguage = 'en' | 'ja' | 'ko';

const tcgDexLanguageOptions: Array<{ label: string; value: TcgDexLanguage }> = [
  { label: 'EN', value: 'en' },
  { label: 'JP', value: 'ja' },
  { label: 'KOR', value: 'ko' },
];

function normalizeImageUrl(image?: string | null): string | undefined {
  if (!image || image.startsWith('/')) {
    return undefined;
  }

  if (/\.(png|jpg|jpeg|webp)$/i.test(image)) {
    return image;
  }

  return `${image}/low.webp`;
}

function formatSalesCount(value: number | null | undefined, locale: string): string {
  return (value ?? 0).toLocaleString(locale);
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

async function fetchTcgDexCards(
  params: URLSearchParams,
  language: TcgDexLanguage,
): Promise<TcgDexCard[]> {
  const response = await fetch(`https://api.tcgdex.net/v2/${language}/cards?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`TCGdex search failed with ${response.status}`);
  }

  const data = (await response.json()) as TcgDexCard[];
  return Array.isArray(data) ? data : [];
}

async function fetchTcgDexCard(
  id: string,
  language: TcgDexLanguage,
): Promise<TcgDexCard | null> {
  const response = await fetch(`https://api.tcgdex.net/v2/${language}/cards/${encodeURIComponent(id)}`);
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as TcgDexCard;
}

async function enrichTcgDexCards(
  cards: TcgDexCard[],
  language: TcgDexLanguage,
): Promise<TcgDexCard[]> {
  const detailedCards = await Promise.all(
    cards.slice(0, 24).map(async (card) => (await fetchTcgDexCard(card.id, language)) ?? card),
  );

  return detailedCards;
}

function normalizeCardNumber(value?: string | null): string {
  const fallback = value ?? '';
  return String(Number(fallback) || fallback).trim().toLowerCase();
}

function formatCardNumber(card: TcgDexCard): string {
  if (!card.localId) {
    return card.id;
  }

  const printedTotal = card.set?.cardCount?.official ?? card.set?.cardCount?.total;
  if (!printedTotal) {
    return card.localId;
  }

  const width = Math.max(String(printedTotal).length, 3);
  const localNumber = /^\d+$/.test(card.localId) ? card.localId.padStart(width, '0') : card.localId;
  const totalNumber = String(printedTotal).padStart(width, '0');
  return `${localNumber}/${totalNumber}`;
}

function formatCardFinish(card: TcgDexCard): string {
  const variants = card.variants;
  if (variants) {
    const labels = [
      variants.normal ? 'Normal' : null,
      variants.holo ? 'Holo' : null,
      variants.reverse ? 'Reverse Holo' : null,
      variants.firstEdition ? 'First Edition' : null,
      variants.wPromo ? 'Promo' : null,
    ].filter(Boolean);

    if (labels.length) {
      return labels.join(', ');
    }
  }

  return card.rarity ?? 'Normal';
}

function formatCardMeta(card: TcgDexCard): string {
  return [formatCardNumber(card), card.set?.name, formatCardFinish(card)].filter(Boolean).join(' | ');
}

async function searchTcgDexTest(
  query: string,
  language: TcgDexLanguage,
): Promise<TcgDexCard[]> {
  const trimmed = query.trim();
  const fractionMatch = trimmed.match(/\b(\d{1,4})\s*[/-]\s*(\d{1,4})\b/);
  const numberToken = fractionMatch?.[1] ?? trimmed.match(/\b\d{1,4}\b/)?.[0];
  const nameText = trimmed
    .replace(/\b\d{1,4}\s*[/-]\s*\d{1,4}\b/g, '')
    .replace(/\b\d{1,4}\b/g, '')
    .trim();

  const params = new URLSearchParams();
  if (nameText) {
    params.set('name', nameText);
  } else if (numberToken) {
    params.set('localId', String(Number(numberToken)));
  } else {
    params.set('name', trimmed);
  }

  const cards = await fetchTcgDexCards(params, language);
  if (!numberToken) {
    return enrichTcgDexCards(cards, language);
  }

  const normalizedNumber = normalizeCardNumber(numberToken);
  const printedTotal = fractionMatch ? Number(fractionMatch[2]) : null;

  const localIdMatches = cards.filter((card) => {
    const localIdMatches = normalizeCardNumber(card.localId) === normalizedNumber;
    if (!localIdMatches) {
      return false;
    }

    if (!printedTotal) {
      return true;
    }

    const official = card.set?.cardCount?.official;
    const total = card.set?.cardCount?.total;
    return official === printedTotal || total === printedTotal;
  });

  const detailedCards = await enrichTcgDexCards(localIdMatches, language);
  if (!printedTotal) {
    return detailedCards;
  }

  return detailedCards.filter((card) => {
    const official = card.set?.cardCount?.official;
    const total = card.set?.cardCount?.total;
    return official === printedTotal || total === printedTotal;
  });
}

function TcgDexTestSearch() {
  const { colors } = useThemeManager();
  const [testQuery, setTestQuery] = useState('');
  const [testLanguage, setTestLanguage] = useState<TcgDexLanguage>('en');
  const [testResults, setTestResults] = useState<TcgDexCard[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<TcgDexCard | null>(null);
  const hasTestQuery = Boolean(testQuery.trim());

  async function performTestSearch() {
    Keyboard.dismiss();
    const currentQuery = testQuery.trim();
    if (!currentQuery) {
      setTestResults([]);
      setTestError(null);
      return;
    }

    setTestLoading(true);
    setTestError(null);

    try {
      const nextResults = await searchTcgDexTest(currentQuery, testLanguage);
      setTestResults(nextResults);
    } catch (searchError) {
      console.error(searchError);
      setTestError('TCGdex test search failed.');
      setTestResults([]);
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <View style={[styles.testPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(selectedCard)}
        onRequestClose={() => setSelectedCard(null)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: colors.overlayStrong }]}
          onPress={() => setSelectedCard(null)}
        >
          <Pressable
            style={[
              styles.testDetailModal,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView
              contentContainerStyle={styles.testDetailContent}
              persistentScrollbar
              style={styles.testDetailScroll}
            >
              {selectedCard ? (
                <>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    {selectedCard.name}
                  </Text>
                  <Text style={[styles.testDetailMeta, { color: colors.textSecondary }]}>
                    {formatCardMeta(selectedCard)}
                  </Text>
                  <Image
                    source={normalizeImageUrl(selectedCard.image) ?? 'https://images.tcgdex.net/placeholder.png'}
                    style={[styles.testDetailImage, { backgroundColor: colors.surfaceMuted }]}
                    contentFit="contain"
                    transition={120}
                  />
                  <Text style={[styles.testJson, { color: colors.textPrimary }]}>
                    {JSON.stringify(selectedCard, null, 2)}
                  </Text>
                </>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setSelectedCard(null)}
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.closeButtonText, { color: colors.onPrimary }]}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      <Text style={[styles.testTitle, { color: colors.primary }]}>TCGdex test search</Text>
      <View style={styles.languageSelector}>
        {tcgDexLanguageOptions.map((option) => {
          const selected = option.value === testLanguage;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => {
                setTestLanguage(option.value);
                setTestResults([]);
                setTestError(null);
              }}
              style={[
                styles.languageButton,
                {
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  { color: selected ? colors.onPrimary : colors.textSecondary },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.testSearchRow}>
        <TextInput
          value={testQuery}
          onChangeText={setTestQuery}
          onSubmitEditing={performTestSearch}
          placeholder="Search card name or number"
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
          onPress={performTestSearch}
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.submitText, { color: colors.onPrimary }]}>Submit</Text>
        </TouchableOpacity>
      </View>

      {testLoading ? (
        <View style={styles.testStateRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.testStateText, { color: colors.textSecondary }]}>Searching TCGdex</Text>
        </View>
      ) : testError ? (
        <Text style={[styles.testStateText, { color: colors.error }]}>{testError}</Text>
      ) : hasTestQuery && testResults.length === 0 ? (
        <Text style={[styles.testStateText, { color: colors.textSecondary }]}>No TCGdex results</Text>
      ) : testResults.length ? (
        <View style={styles.testResults}>
          {testResults.slice(0, 12).map((item) => {
            const image = normalizeImageUrl(item.image);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedCard(item)}
                style={[styles.testResultRow, { borderColor: colors.border }]}
              >
                <Image
                  source={image ?? 'https://images.tcgdex.net/placeholder.png'}
                  style={[styles.testResultImage, { backgroundColor: colors.surfaceMuted }]}
                  contentFit="cover"
                  transition={120}
                />
                <View style={styles.testResultBody}>
                  <Text style={[styles.testResultName, { color: colors.primary }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.testResultMeta, { color: colors.textSecondary }]}>
                    {formatCardMeta(item)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {testResults.length > 12 ? (
            <Text style={[styles.testStateText, { color: colors.textSecondary }]}>
              Showing 12 of {testResults.length} results
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type SearchItemType = 'card' | 'box';

export default function SearchTab() {
  const router = useRouter();
  const { colors, searchMode, locale, displayCurrency } = useThemeManager();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [itemType, setItemType] = useState<SearchItemType>('card');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [boxResults, setBoxResults] = useState<BoosterBoxBlueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const hasQuery = Boolean(query.trim());

  function changeItemType(next: SearchItemType) {
    if (next === itemType) return;
    setItemType(next);
    setResults([]);
    setBoxResults([]);
    setError(null);
  }

  async function performSearch() {
    Keyboard.dismiss();
    const currentQuery = query.trim();
    if (!currentQuery) {
      setResults([]);
      setBoxResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (searchMode === 'local' && itemType === 'box') {
        const nextBoxResults = await searchBox(currentQuery, {
          currency: displayCurrency,
          locale,
        });
        setBoxResults(nextBoxResults);
        setResults([]);
      } else {
        const nextResults =
          searchMode === 'local'
            ? await searchCard(currentQuery, {
                currency: displayCurrency,
                locale,
              })
            : await searchTcgDex(currentQuery);
        setResults(nextResults);
        setBoxResults([]);
      }
    } catch (searchError) {
      console.error(searchError);
      setError(t('search.failed'));
      setResults([]);
      setBoxResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>{t('search.title')}</Text>
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
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: colors.overlayStrong }]}
          onPress={() => setInfoVisible(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
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
              <Text style={[styles.closeButtonText, { color: colors.onPrimary }]}>{t('search.close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {searchMode === 'local' ? (
        <View
          style={[
            styles.typeToggle,
            { backgroundColor: colors.surfaceAlternate, borderColor: colors.border },
          ]}
        >
          {(['card', 'box'] as const).map((type) => {
            const active = itemType === type;
            return (
              <TouchableOpacity
                key={type}
                onPress={() => changeItemType(type)}
                style={[
                  styles.typeToggleButton,
                  active ? { backgroundColor: colors.primary } : null,
                ]}
              >
                <Text
                  style={[
                    styles.typeToggleText,
                    { color: active ? colors.onPrimary : colors.textSecondary },
                  ]}
                >
                  {type === 'box' ? t('collections.itemTypeBox') : t('collections.itemTypeCard')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={performSearch}
          placeholder={
            searchMode === 'local' && itemType === 'box'
              ? t('collections.searchBoxPlaceholder')
              : t('search.placeholder')
          }
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
          <Text style={[styles.submitText, { color: colors.onPrimary }]}>{t('search.submit')}</Text>
        </TouchableOpacity>
      </View>

      {__DEV__ ? <TcgDexTestSearch /> : null}

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
        ) : hasQuery && searchMode === 'local' && itemType === 'box' && boxResults.length === 0 && !loading ? (
          <View style={styles.state}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>{t('collections.noMatchingBoxes')}</Text>
          </View>
        ) : hasQuery && searchMode === 'local' && itemType === 'box' && boxResults.length > 0 ? (
          <FlatList
            data={boxResults}
            keyExtractor={(item, i) => item.canonical_id ?? item.id ?? String(i)}
            contentContainerStyle={styles.listContent}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            renderItem={({ item }) => {
              const rawUrl = item.image_url?.trim() || undefined;
              const image = rawUrl
                ? rawUrl.startsWith('/') ? `${XMON_API_URL}${rawUrl}` : rawUrl
                : undefined;
              const name = item.display_name ?? item.name ?? t('collections.unknownBox');
              const meta = [item.set_name, item.set_code].filter(Boolean).join(' · ');
              const boxNavId = item.canonical_id ?? item.id;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.cardRow,
                    { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
                  ]}
                  onPress={boxNavId ? () => router.push(`/box/${boxNavId}`) : undefined}
                >
                  <CardListImage
                    uri={image}
                    recyclingKey={boxNavId ?? name}
                    style={styles.cardImage}
                    backgroundColor={colors.surfaceMuted}
                    iconColor={colors.textSecondary}
                    fallbackIcon="package-variant"
                  />
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardName, { color: colors.primary }]} numberOfLines={2}>
                      {name}
                    </Text>
                    {meta ? (
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{meta}</Text>
                    ) : null}
                    <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{t('collections.boosterBox')}</Text>
                    {typeof item.avgPrice === 'number' ? (
                      <Text style={[styles.rarity, { color: colors.primary }]}>
                        {new Intl.NumberFormat(locale, {
                          currency: item.displayCurrency ?? 'USD',
                          maximumFractionDigits: item.displayCurrency === 'KRW' ? 0 : 2,
                          style: 'currency',
                        }).format(item.avgPrice)}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        ) : hasQuery && results.length === 0 && !loading ? (
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
            windowSize={7}
            renderItem={({ item }) => {
              const displayName = getDisplayCardName(item, locale);
              const badges = [
                item.hasKream
                  ? {
                      key: 'kream',
                      label: 'KREAM',
                      count: formatSalesCount(item.kreamSales, locale),
                      color: colors.marketplaces.kream,
                    }
                  : null,
                item.hasEbay
                  ? {
                      key: 'ebay',
                      label: 'eBay',
                      count: formatSalesCount(item.ebaySales, locale),
                      color: colors.marketplaces.ebay,
                    }
                  : null,
                item.hasSnkrdunk
                  ? {
                      key: 'snkrdunk',
                      label: 'SNK',
                      count: formatSalesCount(item.snkrdunkSales, locale),
                      color: colors.marketplaces.snkrdunk,
                    }
                  : null,
                item.hasTcgplayer
                  ? { key: 'tcgplayer', label: 'TCGplayer', count: null, color: colors.primary }
                  : null,
                item.hasCardmarket
                  ? { key: 'cardmarket', label: 'Cardmarket', count: null, color: colors.success }
                  : null,
              ].filter(Boolean) as Array<{
                key: string;
                label: string;
                count: string | null;
                color: string;
              }>;

              return (
                <TouchableOpacity
                  style={[
                    styles.cardRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => router.push(`/card/${item.id}`)}
                >
                <CardListImage
                  uri={item.image ?? item.images?.small}
                  recyclingKey={item.id}
                  style={styles.cardImage}
                  backgroundColor={colors.surfaceMuted}
                  iconColor={colors.textSecondary}
                />
                <View style={styles.cardBody}>
                  <Text style={[styles.cardName, { color: colors.primary }]} numberOfLines={2}>
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
                  {badges.length ? (
                    <View style={styles.marketBadgeRow}>
                      {badges.map((badge) => (
                        <View
                          key={badge.key}
                          style={[
                            styles.marketBadge,
                            {
                              borderColor: badge.color,
                              backgroundColor: `${badge.color}22`,
                            },
                          ]}
                        >
                          <Text style={[styles.marketBadgeText, { color: badge.color }]}>
                            {badge.label}
                          </Text>
                          {badge.count ? (
                            <Text style={[styles.marketBadgeCount, { color: badge.color }]}>
                              {badge.count}
                            </Text>
                          ) : null}
                        </View>
                      ))}
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
    marginTop: 10,
    padding: 10,
  },
  typeToggle: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 4,
  },
  typeToggleButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  typeToggleText: {
    fontSize: 14,
    fontWeight: '700',
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
  testDetailModal: {
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: '92%',
    maxWidth: 560,
    padding: 14,
    width: '100%',
  },
  testDetailContent: {
    gap: 12,
    paddingBottom: 14,
  },
  testDetailScroll: {
    flexShrink: 1,
  },
  testDetailImage: {
    alignSelf: 'center',
    aspectRatio: 5 / 7,
    borderRadius: 8,
    maxWidth: 300,
    width: '100%',
  },
  testDetailMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  testJson: {
    borderRadius: 8,
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
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
    fontSize: 13,
    fontWeight: '800',
  },
  testPanel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
  },
  testTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  testSearchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  languageSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  languageButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },
  testStateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  testStateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  testResults: {
    gap: 8,
  },
  testResultRow: {
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  testResultImage: {
    borderRadius: 6,
    height: 64,
    width: 46,
  },
  testResultBody: {
    flex: 1,
    justifyContent: 'center',
  },
  testResultName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  testResultMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
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
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  marketBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  marketBadgeCount: {
    fontSize: 10,
    fontWeight: '900',
  },
});
