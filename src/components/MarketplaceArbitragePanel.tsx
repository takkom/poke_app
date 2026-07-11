import {
  MARKETPLACE_COLUMN_ORDER,
  MARKETPLACE_LIST_LABELS,
} from "@/constants/marketplaces";
import { useThemeManager, type AppLocale } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { AppColors } from "@/theme/colors";
import { MarketplaceKey, PokemonCard } from "@/types/card";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";

const MARKETPLACES = MARKETPLACE_COLUMN_ORDER.map((key) => ({
  key,
  label: MARKETPLACE_LIST_LABELS[key],
}));

function formatMoney(
  value: number | null | undefined,
  currency: "KRW" | "USD" | "JPY",
  locale: AppLocale,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getRelativeColor(
  colors: AppColors,
  value: number | null | undefined,
): string {
  if (typeof value !== "number" || value === 0) {
    return colors.textSecondary;
  }

  return value > 0 ? colors.arbitragePositive : colors.arbitrageNegative;
}

type MarketplaceCellProps = {
  baseline: MarketplaceKey;
  colors: AppColors;
  currency: "KRW" | "USD" | "JPY";
  item: PokemonCard;
  locale: AppLocale;
  marketplace: MarketplaceKey;
  unavailableLabel: string;
};

const MarketplaceCell = memo(function MarketplaceCell({
  baseline,
  colors,
  currency,
  item,
  locale,
  marketplace,
  unavailableLabel,
}: MarketplaceCellProps) {
  const average = item.marketplaceAverages?.[marketplace];
  const isBaseline = baseline === marketplace;
  const relativePercent = average?.relativePercent;

  return (
    <View
      style={[
        styles.marketCell,
        isBaseline ? { backgroundColor: colors.surfaceMuted } : null,
      ]}
    >
      <Text
        style={[styles.marketPrice, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {average?.avgPrice == null
          ? unavailableLabel
          : formatMoney(average.avgPrice, currency, locale)}
      </Text>
      {!isBaseline ? (
        <Text
          style={[
            styles.marketPercent,
            { color: getRelativeColor(colors, relativePercent) },
          ]}
          numberOfLines={1}
        >
          {formatPercent(relativePercent)}
        </Text>
      ) : null}
    </View>
  );
});

type MarketplaceArbitragePanelProps = {
  baseline: MarketplaceKey;
  card: PokemonCard;
  currency: "KRW" | "USD" | "JPY";
  loading?: boolean;
  onBaselineChange: (baseline: MarketplaceKey) => void;
};

export function MarketplaceArbitragePanel({
  baseline,
  card,
  currency,
  loading = false,
  onBaselineChange,
}: MarketplaceArbitragePanelProps) {
  const { colors, locale } = useThemeManager();
  const { t } = useI18n();
  const unavailableLabel = t("home.avgUnavailable");

  const hasAnyAverage = MARKETPLACES.some(
    (marketplace) => card.marketplaceAverages?.[marketplace.key]?.avgPrice != null,
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t("card.marketplaceComparison")}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("card.marketplaceComparisonHint")}
      </Text>

      <View style={styles.headerRow}>
        {MARKETPLACES.map((marketplace) => {
          const isBaseline = baseline === marketplace.key;
          return (
            <Pressable
              key={marketplace.key}
              style={[
                styles.marketHeader,
                isBaseline
                  ? {
                      backgroundColor: `${colors.primary}14`,
                      borderColor: colors.primary,
                      borderWidth: 1,
                    }
                  : {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
              ]}
              onPress={() => onBaselineChange(marketplace.key)}
            >
              <Text
                style={[
                  styles.marketHeaderText,
                  { color: isBaseline ? colors.primary : colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {marketplace.label}
              </Text>
              {isBaseline ? (
                <Text
                  style={[
                    styles.marketHeaderBaseline,
                    { color: colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {t("card.baseline")}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !hasAnyAverage ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t("card.noMarketplaceAverages")}
        </Text>
      ) : (
        <View style={styles.valuesRow}>
          {MARKETPLACES.map((marketplace) => (
            <MarketplaceCell
              key={marketplace.key}
              baseline={baseline}
              colors={colors}
              currency={currency}
              item={card}
              locale={locale}
              marketplace={marketplace.key}
              unavailableLabel={unavailableLabel}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: -4,
  },
  headerRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  marketHeader: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    gap: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  marketHeaderText: {
    fontSize: 11,
    fontWeight: "900",
  },
  marketHeaderBaseline: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  valuesRow: {
    flexDirection: "row",
    gap: 6,
  },
  marketCell: {
    alignItems: "center",
    borderRadius: 7,
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  marketPrice: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    textAlign: "center",
  },
  marketPercent: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    textAlign: "center",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 8,
  },
});
