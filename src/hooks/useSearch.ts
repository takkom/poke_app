import { useState } from "react";
import { searchCard } from "../services/cardService";

export const useSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  const performSearch = async () => {
    const query = searchQuery.trim();

    if (!query) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("useSearch - query=", query);
      const data = await searchCard(query);

      console.log("Search results:", data);

      setResults(data || []);
    } catch (err) {
      console.error(err);
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    performSearch,
    results,
    loading,
    error,
  };
};
