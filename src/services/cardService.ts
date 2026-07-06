import axios from "axios";
import { CardWithPricing, PokemonCard, PriceHistoryPoint } from "../types/card";

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
  candidates?: ResolutionCardBlueprint[];
}

let cardCache: PokemonCard[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

function resolveTcgdexImageUrl(
  value?: string | null,
  quality: "low" | "high" = "low",
): string {
  const fallback = "https://images.tcgdex.net/placeholder.png";
  if (!value) {
    return fallback;
  }

  if (/\.(png|jpg|jpeg|webp)(\?.*)?$/i.test(value)) {
    return value;
  }

  if (value.includes("assets.tcgdex.net")) {
    return `${value.replace(/\/$/, "")}/${quality}.webp`;
  }

  return value;
}

function normalizeDisplayNumber(
  cardCode?: string | null,
  localId?: string | null,
): string {
  const slashCode = cardCode?.match(/\b([A-Z]*\d+|SV\d+)\s*\/\s*(\d+)\b/i);
  if (slashCode) {
    return `${slashCode[1].toUpperCase()}/${slashCode[2]}`;
  }

  return localId ?? cardCode ?? "";
}

const transformCard = (tcgCard: any): CardWithPricing => {
  // Fall back gracefully across both local backend and TCGdex formats
  const imageBase =
    tcgCard.image ||
    tcgCard.image_url ||
    tcgCard.images?.large ||
    tcgCard.images?.small ||
    "https://images.tcgdex.net/placeholder.png";
  const smallImage = resolveTcgdexImageUrl(
    tcgCard.images?.small || imageBase,
    "low",
  );
  const largeImage = resolveTcgdexImageUrl(
    tcgCard.images?.large || imageBase,
    "high",
  );

  const types = Array.isArray(tcgCard.types)
    ? tcgCard.types
    : Array.isArray(tcgCard.type)
      ? tcgCard.type
      : [];

  return {
    id: tcgCard.id ?? "unknown",
    name: tcgCard.name ?? "Unknown Card",
    number:
      tcgCard.number ??
      normalizeDisplayNumber(tcgCard.card_code, tcgCard.local_id),
    rarity: tcgCard.rarity ?? "Classic Promo",
    image: smallImage,
    // Explicitly guarantee small and large properties exist to prevent UI rendering errors
    images: {
      small: smallImage,
      large: largeImage,
    },
    set: {
      id: tcgCard.set?.id || "unknown",
      name: tcgCard.set?.name || "Unknown Set",
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
  };
};
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
): Promise<CardWithPricing | null> => {
  try {
    const localResponse = await axios.get(
      `${LOCAL_API_BASE_URL}/api/cards/${encodeURIComponent(id)}`,
    );
    if (localResponse.data) {
      return transformCard(localResponse.data);
    }
  } catch (error) {
    console.warn(
      `Local card details unavailable for ${id}, falling back to TCGdex.`,
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
): Promise<PriceHistoryPoint[]> => {
  const params = new URLSearchParams({ currency });
  const response = await fetch(
    `${LOCAL_API_BASE_URL}/api/cards/${encodeURIComponent(cardId)}/price-history?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Price history failed with ${response.status}`);
  }

  const data = (await response.json()) as PriceHistoryPoint[];
  return Array.isArray(data) ? data : [];
};

export const getMostSoldCards = async (
  limit: number = 30,
  currency: "KRW" | "USD" = "KRW",
): Promise<PokemonCard[]> => {
  const params = new URLSearchParams({
    limit: String(limit),
    currency,
  });
  const response = await fetch(
    `${LOCAL_API_BASE_URL}/api/cards/most-sold?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Most sold cards failed with ${response.status}`);
  }

  const data = (await response.json()) as PokemonCard[];
  return Array.isArray(data) ? data.map(transformCard) : [];
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
): Promise<PokemonCard[]> => {
  try {
    const response = await fetch(
      `${LOCAL_API_BASE_URL}/api/resolution/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchTerm }),
      },
    );

    if (!response.ok) {
      throw new Error(`Resolution search failed with ${response.status}`);
    }

    const data = (await response.json()) as ResolutionSearchResponse;
    const blueprints = data.card ? [data.card] : (data.candidates ?? []);

    return blueprints.map((card) => {
      const cardId =
        card.canonical_id ?? card.tcgdex_id ?? card.id ?? data.tcgdex_id ?? "";
      const rawImage =
        card.image_url ?? card.projected_image_asset_path ?? undefined;
      const image =
        rawImage && !rawImage.startsWith("/")
          ? resolveTcgdexImageUrl(rawImage, "low")
          : undefined;

      return {
        id: cardId,
        db_id: card.id,
        canonical_id: card.canonical_id ?? null,
        tcgdex_id: card.tcgdex_id ?? null,
        language: card.language ?? null,
        name: card.name ?? cardId,
        number: normalizeDisplayNumber(card.card_code, card.local_id),
        rarity: card.rarity ?? undefined,
        image,
        image_url: image,
        images: image
          ? {
              small: image,
              large: image,
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
      };
    });
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
};
