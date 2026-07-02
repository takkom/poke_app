import koreanNames from "@/data/korean-names.json";
import japaneseNames from "@/data/japanese-names.json";
import type { AppLocale } from "@/hooks/useThemeManager";
import type { PokemonCard } from "@/types/card";

const koreanToEnglish = koreanNames as Record<string, string>;
const japaneseToEnglish = japaneseNames as Record<string, string>;

const englishToKorean = Object.entries(koreanToEnglish).reduce<Record<string, string>>(
  (map, [koreanName, englishName]) => {
    map[englishName.toLowerCase()] = koreanName;
    return map;
  },
  {},
);

const englishNamesByLength = Object.keys(englishToKorean).sort(
  (a, b) => b.length - a.length,
);
const koreanNamesByLength = Object.keys(koreanToEnglish).sort(
  (a, b) => b.length - a.length,
);
const japaneseNamesByLength = Object.keys(japaneseToEnglish).sort(
  (a, b) => b.length - a.length,
);

const japanesePrefixes = {
  "\u30e1\u30ac": "Mega",
  "\u304b\u304c\u3084\u304f": "Radiant",
  "\u30ac\u30e9\u30eb": "Galarian",
} as const;

const rarityTranslations: Record<string, { en: string; ko: string }> = {
  ar: { en: "AR", ko: "아트 레어" },
  chr: { en: "CHR", ko: "캐릭터 레어" },
  csr: { en: "CSR", ko: "캐릭터 슈퍼 레어" },
  hr: { en: "HR", ko: "하이퍼 레어" },
  ma: { en: "MA", ko: "메가 어택" },
  mur: { en: "MUR", ko: "메가 울트라 레어" },
  rr: { en: "RR", ko: "더블 레어" },
  rrr: { en: "RRR", ko: "트리플 레어" },
  sar: { en: "SAR", ko: "스페셜 아트 레어" },
  sr: { en: "SR", ko: "슈퍼 레어" },
  ssr: { en: "SSR", ko: "색이 다른 슈퍼 레어" },
  ur: { en: "UR", ko: "울트라 레어" },
  "art rare": { en: "Art Rare", ko: "아트 레어" },
  "classic promo": { en: "Classic Promo", ko: "클래식 프로모" },
  "double rare": { en: "Double Rare", ko: "더블 레어" },
  holo: { en: "Holo", ko: "홀로" },
  "holo rare": { en: "Holo Rare", ko: "홀로 레어" },
  "hyper rare": { en: "Hyper Rare", ko: "하이퍼 레어" },
  "illustration rare": { en: "Illustration Rare", ko: "일러스트 레어" },
  "master ball": { en: "Master Ball", ko: "마스터볼" },
  "poke ball": { en: "Poke Ball", ko: "몬스터볼" },
  pokeball: { en: "Poke Ball", ko: "몬스터볼" },
  "radiant rare": { en: "Radiant Rare", ko: "찬란한 레어" },
  rare: { en: "Rare", ko: "레어" },
  "reverse holo": { en: "Reverse Holo", ko: "리버스 홀로" },
  "secret rare": { en: "Secret Rare", ko: "시크릿 레어" },
  "shiny rare": { en: "Shiny Rare", ko: "색이 다른 레어" },
  "shiny rare vmax": { en: "Shiny Rare VMAX", ko: "색이 다른 레어 VMAX" },
  "shiny ultra rare": { en: "Shiny Ultra Rare", ko: "색이 다른 울트라 레어" },
  "special art rare": { en: "Special Art Rare", ko: "스페셜 아트 레어" },
  "special illustration rare": { en: "Special Illustration Rare", ko: "스페셜 일러스트 레어" },
  "super rare": { en: "Super Rare", ko: "슈퍼 레어" },
  "triple rare": { en: "Triple Rare", ko: "트리플 레어" },
  "ultra rare": { en: "Ultra Rare", ko: "울트라 레어" },
};

const rarityKeysByLength = Object.keys(rarityTranslations).sort(
  (a, b) => b.length - a.length,
);
const displayNameCache = new Map<string, string>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function replaceNonEnglishFragments(
  name: string,
  sourceNames: readonly string[],
  sourceToEnglish: Record<string, string>,
): string {
  return normalizeSpaces(
    sourceNames.reduce((current, sourceName) => {
      const englishName = sourceToEnglish[sourceName];
      if (!englishName || !current.includes(sourceName)) {
        return current;
      }

      return current.split(sourceName).join(` ${englishName} `);
    }, name),
  );
}

function replaceJapanesePrefixes(name: string): string {
  return normalizeSpaces(
    Object.entries(japanesePrefixes).reduce(
      (current, [prefix, replacement]) => current.split(prefix).join(` ${replacement} `),
      name,
    ),
  );
}

function toEnglishDisplayName(name: string): string {
  let displayName = replaceNonEnglishFragments(name, koreanNamesByLength, koreanToEnglish);
  displayName = replaceNonEnglishFragments(displayName, japaneseNamesByLength, japaneseToEnglish);
  displayName = replaceJapanesePrefixes(displayName);
  return normalizeSpaces(displayName);
}

function toKoreanDisplayName(name: string): string {
  let displayName = toEnglishDisplayName(name);
  const exactMatch = englishToKorean[displayName.toLowerCase()];

  if (exactMatch) {
    return exactMatch;
  }

  for (const englishName of englishNamesByLength) {
    const koreanName = englishToKorean[englishName];
    const pattern = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(englishName)})(?=$|[^A-Za-z])`, "i");
    if (pattern.test(displayName)) {
      displayName = displayName.replace(pattern, (_match, prefix) => `${prefix}${koreanName}`);
    }
  }

  return normalizeSpaces(displayName);
}

export function getDisplayName(name: string, locale: AppLocale): string {
  const cacheKey = `${locale}:${name}`;
  const cachedName = displayNameCache.get(cacheKey);

  if (cachedName) {
    return cachedName;
  }

  const displayName = locale === "ko-KR" ? toKoreanDisplayName(name) : toEnglishDisplayName(name);
  displayNameCache.set(cacheKey, displayName);
  return displayName;
}

export function getDisplayCardName(card: Pick<PokemonCard, "name">, locale: AppLocale): string {
  return getDisplayName(card.name, locale);
}

export function getDisplayRarity(rarity: string | null | undefined, locale: AppLocale): string | null {
  if (!rarity) {
    return null;
  }

  const normalized = normalizeSpaces(rarity).toLowerCase();
  const exact = rarityTranslations[normalized];
  if (exact) {
    return locale === "ko-KR" ? exact.ko : exact.en;
  }

  let displayRarity = normalizeSpaces(rarity);
  for (const key of rarityKeysByLength) {
    const translated = rarityTranslations[key];
    const pattern = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(key)})(?=$|[^A-Za-z])`, "i");
    if (pattern.test(displayRarity)) {
      displayRarity = displayRarity.replace(
        pattern,
        (_match, prefix) => `${prefix}${locale === "ko-KR" ? translated.ko : translated.en}`,
      );
    }
  }

  return displayRarity;
}

export function cleanMarketplaceTitle(title: string | null | undefined): string | null {
  if (!title) {
    return null;
  }

  return normalizeSpaces(
    title
      .replace(/^pokemon\s+tcg\s*[-:|]?\s*/i, "")
      .replace(/^pokemon\s+card\s*[-:|]?\s*/i, "")
      .replace(/^\uD3EC\uCF13\uBAAC\s*tcg\s*[-:|]?\s*/i, "")
      .replace(/^\uD3EC\uCF13\uBAAC\s*\uCE74\uB4DC\s*[-:|]?\s*/i, "")
  );
}
