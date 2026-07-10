import { JaruLogo } from '@/components/JaruLogo';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeManagerProvider, useThemeManager } from '@/hooks/useThemeManager';
import { useI18n } from '@/i18n';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeManagerProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </ThemeManagerProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { colors, mode } = useThemeManager();
  const { t } = useI18n();
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isAuthRoute = segments[0] === '(auth)';

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!token && !isAuthRoute) {
      router.replace('/(auth)/login');
      return;
    }

    if (token && isAuthRoute) {
      router.replace('/(tabs)');
    }
  }, [isAuthRoute, isLoading, router, token]);

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
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
          headerTitleAlign: 'left',
          headerTitle: () => <JaruLogo />,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="card/[id]"
          options={{
            title: t('tabs.cardDetails'),
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="box/[id]"
          options={{
            title: t('box.details'),
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="collections/[id]"
          options={{
            title: t('collections.collection'),
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="collections/[id]/add"
          options={{
            title: t('collections.addItem'),
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
      {isLoading ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </>
  );
}
