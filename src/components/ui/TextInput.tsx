import { getInterFontFamily } from "@/theme/typography";
import { forwardRef } from "react";
import { StyleSheet, TextInput as RNTextInput, type TextInput as RNTextInputInstance, type TextInputProps } from "react-native";

/**
 * Drop-in replacement for React Native's `TextInput` that always renders
 * with the Inter font, mirroring `src/components/ui/Text.tsx`.
 */
export const TextInput = forwardRef<RNTextInputInstance, TextInputProps>(function TextInput(
  { style, ...rest },
  ref,
) {
  const { fontWeight, fontFamily, ...flattenedStyle } = StyleSheet.flatten(style) ?? {};

  return (
    <RNTextInput
      ref={ref}
      {...rest}
      style={[flattenedStyle, { fontFamily: fontFamily ?? getInterFontFamily(fontWeight) }]}
    />
  );
});

// Allows `useRef<TextInput>(null)` to keep working the same way it did when
// `TextInput` was imported directly from `react-native`.
export type TextInput = RNTextInputInstance;
