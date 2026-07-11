type CardNumberFields = {
  number?: string | null;
  card_code?: string | null;
  local_id?: string | null;
  set?: {
    cardCount?: {
      official?: number;
      total?: number;
    };
  };
};

function resolveSetTotal(fields: CardNumberFields): number | undefined {
  return fields.set?.cardCount?.total || fields.set?.cardCount?.official;
}

function formatSlashCardNumber(
  numerator: string,
  denominator: string,
  setTotal?: number,
): string {
  const num = numerator.trim();
  const den = denominator.trim();
  const totalHint = setTotal ? String(setTotal) : den;
  const padWidth = Math.max(
    3,
    /^\d+$/.test(num) ? num.length : 0,
    /^\d+$/.test(den) ? den.length : 0,
    /^\d+$/.test(totalHint) ? totalHint.length : 0,
  );

  const formatPart = (part: string) =>
    /^\d+$/.test(part) ? part.padStart(padWidth, "0") : part;

  return `${formatPart(num)}/${formatPart(den)}`;
}

function normalizeSlashNumber(value: string, setTotal?: number): string {
  const trimmed = value.trim();
  const slashMatch = trimmed.match(/^([A-Za-z]*\d+)\s*\/\s*(\d+)$/i);
  if (slashMatch) {
    return formatSlashCardNumber(slashMatch[1], slashMatch[2], setTotal);
  }

  const genericSlash = trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (genericSlash) {
    return formatSlashCardNumber(genericSlash[1], genericSlash[2], setTotal);
  }

  return trimmed;
}

function normalizeDisplayNumber(
  cardCode?: string | null,
  localId?: string | null,
  setTotal?: number,
): string {
  const slashCode = cardCode?.match(/\b([A-Z]*\d+|SV\d+)\s*\/\s*(\d+)\b/i);
  if (slashCode) {
    return formatSlashCardNumber(slashCode[1], slashCode[2], setTotal);
  }

  if (cardCode?.includes("/")) {
    return normalizeSlashNumber(cardCode, setTotal);
  }

  return localId ?? cardCode ?? "";
}

function appendSetTotal(number: string, total?: number): string {
  if (!total || !/^\d+$/.test(number)) {
    return number;
  }

  return formatSlashCardNumber(number, String(total), total);
}

export function resolveCardDisplayNumber(fields: CardNumberFields): string {
  const setTotal = resolveSetTotal(fields);
  const rawNumber =
    typeof fields.number === "string" ? fields.number.trim() : "";

  if (rawNumber.includes("/")) {
    return normalizeSlashNumber(rawNumber, setTotal);
  }

  const fromCode = normalizeDisplayNumber(
    fields.card_code,
    fields.local_id,
    setTotal,
  );

  if (fromCode.includes("/") || (fromCode && fromCode !== rawNumber)) {
    return fromCode.includes("/")
      ? normalizeSlashNumber(fromCode, setTotal)
      : fromCode;
  }

  if (fromCode) {
    return fromCode;
  }

  if (rawNumber) {
    return appendSetTotal(rawNumber, setTotal);
  }

  return "";
}
