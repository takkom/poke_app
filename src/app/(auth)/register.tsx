import { useAuth } from "@/context/AuthContext";
import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTermsVisible, setIsTermsVisible] = useState(false);

  async function handleRegister() {
    setIsSubmitting(true);

    try {
      await register(email.trim(), password);
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
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
        value={email}
      />
      <TextInput
        autoComplete="new-password"
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
      />
      <Pressable onPress={() => setIsTermsVisible(true)}>
        <Text style={styles.link}>View Terms of Service</Text>
      </Pressable>
      {isSubmitting ? (
        <ActivityIndicator />
      ) : (
        <Button title="Create account" onPress={handleRegister} />
      )}
      <Link href="/(auth)/login" style={styles.link}>
        Already have an account?
      </Link>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsTermsVisible(false)}
        transparent
        visible={isTermsVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Terms of Service</Text>
            <Text style={styles.modalText}>
              By creating an account, you agree to use this app responsibly and follow the
              posted service terms.
            </Text>
            <Button title="Close" onPress={() => setIsTermsVisible(false)} />
          </View>
        </View>
      </Modal>
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
    lineHeight: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
});
