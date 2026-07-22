import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors } from "../theme";

const menu = [
  ["shield-checkmark-outline", "Verification", "Identity, phone, and liveness checks"],
  ["wallet-outline", "Wallet", "Balance, funding, escrow, and refunds"],
  ["card-outline", "Payout settings", "Verified settlement account"],
  ["list-outline", "My listings", "Draft, active, accepted, and closed auctions"],
  ["people-outline", "Agent workspace", "Requests and assigned client sales"],
  ["help-circle-outline", "Support", "Reports, disputes, and marketplace help"]
] as const;

export function ProfileScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title="Your Hazi account" subtitle="Trust, payments, listings, and support." />
      <View style={styles.accountCard}><View style={styles.avatar}><Ionicons name="person" size={32} color={colors.text} /></View><View style={styles.flex}><Text style={styles.guest}>Guest account</Text><Text style={styles.guestCopy}>Sign in to load your verified Hazi profile and role.</Text></View></View>
      <Pressable style={styles.primaryButton} onPress={() => Alert.alert("Authentication", "The next build will connect this screen to Hazi's existing Supabase Auth flow.")}><Text style={styles.primaryText}>Sign in or create account</Text></Pressable>
      <Text style={styles.sectionTitle}>Account services</Text>
      <View style={styles.menu}>{menu.map(([icon, title, copy]) => <Pressable key={title} style={styles.menuItem} onPress={() => Alert.alert("Sign in required", `Sign in to open ${title.toLowerCase()}.`)}><View style={styles.menuIcon}><Ionicons name={icon} size={21} color={colors.success} /></View><View style={styles.flex}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuCopy}>{copy}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</View>
      <View style={styles.trustNote}><Ionicons name="lock-closed" size={18} color={colors.success} /><Text style={styles.trustText}>Roles and permissions are loaded from trusted Hazi profile data—not editable account metadata.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 18, paddingBottom: 32 }, flex: { flex: 1 },
  accountCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceRaised, borderRadius: 22, padding: 18 }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, guest: { color: colors.text, fontSize: 18, fontWeight: "900" }, guestCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 18, padding: 17, alignItems: "center", marginTop: 14 }, primaryText: { color: colors.white, fontSize: 15, fontWeight: "900" },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900", marginTop: 25, marginBottom: 12 }, menu: { gap: 9 }, menuItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 13 }, menuIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, menuTitle: { color: colors.text, fontSize: 14, fontWeight: "800" }, menuCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  trustNote: { flexDirection: "row", gap: 10, backgroundColor: colors.primarySoft, borderRadius: 17, padding: 15, marginTop: 18 }, trustText: { flex: 1, color: "#bcebdd", fontSize: 11, lineHeight: 17 }
});
