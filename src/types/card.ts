export interface PriceHistoryPoint {
  date: string;
  ebay_avg_krw: number | null;
  kream_avg_krw: number | null;
  sneakrdunk_avg_krw?: number | null;
  ebay_volume: number;
  kream_volume: number;
  sneakrdunk_volume?: number;
}

export interface PokemonCard {
  id: string;
  name: string;
  number: string;
  hasEbay?: boolean;
  hasKream?: boolean;
  hasSnkrdunk?: boolean;
  hasTcgplayer?: boolean;
  hasCardmarket?: boolean;
  priceHistory?: PriceHistoryPoint[];
  pricing?: CardPricing;
  rarity?: string;
  images?: {
    small?: string;
    large?: string;
  };
  image?: string;
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
  type?: string[];
  description?: string;
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
}

export interface CardPricing {
  current?: {
    usd?: number;
    eur?: number;
    jpy?: number;
    gbp?: number;
    aud?: number;
  };
  avg30?: {
    usd?: number;
    eur?: number;
    jpy?: number;
    gbp?: number;
    aud?: number;
  };
  avg7?: {
    usd?: number;
    eur?: number;
    jpy?: number;
    gbp?: number;
    aud?: number;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      lowPriceExPlus?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloAvg1?: number;
      reverseHoloAvg7?: number;
      reverseHoloAvg30?: number;
    };
  };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      normal?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
      };
      holofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
      };
      reverseHolofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
      };
    };
  };
}

export interface CardWithPricing extends PokemonCard {
  pricing?: CardPricing;
}
