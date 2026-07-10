import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type PrivacyPolicyModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Privacy Policy</Text>
          <ScrollView style={styles.scrollArea}>
            <Text style={styles.modalText}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer feugiat
              placerat tortor, vitae dignissim mauris tincidunt at. Donec volutpat
              posuere nibh, vitae blandit turpis facilisis vitae. Sed ac sem vitae
              lectus posuere consequat. Nulla facilisi. Praesent imperdiet, justo sed
              cursus aliquam, urna mi posuere erat, non luctus justo tortor sed nisl.
            </Text>
            <Text style={styles.modalText}>
              Curabitur feugiat, sem vitae pulvinar aliquet, magna nunc luctus justo,
              in luctus justo magna eget nibh. We collect only the account information
              needed to run your collection, keep it reasonably secure, and never sell
              it to third parties when future data-sharing rules become available.
            </Text>
          </ScrollView>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 6,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  closeText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 8,
    gap: 12,
    maxHeight: "80%",
    padding: 24,
    width: "100%",
  },
  modalText: {
    color: "#1f2937",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  modalTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
  scrollArea: {
    maxHeight: 300,
  },
});
