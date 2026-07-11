import type { MarketplaceKey } from "@/types/card";

/** Column order for marketplace comparison UIs (eBay is rightmost). */
export const MARKETPLACE_COLUMN_ORDER: MarketplaceKey[] = [
  "kream",
  "snkrdunk",
  "ebay",
];

export const MARKETPLACE_LIST_LABELS: Record<MarketplaceKey, string> = {
  kream: "Kream",
  snkrdunk: "SNKR",
  ebay: "ebay",
};

export const MARKETPLACE_CHART_LABELS: Record<MarketplaceKey, string> = {
  kream: "KREAM",
  snkrdunk: "SNKRDUNK",
  ebay: "eBay",
};

export const MARKETPLACE_BADGE_LABELS: Record<MarketplaceKey, string> = {
  kream: "KREAM",
  snkrdunk: "SNK",
  ebay: "eBay",
};
