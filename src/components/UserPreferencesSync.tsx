import { useAuth } from "@/context/AuthContext";
import { useThemeManager } from "@/hooks/useThemeManager";
import { useEffect, useRef } from "react";

/**
 * Keeps local theme/locale/currency in sync with the signed-in user profile.
 * Profile wins on login/hydrate; local changes are PATCHed back to the API.
 */
export function UserPreferencesSync() {
  const { user, token, updatePreferences, isLoading } = useAuth();
  const {
    preference,
    locale,
    displayCurrency,
    applyPreferences,
    preferencesReady,
  } = useThemeManager();
  const applyingFromProfileRef = useRef(false);
  const lastAppliedUserKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !preferencesReady || !user) {
      if (!user) {
        lastAppliedUserKeyRef.current = null;
      }
      return;
    }

    const key = [
      user.id,
      user.theme_preference ?? "",
      user.locale ?? "",
      user.display_currency ?? "",
    ].join("|");

    if (lastAppliedUserKeyRef.current === key) {
      return;
    }

    if (
      !user.theme_preference &&
      !user.locale &&
      !user.display_currency
    ) {
      return;
    }

    applyingFromProfileRef.current = true;
    lastAppliedUserKeyRef.current = key;
    applyPreferences({
      preference: user.theme_preference,
      locale: user.locale,
      displayCurrency: user.display_currency,
    });

    const timer = setTimeout(() => {
      applyingFromProfileRef.current = false;
    }, 0);

    return () => {
      clearTimeout(timer);
      applyingFromProfileRef.current = false;
    };
  }, [applyPreferences, isLoading, preferencesReady, user]);

  useEffect(() => {
    if (
      isLoading ||
      !preferencesReady ||
      !token ||
      !user ||
      applyingFromProfileRef.current
    ) {
      return;
    }

    const matchesProfile =
      preference === (user.theme_preference ?? preference) &&
      locale === (user.locale ?? locale) &&
      displayCurrency === (user.display_currency ?? displayCurrency);

    if (matchesProfile) {
      return;
    }

    const timer = setTimeout(() => {
      void updatePreferences({
        theme_preference: preference,
        locale,
        display_currency: displayCurrency,
      }).catch(() => {
        // Keep local prefs if the network write fails; next launch retries.
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [
    displayCurrency,
    isLoading,
    locale,
    preference,
    preferencesReady,
    token,
    updatePreferences,
    user,
  ]);

  return null;
}
