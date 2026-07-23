import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import { ColorSchemeName, useColorScheme } from "react-native";

import { AppColors, darkColors, lightColors, ThemeMode } from "@/theme/colors";

export type ThemePreference = "system" | ThemeMode;
export type AppLocale = "en-US" | "ko-KR";
export type DisplayCurrency = "USD" | "KRW";

export type UserPreferences = {
  preference: ThemePreference;
  locale: AppLocale;
  displayCurrency: DisplayCurrency;
};

type ThemeManagerValue = {
  colors: AppColors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  mode: ThemeMode;
  systemScheme: ColorSchemeName;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  applyPreferences: (prefs: Partial<UserPreferences>) => void;
  preferencesReady: boolean;
};

const PREFS_KEY = "xmon.prefs";
const DEFAULT_PREFS: UserPreferences = {
  preference: "system",
  locale: "ko-KR",
  displayCurrency: "KRW",
};

const ThemeManagerContext = createContext<ThemeManagerValue | null>(null);

function resolveMode(
  preference: ThemePreference,
  systemScheme: ColorSchemeName,
): ThemeMode {
  if (preference !== "system") {
    return preference;
  }

  return systemScheme === "dark" ? "dark" : "light";
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isAppLocale(value: unknown): value is AppLocale {
  return value === "en-US" || value === "ko-KR";
}

function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return value === "USD" || value === "KRW";
}

function parseStoredPrefs(raw: string | null): UserPreferences {
  if (!raw) {
    return DEFAULT_PREFS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      preference: isThemePreference(parsed.preference)
        ? parsed.preference
        : DEFAULT_PREFS.preference,
      locale: isAppLocale(parsed.locale) ? parsed.locale : DEFAULT_PREFS.locale,
      displayCurrency: isDisplayCurrency(parsed.displayCurrency)
        ? parsed.displayCurrency
        : DEFAULT_PREFS.displayCurrency,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function ThemeManagerProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] =
    useState<ThemePreference>(DEFAULT_PREFS.preference);
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_PREFS.locale);
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>(
    DEFAULT_PREFS.displayCurrency,
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const mode = resolveMode(preference, systemScheme);
  const activeColors = mode === "dark" ? darkColors : lightColors;

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const raw = await SecureStore.getItemAsync(PREFS_KEY);
        if (!mounted) {
          return;
        }
        const prefs = parseStoredPrefs(raw);
        setPreferenceState(prefs.preference);
        setLocaleState(prefs.locale);
        setDisplayCurrencyState(prefs.displayCurrency);
      } finally {
        if (mounted) {
          setPreferencesReady(true);
        }
      }
    }

    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const persistPrefs = useCallback(async (prefs: UserPreferences) => {
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
  }, []);

  const applyPreferences = useCallback(
    (prefs: Partial<UserPreferences>) => {
      setPreferenceState((currentPreference) => {
        const nextPreference = prefs.preference ?? currentPreference;
        setLocaleState((currentLocale) => {
          const nextLocale = prefs.locale ?? currentLocale;
          setDisplayCurrencyState((currentCurrency) => {
            const nextCurrency = prefs.displayCurrency ?? currentCurrency;
            void persistPrefs({
              preference: nextPreference,
              locale: nextLocale,
              displayCurrency: nextCurrency,
            });
            return nextCurrency;
          });
          return nextLocale;
        });
        return nextPreference;
      });
    },
    [persistPrefs],
  );

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      void persistPrefs({
        preference: next,
        locale,
        displayCurrency,
      });
    },
    [displayCurrency, locale, persistPrefs],
  );

  const setLocale = useCallback(
    (next: AppLocale) => {
      setLocaleState(next);
      void persistPrefs({
        preference,
        locale: next,
        displayCurrency,
      });
    },
    [displayCurrency, persistPrefs, preference],
  );

  const setDisplayCurrency = useCallback(
    (next: DisplayCurrency) => {
      setDisplayCurrencyState(next);
      void persistPrefs({
        preference,
        locale,
        displayCurrency: next,
      });
    },
    [locale, persistPrefs, preference],
  );

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
      locale,
      setLocale,
      displayCurrency,
      setDisplayCurrency,
      applyPreferences,
      preferencesReady,
    }),
    [
      activeColors,
      applyPreferences,
      displayCurrency,
      locale,
      mode,
      preference,
      preferencesReady,
      setDisplayCurrency,
      setLocale,
      setPreference,
      systemScheme,
    ],
  );

  return React.createElement(ThemeManagerContext.Provider, { value }, children);
}

export function useThemeManager() {
  const context = useContext(ThemeManagerContext);

  if (!context) {
    throw new Error("useThemeManager must be used inside ThemeManagerProvider");
  }

  return context;
}
