import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createHaziAccount, signInWithEmail } from "../lib/auth";
import { colors } from "../theme";

type AuthScreenProps = { onClose: () => void; onAuthenticated: () => void };

export function AuthScreen({ onClose, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);
    if (!email.trim() || !password) return setError("Enter your email and password.");
    if (mode === "signup" && !fullName.trim()) return setError("Enter your full name.");
    if (mode === "signup" && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/.test(password)) {
      return setError("Use at least 8 characters with uppercase, lowercase, number, and symbol.");
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
        onAuthenticated();
      } else {
        const data = await createHaziAccount(fullName, email, password);
        if (data.session) onAuthenticated();
        else setMessage("Account created. Check your email to confirm it, then sign in.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}><View style={styles.logo}><Text style={styles.logoText}>hazi</Text></View><Pressable accessibilityLabel="Close authentication" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></Pressable></View>
        <View style={styles.trust}><Ionicons name="shield-checkmark" size={30} color={colors.success} /><Text style={styles.trustTitle}>Your trusted Hazi account</Text><Text style={styles.trustCopy}>Sign in to bid, sell, verify, fund your wallet, and manage protected auctions.</Text></View>
        <View style={styles.switcher}><Pressable onPress={() => { setMode("signin"); setError(null); }} style={[styles.switch, mode === "signin" && styles.switchActive]}><Text style={[styles.switchText, mode === "signin" && styles.switchTextActive]}>Sign in</Text></Pressable><Pressable onPress={() => { setMode("signup"); setError(null); }} style={[styles.switch, mode === "signup" && styles.switchActive]}><Text style={[styles.switchText, mode === "signup" && styles.switchTextActive]}>Create account</Text></Pressable></View>
        {mode === "signup" ? <Field icon="person-outline" placeholder="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" /> : null}
        <Field icon="mail-outline" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
        {mode === "signup" ? <Text style={styles.passwordHint}>At least 8 characters with uppercase, lowercase, number, and symbol.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable accessibilityRole="button" disabled={loading} onPress={submit} style={[styles.primaryButton, loading && styles.disabled]}>{loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{mode === "signin" ? "Sign in securely" : "Create Hazi account"}</Text>}</Pressable>
        <Text style={styles.legal}>By continuing, you agree to Hazi’s marketplace terms and privacy policy.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { icon: keyof typeof Ionicons.glyphMap };
function Field({ icon, ...props }: FieldProps) {
  return <View style={styles.field}><Ionicons name={icon} size={20} color={colors.muted} /><TextInput {...props} placeholderTextColor={colors.muted} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, padding: 20, paddingBottom: 38 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, logo: { width: 84, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }, logoText: { color: colors.white, fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -1.5 }, close: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  trust: { backgroundColor: colors.primary, borderRadius: 26, padding: 24, marginTop: 25 }, trustTitle: { color: colors.white, fontSize: 26, lineHeight: 31, fontWeight: "900", marginTop: 18 }, trustCopy: { color: "#bcebdd", fontSize: 13, lineHeight: 20, marginTop: 8 },
  switcher: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 17, padding: 4, marginTop: 20, marginBottom: 14 }, switch: { flex: 1, padding: 12, borderRadius: 14, alignItems: "center" }, switchActive: { backgroundColor: colors.primarySoft }, switchText: { color: colors.muted, fontSize: 13, fontWeight: "800" }, switchTextActive: { color: colors.success },
  field: { flexDirection: "row", alignItems: "center", gap: 10, height: 56, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingHorizontal: 15, marginTop: 10 }, input: { flex: 1, color: colors.text, fontSize: 15 }, passwordHint: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  error: { color: "#ffb4ab", backgroundColor: "#3b2021", borderRadius: 14, padding: 13, fontSize: 12, lineHeight: 18, marginTop: 13 }, message: { color: "#bcebdd", backgroundColor: colors.primarySoft, borderRadius: 14, padding: 13, fontSize: 12, lineHeight: 18, marginTop: 13 },
  primaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 18 }, disabled: { opacity: 0.65 }, primaryText: { color: colors.white, fontSize: 15, fontWeight: "900" }, legal: { color: colors.muted, textAlign: "center", fontSize: 10, lineHeight: 16, marginTop: 15 }
});
