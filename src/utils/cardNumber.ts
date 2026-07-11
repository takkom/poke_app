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

function normalizeDisplayNumber(
  cardCode?: string | null,
  localId?: string | null,
): string {
  const slashCode = cardCode?.match(/\b([A-Z]*\d+|SV\d+)\s*\/\s*(\d+)\b/i);
  if (slashCode) {
    return `${slashCode[1].toUpperCase()}/${slashCode[2]}`;
  }

  if (cardCode?.includes("/")) {
    return cardCode;
  }

  return localId ?? cardCode ?? "";
}

function appendSetTotal(number: string, total?: number): string {
  if (!total || !/^\d+$/.test(number)) {
    return number;
  }

  const paddedTotal = String(total).padStart(
    Math.max(3, String(total).length),
    "0",
  );
  const paddedNumber = number.padStart(paddedTotal.length, "0");
  return `${paddedNumber}/${paddedTotal}`;
}

export function resolveCardDisplayNumber(fields: CardNumberFields): string {
  const fromCode = normalizeDisplayNumber(fields.card_code, fields.local_id);
  const rawNumber =
    typeof fields.number === "string" ? fields.number.trim() : "";

  if (rawNumber.includes("/")) {
    return rawNumber;
  }

  if (fromCode.includes("/") || (fromCode && fromCode !== rawNumber)) {
    return fromCode;
  }

  if (fromCode) {
    return fromCode;
  }

  if (rawNumber) {
    const total =
      fields.set?.cardCount?.total || fields.set?.cardCount?.official;
    return appendSetTotal(rawNumber, total);
  }

  return "";
}
