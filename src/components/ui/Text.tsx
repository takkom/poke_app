import { getInterFontFamily } from "@/theme/typography";
import { forwardRef } from "react";
import { StyleSheet, Text as RNText, type TextProps } from "react-native";

/**
 * Drop-in replacement for React Native's `Text` that always renders with the
 * Inter font. The correct Inter weight is derived from `fontWeight` so
 * existing styles don't need to change, and any callers that want another
 * font can still override it via an explicit `fontFamily` in `style`.
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { style, ...rest },
  ref,
) {
  const { fontWeight, fontFamily, ...flattenedStyle } = StyleSheet.flatten(style) ?? {};

  return (
    <RNText
      ref={ref}
      {...rest}
      style={[flattenedStyle, { fontFamily: fontFamily ?? getInterFontFamily(fontWeight) }]}
    />
  );
});
