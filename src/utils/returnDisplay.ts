import type { AppColors } from "@/theme/colors";

export function getReturnColor(
  colors: AppColors,
  value: number | null | undefined,
): string {
  if (value == null || value === 0) {
    return colors.textSecondary;
  }

  return value > 0 ? colors.arbitragePositive : colors.arbitrageNegative;
}
