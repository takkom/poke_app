import { XMON_API_URL } from "@/config";
import { useThemeManager } from "@/hooks/useThemeManager";
import { Text } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function ForgotPasswordScreen() {
  const { colors } = useThemeManager();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleForgotPassword() {
    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${XMON_API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.message ?? "Unable to request a reset right now.",
        );
      }

      Alert.alert(
        "Check your email",
        data?.message ?? "Password reset requested.",
      );
    } catch (error) {
      Alert.alert(
        "Request failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Reset password</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        onSubmitEditing={handleForgotPassword}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        returnKeyType="send"
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        value={email}
      />
      {isSubmitting ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Pressable
          onPress={handleForgotPassword}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
            Send reset instructions
          </Text>
        </Pressable>
      )}
      <Link href="/(auth)/login" style={[styles.link, { color: colors.primary }]}>
        Back to login
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  container: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  input: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 12,
  },
  link: {
    marginTop: 8,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
});
