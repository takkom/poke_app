import { useAuth } from "@/context/AuthContext";
import { APP_VERSION } from "@/constants/version";
import { useThemeManager } from "@/hooks/useThemeManager";
import { Text } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { Link } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function LoginScreen() {
  const { colors } = useThemeManager();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

  async function handleLogin() {
    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Log in</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        onSubmitEditing={() => passwordInputRef.current?.focus()}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        returnKeyType="next"
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        submitBehavior="submit"
        value={email}
      />
      <TextInput
        autoComplete="password"
        onChangeText={setPassword}
        onSubmitEditing={handleLogin}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        ref={passwordInputRef}
        returnKeyType="done"
        secureTextEntry
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        value={password}
      />
      {isSubmitting ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Pressable
          onPress={handleLogin}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Log in</Text>
        </Pressable>
      )}
      <Link href="/(auth)/register" style={[styles.link, { color: colors.primary }]}>
        Create account
      </Link>
      <Link href="/(auth)/forgot-password" style={[styles.link, { color: colors.primary }]}>
        Forgot password?
      </Link>
      <Text style={[styles.version, { color: colors.textMuted }]}>v{APP_VERSION}</Text>
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
  version: {
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
  },
});
