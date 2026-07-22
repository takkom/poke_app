import type { QualityBucketCode } from "@/types/card";

export const QUALITY_BUCKET_OPTIONS: {
  code: QualityBucketCode;
  labelKey:
    | "quality.raw"
    | "quality.psa10"
    | "quality.psa9"
    | "quality.psa8OrLower"
    | "quality.otherGraded";
}[] = [
  { code: "RAW", labelKey: "quality.raw" },
  { code: "PSA_10", labelKey: "quality.psa10" },
  { code: "PSA_9", labelKey: "quality.psa9" },
  { code: "PSA_8_OR_LOWER", labelKey: "quality.psa8OrLower" },
  { code: "OTHER_GRADED", labelKey: "quality.otherGraded" },
];

export function qualityBucketLabelKey(
  code: QualityBucketCode | string | null | undefined,
): (typeof QUALITY_BUCKET_OPTIONS)[number]["labelKey"] | null {
  const match = QUALITY_BUCKET_OPTIONS.find((option) => option.code === code);
  return match?.labelKey ?? null;
}
