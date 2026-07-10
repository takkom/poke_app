import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeManager } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { AppColors } from "@/theme/colors";
import { QualityBucket, QualityBucketCode } from "@/types/card";

type QualitySelectorProps = {
  qualities: QualityBucket[];
  selected: QualityBucketCode[];
  onToggle: (code: QualityBucketCode) => void;
  locale?: string;
};

export function QualitySelector({
  qualities,
  selected,
  onToggle,
  locale = "ko-KR",
}: QualitySelectorProps) {
  const { t } = useI18n();
  const { colors } = useThemeManager();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const available = qualities.filter((quality) => quality.count > 0);
  if (!available.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{t("chart.selectQuality")}</Text>
      <View style={styles.row}>
        {available.map((quality) => {
          const active = selected.includes(quality.code);
          return (
            <Pressable
              key={quality.code}
              onPress={() => onToggle(quality.code)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.surfaceMuted,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? colors.onPrimary : colors.textSecondary },
                ]}
              >
                {quality.label}
              </Text>
              <Text
                style={[
                  styles.chipCount,
                  { color: active ? colors.onPrimary : colors.textMuted },
                ]}
              >
                {quality.count.toLocaleString(locale)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: 8,
    },
    eyebrow: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "800",
    },
    chipCount: {
      fontSize: 11,
      fontWeight: "700",
    },
  });
}
