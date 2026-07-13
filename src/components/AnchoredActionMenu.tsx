import { useThemeManager } from "@/hooks/useThemeManager";
import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type MenuAnchor = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type AnchoredActionMenuProps = {
  anchor: MenuAnchor | null;
  children: React.ReactNode;
  estimatedHeight?: number;
  extraBottom?: number;
  menuWidth?: number;
  onClose: () => void;
  visible: boolean;
};

export function AnchoredActionMenu({
  anchor,
  children,
  estimatedHeight = 120,
  extraBottom = 0,
  menuWidth = 220,
  onClose,
  visible,
}: AnchoredActionMenuProps) {
  const { colors } = useThemeManager();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  const menuStyle = useMemo<ViewStyle>(() => {
    if (!anchor) {
      return {};
    }

    const gap = 6;
    const horizontalPadding = 12;
    let top = anchor.top + anchor.height + gap;
    let left = anchor.left + anchor.width - menuWidth;

    const maxTop =
      screenHeight - insets.bottom - extraBottom - estimatedHeight - horizontalPadding;
    if (top > maxTop) {
      top = anchor.top - estimatedHeight - gap;
    }

    left = Math.max(
      insets.left + horizontalPadding,
      Math.min(left, screenWidth - menuWidth - insets.right - horizontalPadding),
    );
    top = Math.max(insets.top + horizontalPadding, top);

    return {
      left,
      position: "absolute",
      top,
      width: menuWidth,
    };
  }, [
    anchor,
    estimatedHeight,
    extraBottom,
    insets.bottom,
    insets.left,
    insets.right,
    insets.top,
    menuWidth,
    screenHeight,
    screenWidth,
  ]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible && Boolean(anchor)}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {anchor ? (
          <View
            style={[
              styles.menuContent,
              menuStyle,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {children}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.24)",
    flex: 1,
  },
  menuContent: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
  },
});
