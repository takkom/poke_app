import axios from "axios";
import { XMON_API_URL } from "../config";
import { resolveCardDisplayNumber } from "../utils/cardNumber";
import {
  CardWithPricing,
  MarketplaceAverage,
  MarketplaceKey,
  PokemonCard,
  PriceHistoryPoint,
  QualityBucket,
  QualityBucketCode,
} from "../types/card";

const API_BASE_URL = "https://api.tcgdex.net/v2/en";

interface TCGdexCard {
  id: string;
  name?: string;
  number?: string;
  local_id?: string;
  card_code?: string;
  rarity?: string;
  image?: string;
  images?: {
    small?: string;
    large?: string;
  };
  set?: {
    id?: string;
    name?: string;
    releaseDate?: string;
    series?: string;
    cardCount?: {
      official?: number;
      total?: number;
    };
  };
  artist?: string;
  hp?: number;
  types?: string[];
  type?: string[];
  variants?: unknown[];
  attacks?: unknown[];
  weaknesses?: Array<{
    type?: string;
    value?: string;
  }>;
  resistances?: Array<{
    type?: string;
    value?: string;
  }>;
  pricing?: any;
}

interface TCGdexSet {
  id: string;
  name: string;
  releaseDate?: string;
  series?: string;
  cards?: TCGdexCard[];
}

interface ResolutionCardBlueprint {
  id?: string;
  canonical_id?: string | null;
  tcgdex_id?: string | null;
  language?: string | null;
  name?: string | null;
  local_id?: string | null;
  card_code?: string | null;
  rarity?: string | null;
  image_url?: string | null;
  projected_image_asset_path?: string | null;
  avgPrice?: number | null;
  displayCurrency?: "KRW" | "USD" | "JPY";
  set_id?: string | null;
  hasEbay?: boolean;
  hasKream?: boolean;
  hasSnkrdunk?: boolean;
  hasTcgplayer?: boolean;
  hasCardmarket?: boolean;
  totalSales?: number;
  ebaySales?: number;
  kreamSales?: number;
  snkrdunkSales?: number;
}

interface ResolutionSearchResponse {
  tcgdex_id?: string | null;
  card?: ResolutionCardBlueprint | null;
  box?: BoosterBoxBlueprint | null;
  candidates?: ResolutionCardBlueprint[];
  item_type?: "card" | "box";
}

export interface BoosterBoxBlueprint {
  id?: string;
  canonical_id?: string | null;
  name?: string | null;
  display_name?: string | null;
  set_name?: string | null;
  set_code?: string | null;
  image_url?: string | null;
  avgPrice?: number | null;
  displayCurrency?: "KRW" | "USD" | "JPY";
}

let cardCache: PokemonCard[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

function resolveTcgdexImageUrl(
  value?: string | null,
  quality: "low" | "high" = "low",
): string {
  const fallback = "https://images.tcgdex.net/placeholder.png";
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  // Match only a real file extension at the end. Kream CDNs embed ".PNG/" in
  // the path before the filename; a mid-string match would corrupt those URLs.
  if (/\.(png|jpg|jpeg|webp)(\?.*)?$/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes("assets.tcgdex.net")) {
    return `${trimmed.replace(/\/$/, "")}/${quality}.webp`;
  }

  return trimmed;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return `${XMON_API_URL}${url}`;
  return url;
}

const transformCard = (tcgCard: any): CardWithPricing => {
  // Fall back gracefully across API and TCGdex response shapes
  const imageBase =
    resolveImageUrl(tcgCard.image) ||
    resolveImageUrl(tcgCard.image_url) ||
    resolveImageUrl(tcgCard.thumbnail_url) ||
    resolveImageUrl(tcgCard.thumbnail) ||
    resolveImageUrl(tcgCard.box_image_url) ||
    resolveImageUrl(tcgCard.photo_url) ||
    resolveImageUrl(tcgCard.images?.large) ||
    resolveImageUrl(tcgCard.images?.small) ||
    null;
  const smallImage = imageBase
    ? resolveTcgdexImageUrl(tcgCard.images?.small || imageBase, "low")
    : undefined;
  const largeImage = imageBase
    ? resolveTcgdexImageUrl(tcgCard.images?.large || imageBase, "high")
    : undefined;

  const types = Array.isArray(tcgCard.types)
    ? tcgCard.types
    : Array.isArray(tcgCard.type)
      ? tcgCard.type
      : [];

  return {
    id: String(tcgCard.id ?? "unknown"),
    item_type: (tcgCard.item_type === "box" || tcgCard.item_type === "booster_box") ? "box" : "card",
    name: String(tcgCard.display_name || tcgCard.name || "Unknown"),
    pokemon_name:
      typeof tcgCard.pokemon_name === "string" ? tcgCard.pokemon_name : null,
    language: typeof tcgCard.language === "string" ? tcgCard.language : null,
    number: resolveCardDisplayNumber({
      number: tcgCard.number,
      card_code: tcgCard.card_code,
      local_id: tcgCard.local_id,
      set: tcgCard.set,
    }),
    card_code:
      typeof tcgCard.card_code === "string" ? tcgCard.card_code : null,
    local_id: typeof tcgCard.local_id === "string" ? tcgCard.local_id : null,
    rarity: tcgCard.rarity ?? "Classic Promo",
    image: smallImage,
    // Explicitly guarantee small and large properties exist to prevent UI rendering errors
    images: {
      small: smallImage,
      large: largeImage,
    },
    set: {
      id: tcgCard.set?.id || tcgCard.set_code || undefined,
      name:
        tcgCard.set?.display_name ||
        tcgCard.set?.displayName ||
        tcgCard.display_set_name ||
        tcgCard.set?.name ||
        tcgCard.set_name ||
        undefined,
      releaseDate: tcgCard.set?.releaseDate,
      series: tcgCard.set?.series,
      cardCount: {
        official: tcgCard.set?.cardCount?.official || 0,
        total: tcgCard.set?.cardCount?.total || 0,
      },
    },
    artist: tcgCard.artist || null,
    hp: tcgCard.hp || null,
    type: types,
    // If variants is an object (like TCGdex returns), pass it; if missing, provide safe defaults
    variants: tcgCard.variants || {
      firstEdition: false,
      holo: false,
      normal: true,
      reverse: false,
      wPromo: false,
    },
    attacks: Array.isArray(tcgCard.attacks) ? tcgCard.attacks : [],
    weaknesses: Array.isArray(tcgCard.weaknesses) ? tcgCard.weaknesses : [],
    resistances: Array.isArray(tcgCard.resistances) ? tcgCard.resistances : [],
    pricing: tcgCard.pricing ?? {},
    hasEbay: Boolean(tcgCard.hasEbay),
    hasKream: Boolean(tcgCard.hasKream),
    hasSnkrdunk: Boolean(tcgCard.hasSnkrdunk),
    hasTcgplayer: Boolean(tcgCard.hasTcgplayer),
    hasCardmarket: Boolean(tcgCard.hasCardmarket),
    totalSales:
      typeof tcgCard.totalSales === "number" ? tcgCard.totalSales : undefined,
    ebaySales:
      typeof tcgCard.ebaySales === "number" ? tcgCard.ebaySales : undefined,
    kreamSales:
      typeof tcgCard.kreamSales === "number" ? tcgCard.kreamSales : undefined,
    snkrdunkSales:
      typeof tcgCard.snkrdunkSales === "number"
        ? tcgCard.snkrdunkSales
        : undefined,
    latestSoldAt: tcgCard.latestSoldAt ?? null,
    kreamTitle:
      typeof tcgCard.kreamTitle === "string" ? tcgCard.kreamTitle : null,
    avgPrice: typeof tcgCard.avgPrice === "number" ? tcgCard.avgPrice : null,
    previousAvgPrice:
      typeof tcgCard.previousAvgPrice === "number"
        ? tcgCard.previousAvgPrice
        : null,
    trendPercent:
      typeof tcgCard.trendPercent === "number" ? tcgCard.trendPercent : null,
    trendDirection: ["up", "down", "flat", "unknown"].includes(
      tcgCard.trendDirection,
    )
      ? tcgCard.trendDirection
      : "unknown",
    displayCurrency: tcgCard.displayCurrency ?? undefined,
    set_name:
      typeof tcgCard.set_name === "string"
        ? tcgCard.set_name
        : typeof tcgCard.set?.name === "string"
          ? tcgCard.set.name
          : null,
    display_set_name:
      typeof tcgCard.display_set_name === "string"
        ? tcgCard.display_set_name
        : typeof tcgCard.set?.display_name === "string"
          ? tcgCard.set.display_name
          : typeof tcgCard.set?.displayName === "string"
            ? tcgCard.set.displayName
            : null,
  };
};

function normalizeMarketplace(value: unknown): MarketplaceKey | undefined {
  return value === "kream" || value === "ebay" || value === "snkrdunk"
    ? value
    : undefined;
}

function normalizeMarketplaceAverage(value: unknown): MarketplaceAverage {
  const average = value as MarketplaceAverage | null | undefined;

  return {
    avgPrice:
      typeof average?.avgPrice === "number" ? average.avgPrice : null,
    relativePercent:
      typeof average?.relativePercent === "number"
        ? average.relativePercent
        : null,
    volume: typeof average?.volume === "number" ? average.volume : null,
  };
}

const MARKETPLACE_KEYS: MarketplaceKey[] = ["kream", "ebay", "snkrdunk"];

function transformArbitrageCard(tcgCard: any): PokemonCard {
  const card = transformCard(tcgCard);
  const averages = tcgCard.marketplaceAverages ?? {};

  return {
    ...card,
    baselineMarketplace: normalizeMarketplace(tcgCard.baselineMarketplace),
    baselineAvgPrice:
      typeof tcgCard.baselineAvgPrice === "number"
        ? tcgCard.baselineAvgPrice
        : null,
    arbitrageMarketplace: normalizeMarketplace(tcgCard.arbitrageMarketplace),
    arbitragePercent:
      typeof tcgCard.arbitragePercent === "number"
        ? tcgCard.arbitragePercent
        : null,
    marketplaceAverages: {
      kream: normalizeMarketplaceAverage(averages.kream),
      ebay: normalizeMarketplaceAverage(averages.ebay),
      snkrdunk: normalizeMarketplaceAverage(averages.snkrdunk),
    },
  };
}

function priceHistoryAverageKey(platform: MarketplaceKey): keyof PriceHistoryPoint {
  return `${platform}_avg` as keyof PriceHistoryPoint;
}

function priceHistoryAverageKrwKey(
  platform: MarketplaceKey,
): keyof PriceHistoryPoint {
  return `${platform}_avg_krw` as keyof PriceHistoryPoint;
}

function priceHistoryVolumeKey(platform: MarketplaceKey): keyof PriceHistoryPoint {
  return `${platform}_volume` as keyof PriceHistoryPoint;
}

function readPriceHistoryAverage(
  row: PriceHistoryPoint,
  platform: MarketplaceKey,
): number | null {
  const value =
    row[priceHistoryAverageKey(platform)] ??
    row[priceHistoryAverageKrwKey(platform)];
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function deriveMarketplaceAveragesFromPriceHistory(
  history: PriceHistoryPoint[],
): Partial<Record<MarketplaceKey, MarketplaceAverage>> {
  if (!history.length) {
    return {};
  }

  const marketplaceAverages: Partial<Record<MarketplaceKey, MarketplaceAverage>> =
    {};

  for (const platform of MARKETPLACE_KEYS) {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const avgPrice = readPriceHistoryAverage(history[index], platform);
      if (avgPrice == null) {
        continue;
      }

      const volume = Number(history[index][priceHistoryVolumeKey(platform)] ?? 0);
      marketplaceAverages[platform] = {
        avgPrice,
        relativePercent: null,
        volume: Number.isFinite(volume) ? volume : 0,
      };
      break;
    }
  }

  return marketplaceAverages;
}

export function applyBaselineArbitrage(
  card: PokemonCard,
  baseline: MarketplaceKey,
): PokemonCard {
  const averages = card.marketplaceAverages;
  if (!averages) {
    return { ...card, baselineMarketplace: baseline };
  }

  const baselinePrice = averages[baseline]?.avgPrice;
  if (
    typeof baselinePrice !== "number" ||
    !Number.isFinite(baselinePrice) ||
    baselinePrice === 0
  ) {
    return { ...card, baselineMarketplace: baseline };
  }

  const marketplaceAverages = { ...averages };
  for (const key of MARKETPLACE_KEYS) {
    const avg = marketplaceAverages[key];
    if (!avg) continue;

    const price = avg.avgPrice;
    if (key === baseline) {
      marketplaceAverages[key] = { ...avg, relativePercent: 0 };
      continue;
    }

    if (typeof price === "number" && Number.isFinite(price)) {
      marketplaceAverages[key] = {
        ...avg,
        relativePercent: ((price - baselinePrice) / baselinePrice) * 100,
      };
    }
  }

  return {
    ...card,
    baselineMarketplace: baseline,
    baselineAvgPrice: baselinePrice,
    marketplaceAverages,
  };
}
export const getAllCards = async (
  forceRefresh: boolean = false,
): Promise<PokemonCard[]> => {
  // Return cached data if available and not expired
  if (
    cardCache.length > 0 &&
    !forceRefresh &&
    Date.now() - cacheTimestamp < CACHE_DURATION
  ) {
    return cardCache;
  }

  try {
    // Fetch all cards directly (TCGdex API has a /cards endpoint)
    const cardsResponse = await axios.get(`${API_BASE_URL}/cards`, {
      params: {
        limit: 250, // Fetch up to 250 cards
      },
    });

    // const response = await axios.get(
    //   "https://api.tcgdex.net/v2/en/cards?name=pikachu&set=sv03.5",
    // );

    // console.log(response.data);

    let allCards: PokemonCard[] = [];

    // Handle different response formats
    const cardData = Array.isArray(cardsResponse.data)
      ? cardsResponse.data
      : cardsResponse.data.data || cardsResponse.data;

    if (Array.isArray(cardData)) {
      const tcgCards: TCGdexCard[] = cardData;
      const transformedCards = tcgCards.map((card) => transformCard(card));
      allCards.push(...transformedCards);
    }

    // If we didn't get enough cards, try fetching from specific sets
    if (allCards.length === 0) {
      try {
        const setsResponse = await axios.get(`${API_BASE_URL}/sets`);
        const sets: TCGdexSet[] = Array.isArray(setsResponse.data)
          ? setsResponse.data
          : setsResponse.data.data || setsResponse.data;

        const maxSets = Math.min(3, sets.length);

        for (let i = 0; i < maxSets; i++) {
          try {
            const setId = sets[i].id;
            const setCardsResponse = await axios.get(
              `${API_BASE_URL}/sets/${setId}/cards`,
            );
            const tcgCards: TCGdexCard[] = Array.isArray(setCardsResponse.data)
              ? setCardsResponse.data
              : setCardsResponse.data.data || setCardsResponse.data;

            if (Array.isArray(tcgCards)) {
              const transformedCards = tcgCards.map((card) =>
                transformCard(card),
              );
              allCards.push(...transformedCards);
            }
          } catch (error) {
            console.warn(`Failed to load cards for set ${sets[i].id}:`, error);
            // Continue with next set
          }
        }
      } catch (error) {
        console.warn("Failed to fetch sets:", error);
      }
    }

    // Cache the results
    cardCache = allCards;
    cacheTimestamp = Date.now();

    return allCards;
  } catch (error) {
    console.error("Failed to fetch cards from TCGdex:", error);
    // Return cached data even if expired
    if (cardCache.length > 0) {
      return cardCache;
    }
    throw new Error(
      "Failed to load Pokémon cards. Please check your internet connection.",
    );
  }
};

export const getCardById = async (
  id: string,
  options?: {
    baseline?: MarketplaceKey;
    currency?: "KRW" | "USD" | "JPY";
    locale?: string;
  },
): Promise<CardWithPricing | null> => {
  const baseline = options?.baseline ?? "kream";
  const params = new URLSearchParams();
  if (options?.currency) {
    params.set("currency", options.currency);
  }
  params.set("baseline", baseline);
  if (options?.locale) {
    params.set("locale", options.locale);
  }
  const query = params.toString();

  try {
    const localResponse = await axios.get(
      `${XMON_API_URL}/api/cards/${encodeURIComponent(id)}?${query}`,
    );
    if (localResponse.data) {
      return applyBaselineArbitrage(
        transformArbitrageCard(localResponse.data),
        baseline,
      );
    }
  } catch (error) {
    console.warn(
      `API card details unavailable for ${id}, falling back to TCGdex.`,
    );
  }

  try {
    // Fetch the specific card
    const response = await axios.get(`${API_BASE_URL}/cards/${id}`);
    console.log(`Fetched card ${id} from TCGdex:`, response.data);

    // Handle different response formats
    const tcgCard: TCGdexCard = Array.isArray(response.data)
      ? response.data[0]
      : response.data.data || response.data;

    if (!tcgCard) {
      console.warn(`Card data not found for ${id}`);
      return null;
    }

    return transformCard(tcgCard);

    // const card = transformCard(tcgCard);

    // Fetch pricing data
    // const pricing = await getCardPricing(id);

    // return {
    //   ...card,
    //   pricing,
    // };
  } catch (error) {
    console.error(`Failed to fetch card ${id}:`, error);
    return null;
  }
};

export const getPriceHistory = async (
  cardId: string,
  currency: "KRW" | "USD" = "KRW",
  qualities?: QualityBucketCode[],
  locale: string = "en-US",
): Promise<PriceHistoryPoint[]> => {
  const params = new URLSearchParams({ currency, locale });
  if (qualities?.length) {
    params.set("qualities", qualities.join(","));
  }
  const response = await fetch(
    `${XMON_API_URL}/api/cards/${encodeURIComponent(cardId)}/price-history?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Price history failed with ${response.status}`);
  }

  const data = (await response.json()) as PriceHistoryPoint[];
  return Array.isArray(data) ? data : [];
};

export const getPriceHistoryQualities = async (
  cardId: string,
): Promise<QualityBucket[]> => {
  // Quality buckets are an optional enhancement layered on top of price
  // history. If the backend hasn't rolled the endpoint out yet (404) or it
  // hiccups for any other reason, fail soft so the caller can fall back to
  // the old unfiltered chart instead of showing nothing at all.
  try {
    const response = await fetch(
      `${XMON_API_URL}/api/cards/${encodeURIComponent(cardId)}/price-history/qualities`,
    );

    if (!response.ok) {
      console.warn(
        `Price history qualities unavailable (${response.status}) for ${cardId}`,
      );
      return [];
    }

    const data = (await response.json()) as QualityBucket[];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`Price history qualities request failed for ${cardId}:`, error);
    return [];
  }
};

export const getMostSoldArbitrageCards = async (
  limit: number = 30,
  currency: "KRW" | "USD" = "KRW",
  baseline: MarketplaceKey = "kream",
  itemType: "card" | "box" = "card",
  locale: string = "en-US",
): Promise<PokemonCard[]> => {
  const params = new URLSearchParams({
    baseline,
    currency,
    limit: String(limit),
    locale,
    ...(itemType === "box" ? { item_type: "box" } : {}),
  });
  const response = await fetch(
    `${XMON_API_URL}/api/cards/most-sold-arbitrage?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Most sold arbitrage cards failed with ${response.status}`);
  }

  const data = (await response.json()) as PokemonCard[];
  return Array.isArray(data) ? data.map(transformArbitrageCard) : [];
};

// export const getCardPricing = async (
//   cardId: string,
// ): Promise<CardPricing | undefined> => {
//   try {
//     // TCGdex provides price data through separate endpoint
//     const response = await axios.get(`${API_BASE_URL}/cards/${cardId}/prices`);

//     const data = Array.isArray(response.data)
//       ? response.data[0]
//       : response.data.data || response.data;

//     if (data) {
//       return {
//         tcgplayer: data.tcgplayer,
//         cardmarket: data.cardmarket,
//       };
//     }

//     return undefined;
//   } catch (error) {
//     // Pricing data is optional, so don't throw error
//     console.warn(`Pricing data not available for card ${cardId}`);
//     return undefined;
//   }
// };

export const searchCardsByName = async (
  cards: PokemonCard[],
  query: string,
): Promise<PokemonCard[]> => {
  if (!query.trim()) return cards;

  const lowerQuery = query.toLowerCase();

  return cards.filter((card) => {
    const nameMatch = card.name.toLowerCase().includes(lowerQuery);
    const numberMatch = card.number.includes(query);
    const setMatch = card.set?.name?.toLowerCase().includes(lowerQuery);

    return nameMatch || numberMatch || setMatch;
  });
};

export const clearCache = (): void => {
  cardCache = [];
  cacheTimestamp = 0;
};

export const searchCard = async (
  searchTerm: string,
  options?: {
    currency?: "KRW" | "USD";
    locale?: string;
  },
): Promise<PokemonCard[]> => {
  try {
    const response = await fetch(
      `${XMON_API_URL}/api/resolution/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchTerm,
          ...(options?.currency ? { display_currency: options.currency } : {}),
          ...(options?.locale ? { locale: options.locale } : {}),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Resolution search failed with ${response.status}`);
    }

    const data = (await response.json()) as ResolutionSearchResponse;
    const blueprints = data.card ? [data.card] : (data.candidates ?? []);
    const seenIds = new Set<string>();

    return blueprints.flatMap((card) => {
      const cardId =
        card.canonical_id ?? card.tcgdex_id ?? card.id ?? data.tcgdex_id ?? "";
      if (!cardId || seenIds.has(cardId)) {
        return [];
      }
      seenIds.add(cardId);

      const rawImage =
        card.image_url?.trim() ||
        card.projected_image_asset_path?.trim() ||
        undefined;
      const resolvedRaw = rawImage?.startsWith("/")
        ? `${XMON_API_URL}${rawImage}`
        : rawImage;
      const image = resolvedRaw
        ? resolveTcgdexImageUrl(resolvedRaw, "low")
        : undefined;
      const usableImage =
        image && !image.includes("placeholder.png") ? image : undefined;

      return [
        {
          id: cardId,
          db_id: card.id,
          canonical_id: card.canonical_id ?? null,
          tcgdex_id: card.tcgdex_id ?? null,
          language: card.language ?? null,
          name: card.name ?? cardId,
          number: resolveCardDisplayNumber({
            card_code: card.card_code,
            local_id: card.local_id,
          }),
          card_code: card.card_code ?? null,
          local_id: card.local_id ?? null,
          rarity: card.rarity ?? undefined,
          image: usableImage,
          image_url: usableImage,
          images: usableImage
            ? {
                small: usableImage,
                large: usableImage,
              }
            : undefined,
          set: card.set_id
            ? {
                id: card.set_id,
                name: card.set_id,
              }
            : undefined,
          hasEbay: Boolean(card.hasEbay),
          hasKream: Boolean(card.hasKream),
          hasSnkrdunk: Boolean(card.hasSnkrdunk),
          hasTcgplayer: Boolean(card.hasTcgplayer),
          hasCardmarket: Boolean(card.hasCardmarket),
          totalSales:
            typeof card.totalSales === "number" ? card.totalSales : undefined,
          ebaySales:
            typeof card.ebaySales === "number" ? card.ebaySales : undefined,
          kreamSales:
            typeof card.kreamSales === "number" ? card.kreamSales : undefined,
          snkrdunkSales:
            typeof card.snkrdunkSales === "number"
              ? card.snkrdunkSales
              : undefined,
          avgPrice: typeof card.avgPrice === "number" ? card.avgPrice : null,
          displayCurrency: card.displayCurrency ?? undefined,
        },
      ];
    });
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
};

export const getBoxById = async (
  id: string,
  options?: {
    currency?: "KRW" | "USD";
    locale?: string;
  },
): Promise<CardWithPricing | null> => {
  try {
    const params = new URLSearchParams();
    if (options?.currency) {
      params.set("currency", options.currency);
    }
    if (options?.locale) {
      params.set("locale", options.locale);
    }
    const query = params.toString();
    const response = await fetch(
      `${XMON_API_URL}/api/booster-boxes/${encodeURIComponent(id)}${query ? `?${query}` : ""}`,
    );
    if (!response.ok) throw new Error(`Box fetch failed with ${response.status}`);
    const data = await response.json();
    if (!data) return null;
    return transformCard(data);
  } catch (error) {
    console.error(`Failed to fetch box ${id}:`, error);
    return null;
  }
};

export const getBoxPriceHistory = async (
  boxId: string,
  currency: "KRW" | "USD" = "KRW",
  locale: string = "en-US",
): Promise<PriceHistoryPoint[]> => {
  try {
    const params = new URLSearchParams({ currency, locale });
    const response = await fetch(
      `${XMON_API_URL}/api/booster-boxes/${encodeURIComponent(boxId)}/price-history?${params.toString()}`,
    );
    if (!response.ok) throw new Error(`Box price history failed with ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Failed to fetch box price history ${boxId}:`, error);
    return [];
  }
};

export const searchBox = async (
  searchTerm: string,
  options?: {
    currency?: "KRW" | "USD";
    locale?: string;
  },
): Promise<BoosterBoxBlueprint[]> => {
  try {
    const response = await fetch(
      `${XMON_API_URL}/api/resolution/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchTerm,
          item_type: "box",
          ...(options?.currency ? { display_currency: options.currency } : {}),
          ...(options?.locale ? { locale: options.locale } : {}),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Box search failed with ${response.status}`);
    }

    const data = (await response.json()) as ResolutionSearchResponse;
    const best = data.box ?? null;
    const raw: BoosterBoxBlueprint[] = best
      ? [best, ...((data.candidates as BoosterBoxBlueprint[]) ?? [])]
      : ((data.candidates as BoosterBoxBlueprint[]) ?? []);
    return raw.map((b) => ({
      ...b,
      image_url: b.image_url?.startsWith("/")
        ? `${XMON_API_URL}${b.image_url}`
        : b.image_url,
    }));
  } catch (error) {
    console.error("Box search failed:", error);
    return [];
  }
};
