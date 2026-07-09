import { MostSoldArbitrageList } from "@/components/most-sold-arbitrage-list";
import { useThemeManager } from "@/hooks/useThemeManager";
import { useI18n } from "@/i18n";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeTab() {
  const router = useRouter();
  const { colors } = useThemeManager();
  const { t } = useI18n();
  const openCard = useCallback(
    (id: string, itemType: "card" | "box") => {
      if (itemType === "box") {
        router.push(`/box/${id}`);
      } else {
        router.push(`/card/${id}`);
      }
    },
    [router],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <MostSoldArbitrageList
        onPressCard={openCard}
        loadingLabel={t("home.loading")}
        unavailableLabel={t("home.unavailable")}
        avgUnavailableLabel={t("home.avgUnavailable")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
