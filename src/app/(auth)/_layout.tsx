import { JaruLogo } from "@/components/JaruLogo";
import { useThemeManager } from "@/hooks/useThemeManager";
import { Stack } from "expo-router";

export default function AuthLayout() {
  const { colors } = useThemeManager();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          color: colors.textPrimary,
          fontWeight: "800",
        },
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitle: () => <JaruLogo />,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Log in" }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
    </Stack>
  );
}
