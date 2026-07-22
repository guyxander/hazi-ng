import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import type { MobileAccount } from "../lib/auth";
import { colors } from "../theme";

export type AccountSection = "verification" | "wallet" | "payouts" | "listings" | "agent" | "support";

type SectionCopy = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  statusLabel: string;
  status: (account: MobileAccount | null) => string;
  items: readonly { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string }[];
};

const sectionCopy: Record<AccountSection, SectionCopy> = {
  verification: {
    title: "Verification", subtitle: "Build trust before buying, selling, or working as an agent.", icon: "shield-checkmark-outline", statusLabel: "Profile status",
    status: (account) => account?.verificationStatus ?? "Sign in to view",
    items: [
      { icon: "person-outline", title: "Identity details", copy: "Provide accurate profile and contact information." },
      { icon: "document-text-outline", title: "Supporting document", copy: "Submit the requested identity document securely." },
      { icon: "checkmark-circle-outline", title: "Hazi review", copy: "Your profile status changes only after the verification review." }
    ]
  },
  wallet: {
    title: "Wallet", subtitle: "Funding, escrow holds, earnings, refunds, and payouts in one place.", icon: "wallet-outline", statusLabel: "Available balance",
    status: () => "—",
    items: [
      { icon: "add-circle-outline", title: "Available funds", copy: "Wallet funding becomes available after provider confirmation." },
      { icon: "lock-closed-outline", title: "Escrow hold", copy: "Buyer funds stay protected until the release conditions are met." },
      { icon: "receipt-outline", title: "Wallet activity", copy: "Every confirmed credit, hold, release, refund, and withdrawal is recorded." }
    ]
  },
  payouts: {
    title: "Payout settings", subtitle: "Choose the verified bank account used for eligible withdrawals.", icon: "card-outline", statusLabel: "Settlement account",
    status: () => "Not loaded",
    items: [
      { icon: "business-outline", title: "Bank details", copy: "Save the account name, number, bank, and bank code." },
      { icon: "shield-checkmark-outline", title: "Account verification", copy: "Hazi verifies settlement details before funds are paid out." },
      { icon: "time-outline", title: "Admin review", copy: "Withdrawal requests are reviewed before funds leave Hazi." }
    ]
  },
  listings: {
    title: "My listings", subtitle: "Track auctions you own or are authorised to manage for a client.", icon: "list-outline", statusLabel: "Listings",
    status: () => "Not loaded",
    items: [
      { icon: "create-outline", title: "Draft", copy: "Finish preparing an auction before it becomes visible." },
      { icon: "radio-outline", title: "Active and paused", copy: "Manage eligible seller actions without changing accepted bids." },
      { icon: "checkmark-done-outline", title: "Accepted and closed", copy: "Follow completed auction and fulfilment status." }
    ]
  },
  agent: {
    title: "Agent workspace", subtitle: "Handle assigned requests and authorised client sales.", icon: "people-outline", statusLabel: "Workspace access",
    status: (account) => account ? (account.role === "agent" ? "Agent" : "Not an agent") : "Sign in to view",
    items: [
      { icon: "mail-unread-outline", title: "Requests", copy: "View open leads and work assigned to your agent profile." },
      { icon: "briefcase-outline", title: "Client jobs", copy: "Track scheduled work and client auction responsibilities." },
      { icon: "cash-outline", title: "Commission records", copy: "See commissions recorded against completed agent jobs." }
    ]
  },
  support: {
    title: "Support", subtitle: "Get marketplace help or raise an issue tied to your Hazi activity.", icon: "help-circle-outline", statusLabel: "Support access",
    status: (account) => account ? "Ready" : "General help",
    items: [
      { icon: "chatbubble-ellipses-outline", title: "Marketplace help", copy: "Get help understanding auctions, bids, payments, and account access." },
      { icon: "flag-outline", title: "Report a concern", copy: "Report suspicious content or conduct for review." },
      { icon: "alert-circle-outline", title: "Transaction dispute", copy: "Open a dispute from the relevant protected transaction." }
    ]
  }
};

type AccountSectionScreenProps = { section: AccountSection; account: MobileAccount | null; onBack: () => void; onRequireAuth: () => void };

export function AccountSectionScreen({ section, account, onBack, onRequireAuth }: AccountSectionScreenProps) {
  const copy = sectionCopy[section];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title={copy.title} subtitle={copy.subtitle} onBack={onBack} />
      <View style={styles.statusCard}>
        <View style={styles.largeIcon}><Ionicons name={copy.icon} size={28} color={colors.success} /></View>
        <View style={styles.flex}><Text style={styles.statusLabel}>{copy.statusLabel}</Text><Text style={styles.statusValue}>{copy.status(account)}</Text></View>
      </View>
      {!account ? (
        <View style={styles.gate}>
          <Ionicons name="lock-closed" size={20} color={colors.success} />
          <Text style={styles.gateCopy}>Sign in to load your protected Hazi data and available actions.</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={onRequireAuth}><Text style={styles.buttonText}>Sign in or create account</Text></Pressable>
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>How this works</Text>
      <View style={styles.list}>{copy.items.map((item) => (
        <View key={item.title} style={styles.item}>
          <View style={styles.itemIcon}><Ionicons name={item.icon} size={21} color={colors.success} /></View>
          <View style={styles.flex}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemCopy}>{item.copy}</Text></View>
        </View>
      ))}</View>
      <View style={styles.note}><Ionicons name="information-circle-outline" size={19} color={colors.success} /><Text style={styles.noteText}>This page follows Hazi’s existing permissions and transaction rules. Navigation and presentation do not change marketplace outcomes.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 18, paddingBottom: 36 }, flex: { flex: 1 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceRaised, borderRadius: 22, padding: 18 },
  largeIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  statusLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" }, statusValue: { color: colors.text, fontSize: 21, fontWeight: "900", marginTop: 4, textTransform: "capitalize" },
  gate: { backgroundColor: colors.primarySoft, borderRadius: 20, padding: 17, marginTop: 14 }, gateCopy: { color: "#d8f7ed", fontSize: 13, lineHeight: 19, marginTop: 9 },
  button: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.success, borderRadius: 15, padding: 14, alignItems: "center", marginTop: 14 }, buttonText: { color: colors.white, fontWeight: "900" },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900", marginTop: 26, marginBottom: 12 }, list: { gap: 10 },
  item: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15 },
  itemIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, itemTitle: { color: colors.text, fontSize: 14, fontWeight: "800" }, itemCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  note: { flexDirection: "row", gap: 10, backgroundColor: colors.surfaceRaised, borderRadius: 17, padding: 15, marginTop: 18 }, noteText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 }
});
