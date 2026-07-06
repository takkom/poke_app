import { XMON_API_URL } from "@/config";
import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleForgotPassword() {
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
    <View style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
        value={email}
      />
      {isSubmitting ? (
        <ActivityIndicator />
      ) : (
        <Button
          title="Send reset instructions"
          onPress={handleForgotPassword}
        />
      )}
      <Link href="/(auth)/login" style={styles.link}>
        Back to login
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  input: {
    borderColor: "#c8c8c8",
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
