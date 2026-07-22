import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors } from "../theme";

const activityTypes = [
  ["trending-up-outline", "Bids", "Track active, accepted, rejected, and withdrawn bids."],
  ["lock-closed-outline", "Escrow", "Follow payment holds, receipt confirmation, release, and refunds."],
  ["car-outline", "Orders", "See pickup and delivery progress for accepted transactions."],
  ["alert-circle-outline", "Disputes", "Review open cases and evidence requests from Hazi support."]
] as const;

export function ActivityScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title="Your activity" subtitle="One timeline for every protected Hazi trade." />
      <View style={styles.summary}><View><Text style={styles.summaryLabel}>ACTIVE TRADES</Text><Text style={styles.summaryValue}>—</Text></View><Ionicons name="pulse" size={34} color={colors.success} /></View>
      <View style={styles.filters}>{["All", "Buying", "Selling"].map((filter, index) => <View key={filter} style={[styles.filter, index === 0 && styles.filterActive]}><Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>{filter}</Text></View>)}</View>
      <View style={styles.cards}>{activityTypes.map(([icon, title, copy]) => <Pressable key={title} style={styles.card} onPress={() => Alert.alert("Sign in required", `Sign in to view your Hazi ${title.toLowerCase()}.`)}><View style={styles.cardIcon}><Ionicons name={icon} size={22} color={colors.success} /></View><View style={styles.flex}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardCopy}>{copy}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</View>
      <View style={styles.empty}><Ionicons name="notifications-off-outline" size={30} color={colors.muted} /><Text style={styles.emptyTitle}>Sign in to load your activity</Text><Text style={styles.emptyCopy}>Private transaction data is only requested after authentication.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 18, paddingBottom: 32 }, flex: { flex: 1 },
  summary: { backgroundColor: colors.primary, borderRadius: 24, padding: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, summaryLabel: { color: "#bcebdd", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, summaryValue: { color: colors.white, fontSize: 32, fontWeight: "900", marginTop: 3 },
  filters: { flexDirection: "row", gap: 8, marginVertical: 18 }, filter: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface }, filterActive: { backgroundColor: colors.primarySoft }, filterText: { color: colors.muted, fontSize: 12, fontWeight: "800" }, filterTextActive: { color: colors.success },
  cards: { gap: 10 }, card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14 }, cardIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, cardTitle: { color: colors.text, fontSize: 14, fontWeight: "900" }, cardCopy: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  empty: { alignItems: "center", backgroundColor: colors.surfaceRaised, borderRadius: 20, padding: 22, marginTop: 18 }, emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 10 }, emptyCopy: { color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 4 }
});
