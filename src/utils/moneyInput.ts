import type { DisplayCurrency } from "@/hooks/useThemeManager";

function stripMoneyInput(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

export function parseMoneyInput(value: string): number | null {
  const cleaned = stripMoneyInput(value.trim());
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoneyInput(
  value: string,
  locale: string,
  displayCurrency: DisplayCurrency,
): string {
  const cleaned = stripMoneyInput(value);
  if (!cleaned) {
    return "";
  }

  const [integerPart = "", fractionalPart] = cleaned.split(".");
  const integerDigits = integerPart.replace(/^0+(?=\d)/, "") || (integerPart ? "0" : "");
  if (!integerDigits && fractionalPart === undefined) {
    return "";
  }

  const formattedInteger = integerDigits
    ? new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
      }).format(Number(integerDigits))
    : "0";

  if (displayCurrency === "KRW") {
    return formattedInteger;
  }

  if (fractionalPart !== undefined) {
    return `${formattedInteger}.${fractionalPart.slice(0, 2)}`;
  }

  return formattedInteger;
}

export function formatMoneyInputFromNumber(
  value: number | string | null | undefined,
  locale: string,
  displayCurrency: DisplayCurrency,
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  const raw =
    displayCurrency === "KRW"
      ? String(Math.round(numeric))
      : numeric.toFixed(2).replace(/\.?0+$/, "");

  return formatMoneyInput(raw, locale, displayCurrency);
}
