import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function BrandHeader() {
  return (
    <View style={styles.header}>
      <View>
        <View style={styles.logoBadge}><Text style={styles.logoText}>hazi</Text></View>
        <Text style={styles.kicker}>VERIFIED DECLUTTER AUCTIONS</Text>
      </View>
      <Pressable accessibilityLabel="Notifications" style={styles.iconButton}>
        <Ionicons name="notifications-outline" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  logoBadge: { alignSelf: "flex-start", width: 84, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  logoText: { color: colors.white, textAlign: "center", fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -1.5 },
  kicker: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1, marginTop: 6 },
  iconButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }
});
