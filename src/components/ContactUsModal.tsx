import { SUPPORT_EMAIL } from "@/constants/contact";
import { APP_VERSION } from "@/constants/version";
import * as Linking from "expo-linking";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

type ContactUsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ContactUsModal({ visible, onClose }: ContactUsModalProps) {
  async function handleEmailUs() {
    const subject = `Support request - PokeApp v${APP_VERSION}`;
    const body = `Hi PokeApp team,\n\n\n\n---\nApp version: ${APP_VERSION}\nPlatform: ${Platform.OS}`;
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      await Linking.openURL(mailtoUrl);
    } catch {
      Alert.alert(
        "No email app found",
        `Please reach out to us directly at ${SUPPORT_EMAIL}.`,
      );
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Contact Us</Text>
          <Text style={styles.modalText}>
            Have a question, found a bug, or want to suggest a feature? Our team
            usually replies within one to two business days.
          </Text>
          <View style={styles.emailRow}>
            <Text style={styles.emailLabel}>Support email</Text>
            <Text selectable style={styles.emailValue}>{SUPPORT_EMAIL}</Text>
          </View>
          <Pressable onPress={() => void handleEmailUs()} style={styles.emailButton}>
            <Text style={styles.emailButtonText}>Email us</Text>
          </Pressable>
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
    borderColor: "#c8c8c8",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  closeText: {
    color: "#1f2937",
    fontSize: 15,
    fontWeight: "800",
  },
  emailButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 6,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  emailButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  emailLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  emailRow: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    gap: 4,
    padding: 12,
  },
  emailValue: {
    color: "#111827",
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
    padding: 24,
    width: "100%",
  },
  modalText: {
    color: "#1f2937",
    fontSize: 14,
    lineHeight: 21,
  },
  modalTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
});
