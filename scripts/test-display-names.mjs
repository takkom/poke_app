import koreanNames from "../src/data/korean-names.json" with { type: "json" };
import japaneseNames from "../src/data/japanese-names.json" with { type: "json" };

// Mirror displayNames.ts logic for quick CLI checks.
const koreanToEnglish = koreanNames;
const englishPrefixTranslations = {
  alolan: { en: "Alolan", ko: "알로라" },
  dark: { en: "Dark", ko: "다크" },
  galarian: { en: "Galarian", ko: "가라르" },
  hisuian: { en: "Hisuian", ko: "히스ui" },
  light: { en: "Light", ko: "라이트" },
  mega: { en: "Mega", ko: "메가" },
  paldean: { en: "Paldean", ko: "팔데아" },
  radiant: { en: "Radiant", ko: "찬란한" },
  shining: { en: "Shining", ko: "샤이닝" },
};
const englishPrefixKeysByLength = Object.keys(englishPrefixTranslations).sort((a, b) => b.length - a.length);
const englishToKorean = Object.fromEntries(
  Object.entries(koreanToEnglish).flatMap(([ko, en]) => {
    const key = en.toLowerCase();
    return [[key, ko], [key.replace(/['’]/g, ""), ko]];
  }),
);
const englishNamesByLength = Object.keys(englishToKorean).sort((a, b) => b.length - a.length);
const koreanNamesByLength = Object.keys(koreanToEnglish).sort((a, b) => b.length - a.length);
const japaneseNamesByLength = Object.keys(japaneseNames).sort((a, b) => b.length - a.length);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeSpaces(value) {
  return value.replace(/\s+/g, " ").trim();
}
function normalizeCardNameInput(name) {
  let normalized = String(name ?? "").normalize("NFKC");
  normalized = normalized
    .replace(/[<>]/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\(\s+/g, " ")
    .replace(/\s+\)/g, " ")
    .replace(/&/g, " & ")
    .replace(/([a-z0-9])-([a-z0-9])/gi, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(VMAX|VSTAR|VUNION|EX|GX|V)(\b|$)/gi, "$1 $2")
    .replace(/([a-z])ex\b/gi, "$1 ex");
  return normalizeSpaces(normalized);
}
function replaceNonEnglishFragments(name, sourceNames, sourceToEnglish) {
  return normalizeSpaces(
    sourceNames.reduce((current, sourceName) => {
      const englishName = sourceToEnglish[sourceName];
      if (!englishName || !current.includes(sourceName)) return current;
      return current.split(sourceName).join(` ${englishName} `);
    }, name),
  );
}
function replaceEnglishPrefixes(name, locale) {
  let displayName = name;
  for (const key of englishPrefixKeysByLength) {
    const translated = englishPrefixTranslations[key];
    const replacement = locale === "ko-KR" ? translated.ko : translated.en;
    const pattern = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(key)})(?=$|[^A-Za-z])`, "i");
    if (pattern.test(displayName)) {
      displayName = displayName.replace(pattern, (_m, prefix) => `${prefix}${replacement}`);
    }
  }
  return normalizeSpaces(displayName);
}
function replaceEnglishPokemonNames(name) {
  let displayName = name;
  for (const englishName of englishNamesByLength) {
    const koreanName = englishToKorean[englishName];
    if (!koreanName) continue;
    const pattern = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(englishName)})(?=$|[^A-Za-z])`, "i");
    if (pattern.test(displayName)) {
      displayName = displayName.replace(pattern, (_m, prefix) => `${prefix}${koreanName}`);
    }
  }
  return normalizeSpaces(displayName);
}
function toEnglishDisplayName(name) {
  let displayName = replaceNonEnglishFragments(name, koreanNamesByLength, koreanToEnglish);
  displayName = replaceNonEnglishFragments(displayName, japaneseNamesByLength, japaneseNames);
  return replaceEnglishPrefixes(normalizeSpaces(displayName), "en-US");
}
function toKoreanDisplayName(name) {
  const normalized = normalizeCardNameInput(name);
  let displayName = toEnglishDisplayName(normalized);
  const exactMatch = englishToKorean[displayName.toLowerCase()];
  if (exactMatch) return exactMatch;
  displayName = replaceEnglishPokemonNames(displayName);
  displayName = replaceEnglishPrefixes(displayName, "ko-KR");
  return normalizeSpaces(displayName);
}

const samples = [
  "Mega CharizardX ex MA Mega Dream ex",
  "Charizard ex",
  "Umbreon ex",
  "Gengar ex",
  "Hisuian Zoroark VSTAR",
  "Radiant Charizard",
  "Elesa'sSparkle",
  "Pikachu",
  "Mew ex",
];

for (const name of samples) {
  console.log(JSON.stringify({ in: name, ko: toKoreanDisplayName(name) }));
}
