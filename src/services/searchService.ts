import { PokemonCard } from "@/types/card";

export const searchCards = (
  cards: PokemonCard[],
  query: string,
): PokemonCard[] => {
  if (!query.trim()) return cards;

  const lowerQuery = query.toLowerCase();

  return cards.filter((card) => {
    const nameMatch = card.name.toLowerCase().includes(lowerQuery);
    const numberMatch = card.number.includes(query);
    const setMatch = card.set?.name?.toLowerCase().includes(lowerQuery);

    return nameMatch || numberMatch || setMatch;
  });
};
