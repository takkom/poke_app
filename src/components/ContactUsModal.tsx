import { SUPPORT_EMAIL } from "@/constants/contact";
import { APP_VERSION } from "@/constants/version";
import { useThemeManager } from "@/hooks/useThemeManager";
import * as Linking from "expo-linking";
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";

type ContactUsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ContactUsModal({ visible, onClose }: ContactUsModalProps) {
  const { colors } = useThemeManager();

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
      <View style={[styles.modalBackdrop, { backgroundColor: colors.overlayStrong }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Contact Us</Text>
          <Text style={[styles.modalText, { color: colors.textSecondary }]}>
            Have a question, found a bug, or want to suggest a feature? Our team
            usually replies within one to two business days.
          </Text>
          <View style={[styles.emailRow, { backgroundColor: colors.surfaceAlternate }]}>
            <Text style={[styles.emailLabel, { color: colors.textSecondary }]}>Support email</Text>
            <Text selectable style={[styles.emailValue, { color: colors.textPrimary }]}>{SUPPORT_EMAIL}</Text>
          </View>
          <Pressable
            onPress={() => void handleEmailUs()}
            style={[styles.emailButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.emailButtonText, { color: colors.onPrimary }]}>Email us</Text>
          </Pressable>
          <Pressable onPress={onClose} style={[styles.closeButton, { borderColor: colors.border }]}>
            <Text style={[styles.closeText, { color: colors.textPrimary }]}>Close</Text>
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
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  closeText: {
    fontSize: 15,
    fontWeight: "800",
  },
  emailButton: {
    alignItems: "center",
    borderRadius: 6,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  emailButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  emailLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  emailRow: {
    borderRadius: 6,
    gap: 4,
    padding: 12,
  },
  emailValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  modalBackdrop: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 8,
    gap: 12,
    padding: 24,
    width: "100%",
  },
  modalText: {
    fontSize: 14,
    lineHeight: 21,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
});
