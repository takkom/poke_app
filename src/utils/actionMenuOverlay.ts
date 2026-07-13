import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EDGE_PADDING = 16;
const TAB_BAR_HEIGHT = 49;

export function useActionMenuOverlayInsets(extraBottom = 0) {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => ({
      paddingTop: Math.max(insets.top, EDGE_PADDING),
      paddingRight: Math.max(insets.right, EDGE_PADDING),
      paddingLeft: Math.max(insets.left, EDGE_PADDING),
      paddingBottom: Math.max(insets.bottom, EDGE_PADDING) + extraBottom,
    }),
    [extraBottom, insets.bottom, insets.left, insets.right, insets.top],
  );
}

export function useTabScreenActionMenuOverlayInsets() {
  return useActionMenuOverlayInsets(TAB_BAR_HEIGHT);
}
