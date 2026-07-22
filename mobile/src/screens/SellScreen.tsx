import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import type { MobileAccount } from "../lib/auth";
import { loadSellingOptions, saveAuction, type AgentListingJob, type SellCategory } from "../lib/selling";
import { colors } from "../theme";

const conditions = ["like_new", "good", "fair", "needs_repair"] as const;

export function SellScreen({ account, onRequireAuth }: { account: MobileAccount | null; onRequireAuth: () => void }) {
  const [builder, setBuilder] = useState(false); const [categories, setCategories] = useState<SellCategory[]>([]); const [jobs, setJobs] = useState<AgentListingJob[]>([]);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [price, setPrice] = useState(""); const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState<(typeof conditions)[number]>("good"); const [location, setLocation] = useState(""); const [latitude, setLatitude] = useState<number | null>(null); const [longitude, setLongitude] = useState<number | null>(null);
  const [duration, setDuration] = useState(72); const [pickup, setPickup] = useState(true); const [delivery, setDelivery] = useState(true); const [agentJobId, setAgentJobId] = useState<string | null>(null);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account || !builder) return;
    let current = true;
    loadSellingOptions(account).then(({ categories: options, jobs: assigned }) => { if (current) { setCategories(options); setJobs(assigned); setCategoryId((value) => value || options[0]?.id || ""); } }).catch((caught) => { if (current) setError(caught instanceof Error ? caught.message : "Could not load listing options."); });
    return () => { current = false; };
  }, [account, builder]);

  async function choosePhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError("Photo access is required to add auction images.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.85 });
    if (!result.canceled) setImages(result.assets.slice(0, 6));
  }
  async function locate() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return setError("Location permission is required to confirm the pickup point.");
    setLoading(true); setError(null);
    try { const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); setLatitude(position.coords.latitude); setLongitude(position.coords.longitude); const [address] = await Location.reverseGeocodeAsync(position.coords); setLocation([address?.street, address?.district, address?.city, address?.region].filter(Boolean).join(", ")); }
    catch { setError("Could not determine your pickup location."); } finally { setLoading(false); }
  }
  async function submit(publish: boolean) {
    if (!account) return onRequireAuth();
    setLoading(true); setError(null);
    try { await saveAuction({ title, description, categoryId, condition, location, latitude: latitude ?? NaN, longitude: longitude ?? NaN, sellerPrice: Number(price.replaceAll(",", "")), durationHours: duration, pickupAvailable: pickup, deliveryAvailable: delivery, agentJobId }, images, account, publish); Alert.alert(publish ? "Auction published" : "Draft saved", publish ? "The auction is now live under Hazi’s existing bidding rules." : "Open My listings when you are ready to finish it."); setBuilder(false); setTitle(""); setDescription(""); setPrice(""); setImages([]); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save this auction."); } finally { setLoading(false); }
  }
  if (!builder) return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><ScreenHeader title="Sell with Hazi" subtitle="Turn items you no longer need into trusted auctions." /><View style={styles.hero}><Ionicons name="sparkles" size={25} color={colors.success} /><Text style={styles.heroTitle}>A guided listing that protects the buyer and seller.</Text></View><View style={styles.info}><Text style={styles.infoTitle}>Agent-assisted sales</Text><Text style={styles.hint}>The existing split remains 70% seller, 21% agent, and 9% Hazi.</Text></View><Pressable style={styles.primary} onPress={() => account ? setBuilder(true) : onRequireAuth()}><Text style={styles.primaryText}>{account ? "Start guided listing" : "Sign in to start listing"}</Text></Pressable></ScrollView>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><ScreenHeader title="Create auction" subtitle={account?.role === "agent" ? "Publish for an assigned Hazi client." : "Build a trusted Hazi listing."} onBack={() => setBuilder(false)} />
    {error ? <Text style={styles.error}>{error}</Text> : null}<Field label="Title"><TextInput value={title} onChangeText={setTitle} placeholder="What are you selling?" placeholderTextColor={colors.muted} style={styles.input} /></Field><Field label="Description"><TextInput value={description} onChangeText={setDescription} multiline placeholder="Condition, faults, accessories, and pickup notes" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} /></Field><Field label="Seller price"><TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Amount in NGN" placeholderTextColor={colors.muted} style={styles.input} /><Text style={styles.hint}>Opening bid: 50% of seller price.</Text></Field>
    <Text style={styles.label}>Category</Text><ScrollView horizontal contentContainerStyle={styles.wrap}>{categories.map((item) => <Chip key={item.id} label={item.name} selected={categoryId === item.id} onPress={() => setCategoryId(item.id)} />)}</ScrollView><Text style={styles.label}>Condition</Text><View style={styles.wrap}>{conditions.map((item) => <Chip key={item} label={item.replaceAll("_", " ")} selected={condition === item} onPress={() => setCondition(item)} />)}</View>
    {account?.role === "agent" ? <><Text style={styles.label}>Assigned client job</Text><View style={styles.wrap}>{jobs.map((job) => <Chip key={job.id} label={`${job.label} · ${job.status}`} selected={agentJobId === job.id} onPress={() => setAgentJobId(job.id)} />)}{!jobs.length ? <Text style={styles.hint}>No eligible assigned jobs.</Text> : null}</View></> : null}
    <Text style={styles.label}>Photos</Text><Outline icon="images-outline" label={images.length ? `${images.length} photos selected` : "Choose up to 6 photos"} onPress={() => void choosePhotos()} />{images.length ? <ScrollView horizontal contentContainerStyle={styles.wrap}>{images.map((image, index) => <Image key={image.assetId ?? image.uri} source={{ uri: image.uri }} alt={`Auction photo ${index + 1}`} style={styles.photo} />)}</ScrollView> : null}
    <Text style={styles.label}>Pickup location</Text><TextInput value={location} onChangeText={setLocation} placeholder="Pickup address" placeholderTextColor={colors.muted} style={styles.input} /><Outline icon="locate-outline" label={latitude ? "Pickup coordinates confirmed" : "Use current location"} onPress={() => void locate()} />
    <Text style={styles.label}>Duration</Text><View style={styles.wrap}>{[24, 72, 168].map((hours) => <Chip key={hours} label={hours === 24 ? "24 hours" : `${hours / 24} days`} selected={duration === hours} onPress={() => setDuration(hours)} />)}</View><Toggle label="Pickup available" value={pickup} onChange={setPickup} /><Toggle label="Delivery available" value={delivery} onChange={setDelivery} />
    <View style={styles.actions}><Pressable disabled={loading} style={styles.secondary} onPress={() => void submit(false)}><Text style={styles.secondaryText}>Save draft</Text></Pressable><Pressable disabled={loading} style={styles.primary} onPress={() => void submit(true)}>{loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Publish</Text>}</Pressable></View></ScrollView>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <View><Text style={styles.label}>{label}</Text>{children}</View>; }
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}><Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text></Pressable>; }
function Outline({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) { return <Pressable style={styles.outline} onPress={onPress}><Ionicons name={icon} size={20} color={colors.success} /><Text style={styles.secondaryText}>{label}</Text></Pressable>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <View style={styles.toggle}><Text style={styles.toggleText}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} /></View>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: 18, paddingBottom: 38, gap: 12 }, hero: { backgroundColor: colors.primary, borderRadius: 25, padding: 22, minHeight: 150, justifyContent: "space-between" }, heroTitle: { color: colors.white, fontSize: 25, lineHeight: 30, fontWeight: "900" }, info: { backgroundColor: colors.surfaceRaised, borderRadius: 18, padding: 16 }, infoTitle: { color: colors.text, fontWeight: "900" }, label: { color: colors.text, fontSize: 13, fontWeight: "900", marginTop: 8, marginBottom: 7 }, hint: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 }, input: { minHeight: 54, borderRadius: 16, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 15 }, textarea: { minHeight: 110, paddingTop: 14, textAlignVertical: "top" }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10 }, chipOn: { backgroundColor: colors.primary, borderColor: colors.success }, chipText: { color: colors.muted, fontSize: 11, textTransform: "capitalize" }, chipTextOn: { color: colors.white, fontWeight: "800" }, outline: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, photo: { width: 92, height: 92, borderRadius: 14 }, toggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, padding: 14 }, toggleText: { color: colors.text, fontWeight: "800" }, actions: { flexDirection: "row", gap: 10 }, primary: { flex: 1, minHeight: 54, backgroundColor: colors.primary, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 8 }, primaryText: { color: colors.white, fontWeight: "900" }, secondary: { flex: 1, minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 8 }, secondaryText: { color: colors.text, fontWeight: "800", fontSize: 13 }, error: { color: "#ffaaa1", backgroundColor: "#3d2021", borderRadius: 14, padding: 13 } });
