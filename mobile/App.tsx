import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { AuctionCard } from "./src/components/AuctionCard";
import { getActiveAuctions } from "./src/lib/marketplace";
import { colors } from "./src/theme";
import type { MobileAuction } from "./src/types";

type Tab = "home" | "find" | "sell" | "activity" | "profile";

const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "find", label: "Find", icon: "search" },
  { key: "sell", label: "Sell", icon: "add" },
  { key: "activity", label: "Activity", icon: "notifications-outline" },
  { key: "profile", label: "Profile", icon: "person-outline" }
];

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [auctions, setAuctions] = useState<MobileAuction[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActiveAuctions()
      .then(setAuctions)
      .catch(() => setError("We couldn't load auctions. Pull down and try again."))
      .finally(() => setLoading(false));
  }, []);

  const visibleAuctions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return auctions;
    return auctions.filter((auction) => [auction.title, auction.location, auction.seller_name ?? ""].some((value) => value.toLowerCase().includes(term)));
  }, [auctions, query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.app}>
        {tab === "home" || tab === "find" ? (
          <MarketplaceScreen tab={tab} auctions={visibleAuctions} loading={loading} error={error} query={query} setQuery={setQuery} />
        ) : (
          <ProtectedWorkflow tab={tab} />
        )}
        <View style={styles.nav}>
          {tabs.map((item) => {
            const selected = item.key === tab;
            const central = item.key === "sell";
            return (
              <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setTab(item.key)} style={styles.navItem}>
                <View style={[central && styles.sellButton, selected && !central && styles.selectedIcon]}>
                  <Ionicons name={item.icon} size={central ? 32 : 24} color={central || selected ? colors.white : colors.muted} />
                </View>
                <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function MarketplaceScreen({ tab, auctions, loading, error, query, setQuery }: { tab: "home" | "find"; auctions: MobileAuction[]; loading: boolean; error: string | null; query: string; setQuery: (value: string) => void }) {
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={auctions}
      keyExtractor={(auction) => auction.id}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListHeaderComponent={(
        <View>
          <View style={styles.header}>
            <View><Text style={styles.logo}>hazi</Text><Text style={styles.kicker}>VERIFIED DECLUTTER AUCTIONS</Text></View>
            <Pressable accessibilityLabel="Notifications" style={styles.iconButton}><Ionicons name="notifications-outline" size={24} color={colors.text} /></Pressable>
          </View>
          {tab === "home" ? (
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>MAKE SPACE. MAKE MONEY.</Text>
              <Text style={styles.heroTitle}>Great finds, trusted trades.</Text>
              <Text style={styles.heroCopy}>Bid on verified used items with visible offers and protected payments.</Text>
            </View>
          ) : null}
          <View style={styles.search}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search items or locations" placeholderTextColor={colors.muted} style={styles.searchInput} />
          </View>
          <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{tab === "home" ? "Live auctions" : "Find your next item"}</Text><Text style={styles.count}>{auctions.length} LIVE</Text></View>
          {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
      renderItem={({ item }) => <AuctionCard auction={item} onPress={() => undefined} />}
      ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>No active auctions match your search.</Text> : null}
    />
  );
}

function ProtectedWorkflow({ tab }: { tab: Exclude<Tab, "home" | "find"> }) {
  const content = {
    sell: ["Sell with Hazi", "Sign in and complete the required profile checks before publishing an auction."],
    activity: ["Your activity", "Bids, accepted offers, escrow updates, delivery progress, and disputes will appear here."],
    profile: ["Your Hazi account", "Sign in to manage verification, wallet, payouts, listings, agent work, and account settings."]
  }[tab];

  return (
    <View style={styles.protected}>
      <View style={styles.protectedIcon}><Ionicons name={tab === "sell" ? "pricetag-outline" : tab === "activity" ? "pulse-outline" : "shield-checkmark-outline"} size={42} color={colors.primary} /></View>
      <Text style={styles.protectedTitle}>{content[0]}</Text>
      <Text style={styles.protectedCopy}>{content[1]}</Text>
      <Pressable style={styles.primaryButton}><Text style={styles.primaryButtonText}>Sign in to continue</Text></Pressable>
      <Text style={styles.guardrail}>Hazi role, auction, wallet, and escrow rules remain unchanged.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  logo: { color: colors.white, backgroundColor: colors.primary, borderRadius: 17, overflow: "hidden", paddingHorizontal: 18, paddingVertical: 8, fontSize: 30, fontWeight: "900", letterSpacing: -2 },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.2, marginTop: 8 },
  iconButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: colors.primary, borderRadius: 28, padding: 24, minHeight: 192, justifyContent: "flex-end", marginBottom: 18 },
  heroEyebrow: { color: colors.white, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  heroTitle: { color: colors.white, fontSize: 34, lineHeight: 37, fontWeight: "900", letterSpacing: -1.2, marginTop: 8, maxWidth: 310 },
  heroCopy: { color: "#fff0e8", fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 300 },
  search: { height: 54, borderRadius: 18, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  sectionTitle: { color: colors.text, fontSize: 23, fontWeight: "900" },
  count: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  error: { color: "#ffaaa1", backgroundColor: "#3d2021", padding: 14, borderRadius: 14, marginBottom: 14 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 50 },
  nav: { minHeight: 82, paddingBottom: 8, paddingHorizontal: 8, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  selectedIcon: { backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 6 },
  sellButton: { width: 58, height: 48, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: -18 },
  navLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  navLabelSelected: { color: colors.text },
  protected: { flex: 1, paddingHorizontal: 30, alignItems: "center", justifyContent: "center" },
  protectedIcon: { width: 88, height: 88, borderRadius: 30, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  protectedTitle: { color: colors.text, fontSize: 29, fontWeight: "900", textAlign: "center" },
  protectedCopy: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: "center", marginTop: 12, maxWidth: 340 },
  primaryButton: { marginTop: 28, backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 28, paddingVertical: 16, width: "100%", maxWidth: 360, alignItems: "center" },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  guardrail: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 18, maxWidth: 320 }
});
