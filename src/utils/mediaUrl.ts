import { XMON_API_URL } from "@/config";

type ImageSource = {
  image_url?: string | null;
  projected_image_asset_path?: string | null;
  language?: string | null;
  set_id?: string | null;
  local_id?: string | null;
  card_code?: string | null;
};

export function resolveTcgdexImageUrl(
  value?: string | null,
  quality: "low" | "high" = "low",
): string | null {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();
  // End-anchored only: marketplace CDNs (e.g. Kream) embed ".PNG/" mid-path.
  if (/\.(png|jpg|jpeg|webp)(\?.*)?$/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes("assets.tcgdex.net")) {
    return `${trimmed.replace(/\/$/, "")}/${quality}.webp`;
  }

  return trimmed;
}

function buildTcgdexCdnUrl(item: ImageSource): string | null {
  const language = item.language?.trim();
  const setId = item.set_id?.replace(/^[a-z]{2}:/i, "").trim();
  const localId =
    item.local_id?.trim() ||
    item.card_code?.split("/")[0]?.trim() ||
    null;

  if (!language || !setId || !localId) {
    return null;
  }

  return `https://assets.tcgdex.net/${language}/${setId}/${localId}`;
}

export function resolveCollectionSearchImageUrl(
  item: ImageSource,
  quality: "low" | "high" = "low",
): string | null {
  const projected = item.projected_image_asset_path?.trim() ?? null;
  const raw =
    item.image_url?.trim() ||
    (projected && !projected.startsWith("/tcgdex/") ? projected : null) ||
    buildTcgdexCdnUrl(item) ||
    null;

  if (!raw) {
    return null;
  }

  const resolved = raw.startsWith("/") ? `${XMON_API_URL}${raw}` : raw;
  return resolveTcgdexImageUrl(resolved, quality);
}
