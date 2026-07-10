/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { darkColors, lightColors } from '@/theme/colors';
import { FontFamily } from '@/theme/typography';

export const Colors = {
  light: {
    text: lightColors.textPrimary,
    background: lightColors.background,
    backgroundElement: lightColors.surface,
    backgroundAlternate: lightColors.surfaceAlternate,
    backgroundSelected: lightColors.surfaceMuted,
    textSecondary: lightColors.textSecondary,
  },
  dark: {
    text: darkColors.textPrimary,
    background: darkColors.background,
    backgroundElement: darkColors.surface,
    backgroundAlternate: darkColors.surfaceAlternate,
    backgroundSelected: darkColors.surfaceMuted,
    textSecondary: darkColors.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Inter is the only typeface used across the app; see `src/theme/typography.ts`.
export const Fonts = Platform.select({
  default: {
    sans: FontFamily.regular,
    serif: FontFamily.regular,
    rounded: FontFamily.regular,
    mono: FontFamily.regular,
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-display)',
    rounded: 'var(--font-display)',
    mono: 'var(--font-display)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
