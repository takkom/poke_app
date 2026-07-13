import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SystemUI from 'expo-system-ui';
import { ColorSchemeName, useColorScheme } from 'react-native';

import { AppColors, darkColors, lightColors, ThemeMode } from '@/theme/colors';

export type ThemePreference = 'system' | ThemeMode;
export type SearchMode = 'local' | 'tcgdex';
export type AppLocale = 'en-US' | 'ko-KR';
export type DisplayCurrency = 'USD' | 'KRW';

type ThemeManagerValue = {
  colors: AppColors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  mode: ThemeMode;
  systemScheme: ColorSchemeName;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
};

const ThemeManagerContext = createContext<ThemeManagerValue | null>(null);

function resolveMode(preference: ThemePreference, systemScheme: ColorSchemeName): ThemeMode {
  if (preference !== 'system') {
    return preference;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeManagerProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [searchMode, setSearchMode] = useState<SearchMode>('local');
  const [locale, setLocale] = useState<AppLocale>('ko-KR');
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('KRW');
  const mode = resolveMode(preference, systemScheme);
  const activeColors = mode === 'dark' ? darkColors : lightColors;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(activeColors.background);
  }, [activeColors.background]);

  const value = useMemo<ThemeManagerValue>(
    () => ({
      colors: activeColors,
      preference,
      setPreference,
      mode,
      systemScheme,
      searchMode,
      setSearchMode,
      locale,
      setLocale,
      displayCurrency,
      setDisplayCurrency,
    }),
    [activeColors, displayCurrency, locale, mode, preference, searchMode, systemScheme],
  );

  return React.createElement(ThemeManagerContext.Provider, { value }, children);
}

export function useThemeManager() {
  const context = useContext(ThemeManagerContext);

  if (!context) {
    throw new Error('useThemeManager must be used inside ThemeManagerProvider');
  }

  return context;
}
