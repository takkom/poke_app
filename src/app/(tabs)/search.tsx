import {
  CardLanguageToggle,
  cardLanguageFromAppLocale,
  type CardLanguage,
} from '@/components/CardLanguageToggle';
import { CardListImage } from '@/components/CardListImage';
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';
import { XMON_API_URL } from '@/config';
import { useThemeManager } from '@/hooks/useThemeManager';
import { useI18n } from '@/i18n';
import { searchCard, searchBox, type BoosterBoxBlueprint } from '@/services/cardService';
import { PokemonCard } from '@/types/card';
import { getDisplayCardName } from '@/utils/displayNames';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatSalesCount(value: number | null | undefined, locale: string): string {
  return (value ?? 0).toLocaleString(locale);
}

type SearchItemType = 'card' | 'box';

export default function SearchTab() {
  const router = useRouter();
  const { colors, locale, displayCurrency } = useThemeManager();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [cardLanguage, setCardLanguage] = useState<CardLanguage>(() =>
    cardLanguageFromAppLocale(locale),
  );
  const [cardLanguageTouched, setCardLanguageTouched] = useState(false);
  const [itemType, setItemType] = useState<SearchItemType>('card');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [boxResults, setBoxResults] = useState<BoosterBoxBlueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasQuery = Boolean(query.trim());
  const resultCount = itemType === 'box' ? boxResults.length : results.length;

  useEffect(() => {
    if (cardLanguageTouched) {
      return;
    }
    setCardLanguage(cardLanguageFromAppLocale(locale));
  }, [cardLanguageTouched, locale]);

  function changeItemType(next: SearchItemType) {
    if (next === itemType) return;
    setItemType(next);
    setResults([]);
    setBoxResults([]);
    setError(null);
  }

  function changeCardLanguage(next: CardLanguage) {
    if (next === cardLanguage) return;
    setCardLanguageTouched(true);
    setCardLanguage(next);
    setResults([]);
    setBoxResults([]);
    setError(null);
    if (query.trim()) {
      void performSearch(next);
    }
  }

  async function performSearch(languageOverride?: CardLanguage) {
    Keyboard.dismiss();
    const currentQuery = query.trim();
    const language = languageOverride ?? cardLanguage;
    if (!currentQuery) {
      setResults([]);
      setBoxResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (itemType === 'box') {
        const nextBoxResults = await searchBox(currentQuery, {
          currency: displayCurrency,
          language,
          locale,
        });
        setBoxResults(nextBoxResults);
        setResults([]);
      } else {
        const nextResults = await searchCard(currentQuery, {
          currency: displayCurrency,
          language,
          locale,
        });
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
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>{t('search.title')}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t('search.subtitle')}
        </Text>
      </View>

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

      <View style={styles.languageToggleWrap}>
        <CardLanguageToggle value={cardLanguage} onChange={changeCardLanguage} />
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={performSearch}
          placeholder={
            itemType === 'box'
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

      <View style={styles.statusRow}>
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {hasQuery ? t('search.results', { count: resultCount }) : ''}
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
        ) : hasQuery && itemType === 'box' && boxResults.length === 0 && !loading ? (
          <View style={styles.state}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>{t('collections.noMatchingBoxes')}</Text>
          </View>
        ) : hasQuery && itemType === 'box' && boxResults.length > 0 ? (
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
    marginTop: 10,
    padding: 4,
  },
  languageToggleWrap: {
    marginHorizontal: 16,
    marginTop: 10,
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
    paddingHorizontal: 16,
    paddingTop: 4,
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
    paddingBottom: 8,
    paddingHorizontal: 12,
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
