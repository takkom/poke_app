import { ThemeManagerProvider, useThemeManager } from '@/hooks/useThemeManager';
import { useI18n } from '@/i18n';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeManagerProvider>
        <RootStack />
      </ThemeManagerProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { colors } = useThemeManager();
  const { t } = useI18n();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: '700',
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="card/[id]"
        options={{
          title: t('tabs.cardDetails'),
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
