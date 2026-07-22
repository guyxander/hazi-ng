import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuctionCard } from "./src/components/AuctionCard";
import { BrandHeader } from "./src/components/BrandHeader";
import { loadCurrentAccount, signOutAccount, type MobileAccount } from "./src/lib/auth";
import { getActiveAuctions, supabase } from "./src/lib/marketplace";
import { ActivityScreen } from "./src/screens/ActivityScreen";
import { AccountSectionScreen, type AccountSection } from "./src/screens/AccountSectionScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { AuctionDetailScreen } from "./src/screens/AuctionDetailScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SellScreen } from "./src/screens/SellScreen";
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<MobileAuction | null>(null);
  const [account, setAccount] = useState<MobileAccount | null>(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [accountSection, setAccountSection] = useState<AccountSection | null>(null);

  const refreshAccount = useCallback(async () => {
    try {
      setAccount(await loadCurrentAccount());
    } catch (caught) {
      setAccount(null);
      Alert.alert("Account unavailable", caught instanceof Error ? caught.message : "Could not load your Hazi account.");
    }
  }, []);

  useEffect(() => {
    getActiveAuctions()
      .then(setAuctions)
      .catch(() => setError("We couldn't load auctions. Pull down and try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const initialTimer = setTimeout(() => void refreshAccount(), 0);
    if (!supabase) return () => clearTimeout(initialTimer);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void refreshAccount(), 0);
    });
    return () => {
      clearTimeout(initialTimer);
      subscription.unsubscribe();
    };
  }, [refreshAccount]);

  useEffect(() => {
    async function handleUrl(url: string) {
      if (!supabase || !url.startsWith("hazi://auth/recovery")) return;
      const params = new URLSearchParams(url.split("#")[1] || url.split("?")[1] || "");
      const access_token = params.get("access_token"); const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) return Alert.alert("Recovery link unavailable", "Request a new password recovery email and try again.");
      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionError) return Alert.alert("Recovery link expired", sessionError.message);
      setRecoveryMode(true); setAuthVisible(true);
    }
    const listener = Linking.addEventListener("url", ({ url }) => void handleUrl(url));
    void Linking.getInitialURL().then((url) => { if (url) void handleUrl(url); });
    return () => listener.remove();
  }, []);

  const refreshAuctions = useCallback(async () => { setRefreshing(true); setError(null); try { setAuctions(await getActiveAuctions()); } catch { setError("We couldn't refresh auctions. Check your connection and try again."); } finally { setRefreshing(false); } }, []);

  const visibleAuctions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return auctions;
    return auctions.filter((auction) => [auction.title, auction.location, auction.seller_name ?? ""].some((value) => value.toLowerCase().includes(term)));
  }, [auctions, query]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        {authVisible ? <AuthScreen recoveryMode={recoveryMode} onClose={() => { setAuthVisible(false); setRecoveryMode(false); }} onAuthenticated={() => { void refreshAccount(); setAuthVisible(false); setRecoveryMode(false); }} /> : <View style={styles.app}>
          {accountSection ? (
            <AccountSectionScreen section={accountSection} account={account} onBack={() => setAccountSection(null)} onRequireAuth={() => setAuthVisible(true)} />
          ) : selectedAuction ? (
            <AuctionDetailScreen auction={selectedAuction} authenticated={Boolean(account)} onRequireAuth={() => setAuthVisible(true)} onBack={() => setSelectedAuction(null)} />
          ) : tab === "home" || tab === "find" ? (
            <MarketplaceScreen tab={tab} auctions={visibleAuctions} loading={loading} refreshing={refreshing} error={error} query={query} setQuery={setQuery} onRefresh={refreshAuctions} onSelectAuction={setSelectedAuction} />
          ) : tab === "sell" ? <SellScreen account={account} onRequireAuth={() => setAuthVisible(true)} /> : tab === "activity" ? <ActivityScreen account={account} onRequireAuth={() => setAuthVisible(true)} /> : <ProfileScreen account={account} onRequireAuth={() => setAuthVisible(true)} onOpenSection={setAccountSection} onSignOut={async () => { await signOutAccount(); setAccount(null); }} />}
          {!selectedAuction && !accountSection ? <View style={styles.nav}>
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
          </View> : null}
        </View>}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function MarketplaceScreen({ tab, auctions, loading, refreshing, error, query, setQuery, onRefresh, onSelectAuction }: { tab: "home" | "find"; auctions: MobileAuction[]; loading: boolean; refreshing: boolean; error: string | null; query: string; setQuery: (value: string) => void; onRefresh: () => void; onSelectAuction: (auction: MobileAuction) => void }) {
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={auctions}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
      keyExtractor={(auction) => auction.id}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListHeaderComponent={(
        <View>
          <BrandHeader />
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
      renderItem={({ item }) => <AuctionCard auction={item} onPress={() => onSelectAuction(item)} />}
      ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>No active auctions match your search.</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  hero: { backgroundColor: colors.primary, borderRadius: 28, padding: 24, minHeight: 192, justifyContent: "flex-end", marginBottom: 18 },
  heroEyebrow: { color: colors.white, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  heroTitle: { color: colors.white, fontSize: 34, lineHeight: 37, fontWeight: "900", letterSpacing: -1.2, marginTop: 8, maxWidth: 310 },
  heroCopy: { color: "#d8f7ed", fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 300 },
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
  navLabelSelected: { color: colors.text }
});
