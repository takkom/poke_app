import { useThemeManager } from '@/hooks/useThemeManager';
import { PokemonCard } from '@/types/card';
import { getDisplayCardName } from '@/utils/displayNames';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CardListItemProps {
  card: PokemonCard;
  onPress: () => void;
}

function formatSalesCount(value: number | null | undefined, locale: string): string {
  return (value ?? 0).toLocaleString(locale);
}

export const CardListItem: React.FC<CardListItemProps> = ({ card, onPress }) => {
  const { colors, locale } = useThemeManager();
  const [imageFailed, setImageFailed] = React.useState(false);
  const imageUrl =
    card.image || card.images?.small || 'https://images.pokemontcg.io/base1/1/high.png';
  const displayName = getDisplayCardName(card, locale);
  const hasValidImage = Boolean(
    imageUrl && !imageFailed && !imageUrl.includes('placeholder.png'),
  );

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);
  const badges = [
    card.hasKream
      ? {
          key: 'kream',
          label: 'KREAM',
          count: formatSalesCount(card.kreamSales, locale),
          color: colors.marketplaces.kream,
        }
      : null,
    card.hasEbay
      ? {
          key: 'ebay',
          label: 'eBay',
          count: formatSalesCount(card.ebaySales, locale),
          color: colors.marketplaces.ebay,
        }
      : null,
    card.hasSnkrdunk
      ? {
          key: 'snkrdunk',
          label: 'SNK',
          count: formatSalesCount(card.snkrdunkSales, locale),
          color: colors.marketplaces.snkrdunk,
        }
      : null,
    card.hasTcgplayer ? { key: 'tcgplayer', label: 'TCGplayer', count: null, color: colors.primary } : null,
    card.hasCardmarket ? { key: 'cardmarket', label: 'Cardmarket', count: null, color: colors.success } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; count: string | null; color: string }>;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
    >
      {hasValidImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={[styles.imageFallback, { backgroundColor: colors.surfaceMuted }]}>
          <MaterialCommunityIcons
            name="cards-outline"
            size={34}
            color={colors.textSecondary}
          />
        </View>
      )}
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.primary }]} numberOfLines={2}>
          {displayName}
        </Text>
        <Text style={[styles.number, { color: colors.textSecondary }]}>#{card.number}</Text>
        {card.set?.name ? (
          <Text style={[styles.set, { color: colors.textMuted }]} numberOfLines={1}>
            {card.set.name}
          </Text>
        ) : null}
        {card.rarity ? (
          <Text style={[styles.rarity, { color: colors.primary }]}>★ {card.rarity}</Text>
        ) : null}
        {badges.length ? (
          <View style={styles.badgeRow}>
            {badges.map((badge) => (
              <View
                key={badge.key}
                style={[
                  styles.marketBadge,
                  { borderColor: badge.color, backgroundColor: `${badge.color}22` },
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
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    flexDirection: 'row',
    marginHorizontal: 12,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  image: {
    height: 140,
    width: 100,
  },
  imageFallback: {
    alignItems: 'center',
    height: 140,
    justifyContent: 'center',
    width: 100,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  number: {
    fontSize: 12,
    marginBottom: 4,
  },
  set: {
    fontSize: 12,
    marginBottom: 4,
  },
  rarity: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeRow: {
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
