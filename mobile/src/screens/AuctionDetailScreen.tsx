import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { loadAuctionInteraction, placeAuctionBid, setAuctionWatched, withdrawAuctionBid, type AuctionInteraction } from "../lib/marketplaceActions";
import { colors } from "../theme";
import type { MobileAuction } from "../types";

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export function AuctionDetailScreen({ auction, authenticated, onRequireAuth, onBack }: { auction: MobileAuction; authenticated: boolean; onRequireAuth: () => void; onBack: () => void }) {
  const [interaction, setInteraction] = useState<AuctionInteraction | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayedBid = interaction?.currentBid ?? auction.current_bid ?? auction.reserve_price ?? auction.seller_price * 0.5;

  useEffect(() => {
    let current = true;
    loadAuctionInteraction(auction.id).then((result) => { if (current) setInteraction(result); }).catch(() => undefined);
    return () => { current = false; };
  }, [auction.id]);

  async function submitBid() {
    if (!authenticated) return onRequireAuth();
    setLoading(true); setError(null);
    try {
      const result = await placeAuctionBid(auction.id, Number(amount.replaceAll(",", "")));
      setInteraction(result); setAmount(""); Alert.alert("Bid placed", "Your binding bid is now visible on this auction.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not place this bid."); }
    finally { setLoading(false); }
  }

  async function toggleWatchlist() {
    if (!authenticated) return onRequireAuth();
    const next = !interaction?.watched;
    setLoading(true); setError(null);
    try { await setAuctionWatched(auction.id, next); setInteraction((current) => current ? { ...current, watched: next } : { bids: [], currentBid: auction.current_bid, watched: next }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update your watchlist."); }
    finally { setLoading(false); }
  }

  async function withdraw(bidId: string) {
    setLoading(true); setError(null);
    try { setInteraction(await withdrawAuctionBid(bidId, auction.id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not withdraw this bid."); }
    finally { setLoading(false); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title="Auction details" subtitle="Review the item and protected trade terms." onBack={onBack} />
      {auction.image_url ? <Image source={{ uri: auction.image_url }} accessibilityLabel={auction.title} alt={auction.title} style={styles.image} /> : null}
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}><Text style={styles.title}>{auction.title}</Text><Text style={styles.location}>{auction.location}</Text></View>
        {auction.is_premium ? <View style={styles.badge}><Text style={styles.badgeText}>FEATURED</Text></View> : null}
      </View>
      <View style={styles.bidPanel}>
        <View><Text style={styles.label}>CURRENT BID</Text><Text style={styles.bid}>{money.format(displayedBid)}</Text></View>
        <View style={styles.status}><View style={styles.liveDot} /><Text style={styles.statusText}>LIVE</Text></View>
      </View>
      <View style={styles.trustCard}>
        <Ionicons name="shield-checkmark" size={24} color={colors.success} />
        <View style={styles.flex}><Text style={styles.trustTitle}>Protected by Hazi</Text><Text style={styles.trustCopy}>Accepted bids move through Hazi wallet escrow. Release funds only after receipt and inspection.</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Seller</Text>
      <View style={styles.sellerCard}>
        <View style={styles.avatar}><Ionicons name="person" size={22} color={colors.text} /></View>
        <View style={styles.flex}><View style={styles.sellerNameRow}><Text style={styles.sellerName}>{auction.seller_name ?? "Hazi seller"}</Text>{auction.seller_verified ? <Ionicons name="checkmark-circle" size={17} color={colors.success} /> : null}</View><Text style={styles.sellerMeta}>{auction.seller_verified ? "Identity verified" : "Verification not displayed"}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Auction terms</Text>
      <View style={styles.terms}>
        <Term icon="wallet-outline" text="Your available wallet balance must cover the bid." />
        <Term icon="lock-closed-outline" text="A seller-accepted bid is moved into escrow." />
        <Term icon="cube-outline" text="Pickup or delivery is agreed before receipt confirmation." />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.sectionTitle}>Place a bid</Text>
      <TextInput accessibilityLabel="Bid amount in naira" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Enter amount in NGN" placeholderTextColor={colors.muted} style={styles.input} />
      <Pressable accessibilityRole="button" disabled={loading} style={[styles.primaryButton, loading && styles.disabled]} onPress={() => void submitBid()}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{authenticated ? "Place binding bid" : "Sign in to place bid"}</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" disabled={loading} style={styles.secondaryButton} onPress={() => void toggleWatchlist()}><Ionicons name={interaction?.watched ? "heart" : "heart-outline"} size={20} color={interaction?.watched ? colors.success : colors.text} /><Text style={styles.secondaryText}>{interaction?.watched ? "Remove from watchlist" : "Add to watchlist"}</Text></Pressable>
      <Text style={styles.sectionTitle}>Visible bids</Text>
      <View style={styles.bidList}>{interaction?.bids.length ? interaction.bids.map((bid) => <View key={bid.id} style={styles.bidRow}><View style={styles.flex}><Text style={styles.bidder}>{bid.isMine ? "Your bid" : bid.bidderName}</Text><Text style={styles.bidMeta}>{bid.status} · {new Date(bid.createdAt).toLocaleDateString("en-NG")}</Text></View><Text style={styles.bidAmount}>{money.format(bid.amount)}</Text>{bid.isMine && bid.status === "pending" ? <Pressable accessibilityRole="button" onPress={() => void withdraw(bid.id)}><Text style={styles.withdraw}>Withdraw</Text></Pressable> : null}</View>) : <Text style={styles.empty}>No bids yet. Be the first to place one.</Text>}</View>
    </ScrollView>
  );
}

function Term({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.term}><Ionicons name={icon} size={20} color={colors.success} /><Text style={styles.termText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 18, paddingBottom: 34 }, flex: { flex: 1 },
  image: { width: "100%", aspectRatio: 1.25, borderRadius: 26, backgroundColor: colors.surfaceRaised },
  titleRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 20 }, titleCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 28, lineHeight: 33, fontWeight: "900" }, location: { color: colors.muted, fontSize: 14, marginTop: 7 },
  badge: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, badgeText: { color: colors.success, fontSize: 9, fontWeight: "900" },
  bidPanel: { marginTop: 20, borderRadius: 22, padding: 19, backgroundColor: colors.primary, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "#bcebdd", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, bid: { color: colors.white, fontSize: 27, fontWeight: "900", marginTop: 3 },
  status: { flexDirection: "row", alignItems: "center", gap: 6 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }, statusText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  trustCard: { flexDirection: "row", gap: 13, backgroundColor: colors.surfaceRaised, borderRadius: 20, padding: 17, marginTop: 16 }, trustTitle: { color: colors.text, fontSize: 15, fontWeight: "800" }, trustCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 24, marginBottom: 11 },
  sellerCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 6 }, sellerName: { color: colors.text, fontSize: 15, fontWeight: "800" }, sellerMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  terms: { gap: 10 }, term: { flexDirection: "row", gap: 11, padding: 14, borderRadius: 16, backgroundColor: colors.surface }, termText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  input: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 17, paddingHorizontal: 16, height: 56, fontSize: 16 }, error: { color: "#ffaaa1", backgroundColor: "#3d2021", borderRadius: 14, padding: 13, marginTop: 18 }, disabled: { opacity: 0.6 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 18, padding: 17, alignItems: "center", marginTop: 25 }, primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 10 }, secondaryText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  bidList: { gap: 9 }, bidRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }, bidder: { color: colors.text, fontWeight: "800", fontSize: 13 }, bidMeta: { color: colors.muted, fontSize: 10, textTransform: "capitalize", marginTop: 3 }, bidAmount: { color: colors.text, fontWeight: "900", fontSize: 14 }, withdraw: { color: "#ffaaa1", fontSize: 11, fontWeight: "800" }, empty: { color: colors.muted, textAlign: "center", padding: 20 }
});
