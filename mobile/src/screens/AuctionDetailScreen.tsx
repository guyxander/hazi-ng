import { Ionicons } from "@expo/vector-icons";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors } from "../theme";
import type { MobileAuction } from "../types";

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export function AuctionDetailScreen({ auction, authenticated, onRequireAuth, onBack }: { auction: MobileAuction; authenticated: boolean; onRequireAuth: () => void; onBack: () => void }) {
  const minimumBid = auction.current_bid ?? auction.reserve_price ?? auction.seller_price * 0.5;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title="Auction details" subtitle="Review the item and protected trade terms." onBack={onBack} />
      {auction.image_url ? <Image source={{ uri: auction.image_url }} accessibilityLabel={auction.title} alt={auction.title} style={styles.image} /> : null}
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}><Text style={styles.title}>{auction.title}</Text><Text style={styles.location}>{auction.location}</Text></View>
        {auction.is_premium ? <View style={styles.badge}><Text style={styles.badgeText}>FEATURED</Text></View> : null}
      </View>
      <View style={styles.bidPanel}>
        <View><Text style={styles.label}>CURRENT BID</Text><Text style={styles.bid}>{money.format(minimumBid)}</Text></View>
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
      <Pressable style={styles.primaryButton} onPress={authenticated ? () => Alert.alert("Wallet check required", "The next bidding step will validate your live Hazi wallet balance before accepting a binding bid.") : onRequireAuth}>
        <Text style={styles.primaryButtonText}>{authenticated ? "Continue to wallet check" : "Sign in to place bid"}</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={authenticated ? () => Alert.alert("Watchlist", "Watchlist persistence will use the authenticated Hazi account.") : onRequireAuth}><Ionicons name="heart-outline" size={20} color={colors.text} /><Text style={styles.secondaryText}>Add to watchlist</Text></Pressable>
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
  primaryButton: { backgroundColor: colors.primary, borderRadius: 18, padding: 17, alignItems: "center", marginTop: 25 }, primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 10 }, secondaryText: { color: colors.text, fontSize: 14, fontWeight: "800" }
});
