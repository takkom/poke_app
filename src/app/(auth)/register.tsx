import { useAuth } from "@/context/AuthContext";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
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

const USERNAME_PATTERN = /^[a-zA-Z0-9가-힣]+$/;

function usernameFromEmail(email: string): string {
  return email.split("@")[0]?.replace(/[^a-zA-Z0-9가-힣]/g, "") ?? "";
}

export default function RegisterScreen() {
  const { colors } = useThemeManager();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [isUsernameTouched, setIsUsernameTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTermsVisible, setIsTermsVisible] = useState(false);
  const [isPrivacyVisible, setIsPrivacyVisible] = useState(false);
  const usernameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  function handleEmailChange(value: string) {
    setEmail(value);

    if (!isUsernameTouched) {
      setUsername(usernameFromEmail(value));
    }
  }

  function handleUsernameChange(value: string) {
    setIsUsernameTouched(true);
    setUsername(value);
  }

  async function handleRegister() {
    const trimmedUsername = username.trim();

    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      Alert.alert(
        "Invalid username",
        "Use only English letters, numbers, and Korean Hangul.",
      );
      return;
    }

    if (!hasAcceptedTerms) {
      Alert.alert("Terms required", "Please agree to the Terms of Service before creating an account.");
      return;
    }

    if (!hasAcceptedPrivacy) {
      Alert.alert("Privacy Policy required", "Please agree to the Privacy Policy before creating an account.");
      return;
    }

    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      await register(email.trim(), password, trimmedUsername);
    } catch (error) {
      Alert.alert("Registration failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Create account</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={handleEmailChange}
        onSubmitEditing={() => usernameInputRef.current?.focus()}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        returnKeyType="next"
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        submitBehavior="submit"
        value={email}
      />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={handleUsernameChange}
        onSubmitEditing={() => passwordInputRef.current?.focus()}
        placeholder="Username"
        placeholderTextColor={colors.textMuted}
        ref={usernameInputRef}
        returnKeyType="next"
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        submitBehavior="submit"
        value={username}
      />
      <TextInput
        autoComplete="new-password"
        onChangeText={setPassword}
        onSubmitEditing={handleRegister}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        ref={passwordInputRef}
        returnKeyType="done"
        secureTextEntry
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        value={password}
      />
      <Pressable
        onPress={() => setHasAcceptedTerms((accepted) => !accepted)}
        style={styles.termsRow}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.border },
            hasAcceptedTerms && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          {hasAcceptedTerms ? <View style={[styles.checkmark, { backgroundColor: colors.onPrimary }]} /> : null}
        </View>
        <Text style={[styles.termsText, { color: colors.textSecondary }]}>I agree to the </Text>
        <Pressable onPress={() => setIsTermsVisible(true)}>
          <Text style={[styles.termsLink, { color: colors.primary }]}>Terms of Service</Text>
        </Pressable>
      </Pressable>
      <Pressable
        onPress={() => setHasAcceptedPrivacy((accepted) => !accepted)}
        style={styles.termsRow}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.border },
            hasAcceptedPrivacy && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          {hasAcceptedPrivacy ? <View style={[styles.checkmark, { backgroundColor: colors.onPrimary }]} /> : null}
        </View>
        <Text style={[styles.termsText, { color: colors.textSecondary }]}>I agree to the </Text>
        <Pressable onPress={() => setIsPrivacyVisible(true)}>
          <Text style={[styles.termsLink, { color: colors.primary }]}>Privacy Policy</Text>
        </Pressable>
      </Pressable>
      {isSubmitting ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Pressable
          onPress={handleRegister}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Create account</Text>
        </Pressable>
      )}
      <Link href="/(auth)/login" style={[styles.link, { color: colors.primary }]}>
        Already have an account?
      </Link>

      <TermsOfServiceModal
        onClose={() => setIsTermsVisible(false)}
        visible={isTermsVisible}
      />
      <PrivacyPolicyModal
        onClose={() => setIsPrivacyVisible(false)}
        visible={isPrivacyVisible}
      />
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
  checkbox: {
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkmark: {
    borderRadius: 3,
    height: 8,
    width: 8,
  },
  termsLink: {
    fontWeight: "800",
  },
  termsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  termsText: {},
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
});
