const DEFAULT_XMON_API_URL = "https://xmon-api-v2-production.up.railway.app";

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export const XMON_API_URL = normalizeApiUrl(
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_XMON_API_URL,
);
