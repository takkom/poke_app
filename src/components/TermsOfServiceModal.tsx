import { useThemeManager } from "@/hooks/useThemeManager";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";

type TermsOfServiceModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function TermsOfServiceModal({ visible, onClose }: TermsOfServiceModalProps) {
  const { colors } = useThemeManager();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Terms of Service</Text>
          <ScrollView style={styles.scrollArea}>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer feugiat
              placerat tortor, vitae dignissim mauris tincidunt at. Donec volutpat
              posuere nibh, vitae blandit turpis facilisis vitae. Sed ac sem vitae
              lectus posuere consequat. Nulla facilisi. Praesent imperdiet, justo sed
              cursus aliquam, urna mi posuere erat, non luctus justo tortor sed nisl.
            </Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Curabitur feugiat, sem vitae pulvinar aliquet, magna nunc luctus justo,
              in luctus justo magna eget nibh. Users agree to keep their account
              information accurate, respect other collectors, and follow future trading
              rules when they become available.
            </Text>
          </ScrollView>
          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.closeText, { color: colors.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: "center",
    borderRadius: 6,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  closeText: {
    fontSize: 15,
    fontWeight: "800",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 8,
    gap: 12,
    maxHeight: "80%",
    padding: 24,
    width: "100%",
  },
  modalText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  scrollArea: {
    maxHeight: 300,
  },
});
