import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import type { MobileAuction } from "../types";

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function timeLeft(endsAt: string | null) {
  if (!endsAt) return "No end date";
  const seconds = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export function AuctionCard({ auction, onPress }: { auction: MobileAuction; onPress: () => void }) {
  const leadingBid = auction.current_bid ?? auction.reserve_price ?? auction.seller_price * 0.5;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {auction.image_url ? (
        <Image source={{ uri: auction.image_url }} style={styles.image} accessibilityLabel={auction.title} alt={auction.title} />
      ) : (
        <View style={[styles.image, styles.placeholder]}><Ionicons name="image-outline" size={34} color={colors.muted} /></View>
      )}
      <View style={styles.content}>
        <View style={styles.timer}><Text style={styles.timerText}>{timeLeft(auction.ends_at)}</Text></View>
        <Text numberOfLines={2} style={styles.title}>{auction.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={15} color={colors.muted} />
          <Text numberOfLines={1} style={styles.meta}>{auction.location}</Text>
        </View>
        <View style={styles.sellerRow}>
          <Text numberOfLines={1} style={styles.seller}>{auction.seller_name ?? "Hazi seller"}</Text>
          {auction.seller_verified && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
        </View>
        <Text style={styles.label}>Current bid</Text>
        <Text style={styles.price}>{money.format(leadingBid)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 196, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden", flexDirection: "row" },
  pressed: { opacity: 0.84 },
  image: { width: "43%", minHeight: 196, backgroundColor: colors.surfaceRaised },
  placeholder: { alignItems: "center", justifyContent: "center" },
  content: { flex: 1, padding: 16, justifyContent: "center" },
  timer: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 10 },
  timerText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  title: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  meta: { flex: 1, color: colors.muted, fontSize: 13 },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  seller: { color: colors.muted, fontSize: 13, maxWidth: "85%" },
  label: { marginTop: 13, color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  price: { marginTop: 2, color: colors.text, fontSize: 17, fontWeight: "900" }
});
