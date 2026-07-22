import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors } from "../theme";

const steps = [
  ["camera-outline", "Photos and condition", "Show the item clearly and disclose every known fault."],
  ["pricetag-outline", "Seller price", "Hazi calculates the minimum opening bid from your seller price."],
  ["location-outline", "Pickup or delivery", "Provide an accurate pickup location and available delivery options."],
  ["shield-checkmark-outline", "Verification", "Higher-trust sales may require identity and liveness checks."]
] as const;

export function SellScreen({ authenticated, onRequireAuth }: { authenticated: boolean; onRequireAuth: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title="Sell with Hazi" subtitle="Turn items you no longer need into trusted auctions." />
      <View style={styles.hero}><Ionicons name="sparkles" size={25} color={colors.success} /><Text style={styles.heroTitle}>A guided listing that protects the buyer and seller.</Text></View>
      <Text style={styles.sectionTitle}>Before you publish</Text>
      <View style={styles.steps}>{steps.map(([icon, title, copy], index) => <View key={title} style={styles.step}><View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View><Ionicons name={icon} size={22} color={colors.success} /><View style={styles.flex}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepCopy}>{copy}</Text></View></View>)}</View>
      <View style={styles.agentCard}><Ionicons name="people-outline" size={28} color={colors.text} /><View style={styles.flex}><Text style={styles.agentTitle}>Need hands-on help?</Text><Text style={styles.agentCopy}>Request an approved Hazi agent to inspect, photograph, and manage the auction. Agent-assisted sale splits remain 70% seller, 21% agent, and 9% Hazi.</Text></View></View>
      <Pressable style={styles.primaryButton} onPress={authenticated ? () => Alert.alert("Listing checks", "The listing builder will verify your Hazi profile and role before publishing.") : onRequireAuth}><Text style={styles.primaryText}>{authenticated ? "Start guided listing" : "Sign in to start listing"}</Text></Pressable>
      <Pressable style={styles.secondaryButton} onPress={authenticated ? () => Alert.alert("Agent request", "Agent assignment will use Hazi's existing approved-agent workflow.") : onRequireAuth}><Text style={styles.secondaryText}>Request an agent</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 18, paddingBottom: 32 }, flex: { flex: 1 },
  hero: { backgroundColor: colors.primary, borderRadius: 25, padding: 22, minHeight: 150, justifyContent: "space-between" }, heroTitle: { color: colors.white, fontSize: 25, lineHeight: 30, fontWeight: "900", maxWidth: 310 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900", marginTop: 24, marginBottom: 12 }, steps: { gap: 10 },
  step: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14 }, number: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, numberText: { color: colors.success, fontSize: 11, fontWeight: "900" }, stepTitle: { color: colors.text, fontSize: 14, fontWeight: "800" }, stepCopy: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  agentCard: { flexDirection: "row", gap: 13, backgroundColor: colors.surfaceRaised, borderRadius: 20, padding: 17, marginTop: 20 }, agentTitle: { color: colors.text, fontSize: 15, fontWeight: "900" }, agentCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 18, padding: 17, alignItems: "center", marginTop: 22 }, primaryText: { color: colors.white, fontSize: 16, fontWeight: "900" }, secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, alignItems: "center", marginTop: 10 }, secondaryText: { color: colors.text, fontSize: 14, fontWeight: "800" }
});
