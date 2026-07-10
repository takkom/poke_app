import { useAuth } from "@/context/AuthContext";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { Link } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const USERNAME_PATTERN = /^[a-zA-Z0-9가-힣]+$/;

function usernameFromEmail(email: string): string {
  return email.split("@")[0]?.replace(/[^a-zA-Z0-9가-힣]/g, "") ?? "";
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [isUsernameTouched, setIsUsernameTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTermsVisible, setIsTermsVisible] = useState(false);
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
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={handleEmailChange}
        onSubmitEditing={() => usernameInputRef.current?.focus()}
        placeholder="Email"
        returnKeyType="next"
        style={styles.input}
        submitBehavior="submit"
        value={email}
      />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={handleUsernameChange}
        onSubmitEditing={() => passwordInputRef.current?.focus()}
        placeholder="Username"
        ref={usernameInputRef}
        returnKeyType="next"
        style={styles.input}
        submitBehavior="submit"
        value={username}
      />
      <TextInput
        autoComplete="new-password"
        onChangeText={setPassword}
        onSubmitEditing={handleRegister}
        placeholder="Password"
        ref={passwordInputRef}
        returnKeyType="done"
        secureTextEntry
        style={styles.input}
        value={password}
      />
      <Pressable
        onPress={() => setHasAcceptedTerms((accepted) => !accepted)}
        style={styles.termsRow}
      >
        <View style={[styles.checkbox, hasAcceptedTerms && styles.checkboxChecked]}>
          {hasAcceptedTerms ? <View style={styles.checkmark} /> : null}
        </View>
        <Text style={styles.termsText}>I agree to the </Text>
        <Pressable onPress={() => setIsTermsVisible(true)}>
          <Text style={styles.termsLink}>Terms of Service</Text>
        </Pressable>
      </Pressable>
      {isSubmitting ? (
        <ActivityIndicator />
      ) : (
        <Button title="Create account" onPress={handleRegister} />
      )}
      <Link href="/(auth)/login" style={styles.link}>
        Already have an account?
      </Link>

      <TermsOfServiceModal
        onClose={() => setIsTermsVisible(false)}
        visible={isTermsVisible}
      />
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
  checkbox: {
    alignItems: "center",
    borderColor: "#7a7a7a",
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  checkmark: {
    backgroundColor: "#ffffff",
    borderRadius: 3,
    height: 8,
    width: 8,
  },
  termsLink: {
    color: "#2563eb",
    fontWeight: "800",
  },
  termsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  termsText: {
    color: "#333333",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
});
