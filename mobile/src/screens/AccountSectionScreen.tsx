import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { loadAccountSectionData, type AccountSectionData, type DataAccountSection } from "../lib/accountData";
import { claimAgentLead, loadEditableListing, manageListing, saveEditableListing, submitSupport, submitVerification, updateAgentJob, updateAssignedLead, type EditableListing } from "../lib/accountActions";
import type { MobileAccount } from "../lib/auth";
import { requestWithdrawal, savePayoutSettings, startWalletFunding } from "../lib/walletActions";
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
  const [data, setData] = useState<AccountSectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"fund" | "withdraw" | "payout" | null>(null);
  const [amount, setAmount] = useState(""); const [bankName, setBankName] = useState(""); const [accountNumber, setAccountNumber] = useState(""); const [accountName, setAccountName] = useState(""); const [bankCode, setBankCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false); const [reload, setReload] = useState(0);
  const [jobEdit, setJobEdit] = useState<{ id: string; status: "assigned" | "scheduled" | "in_progress" | "inventory_ready" | "completed" | "cancelled" } | null>(null); const [commission, setCommission] = useState(""); const [jobNotes, setJobNotes] = useState("");
  const [listingEdit, setListingEdit] = useState<EditableListing | null>(null);

  useEffect(() => {
    if (!account || !(["wallet", "payouts", "listings", "agent"] as AccountSection[]).includes(section)) return;
    let current = true;
    const loadTimer = setTimeout(() => {
      setLoading(true);
      setError(null);
      setData(null);
      loadAccountSectionData(section as DataAccountSection, account.user.id, account.role)
        .then((result) => { if (current) setData(result); })
        .catch((caught) => { if (current) setError(caught instanceof Error ? caught.message : "Could not load this account section."); })
        .finally(() => { if (current) setLoading(false); });
    }, 0);
    return () => { current = false; clearTimeout(loadTimer); };
  }, [account, section, reload]);

  async function submitAccountAction() {
    if (!action) return;
    setActionLoading(true); setError(null);
    try {
      if (action === "fund") await startWalletFunding(Number(amount.replaceAll(",", "")));
      else if (action === "withdraw") await requestWithdrawal({ amount: Number(amount.replaceAll(",", "")), sourceBucket: "earnings", bankName, accountNumber, accountName, bankCode });
      else await savePayoutSettings({ bankName, accountNumber, accountName, bankCode });
      if (action !== "fund") { Alert.alert(action === "withdraw" ? "Withdrawal requested" : "Payout settings saved", action === "withdraw" ? "Hazi will review this request before funds leave your wallet." : "The account must be verified before an eligible payout."); setAction(null); setReload((value) => value + 1); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not complete this action."); }
    finally { setActionLoading(false); }
  }
  async function listingAction(id: string, currentStatus: string) { setActionLoading(true); setError(null); try { await manageListing(id, currentStatus); setReload((value) => value + 1); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update listing."); } finally { setActionLoading(false); } }
  async function openListing(id: string) { setActionLoading(true); setError(null); try { setListingEdit(await loadEditableListing(id)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load listing."); } finally { setActionLoading(false); } }
  async function locateListing() { if (!listingEdit) return; const permission = await Location.requestForegroundPermissionsAsync(); if (!permission.granted) return setError("Location permission is required to confirm the pickup point."); setActionLoading(true); try { const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); const [address] = await Location.reverseGeocodeAsync(position.coords); setListingEdit({ ...listingEdit, latitude: position.coords.latitude, longitude: position.coords.longitude, location: [address?.street, address?.district, address?.city, address?.region].filter(Boolean).join(", ") || listingEdit.location }); } catch { setError("Could not determine the pickup location."); } finally { setActionLoading(false); } }
  async function saveListing() { if (!listingEdit) return; setActionLoading(true); setError(null); try { await saveEditableListing(listingEdit); setListingEdit(null); setReload((value) => value + 1); Alert.alert("Listing saved", "Your editable auction details were updated without changing bids or auction outcomes."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save listing."); } finally { setActionLoading(false); } }
  async function agentAction(id: string, status: string) { setActionLoading(true); setError(null); try { if (id.startsWith("available-")) await claimAgentLead(id.slice(10)); else if (id.startsWith("lead-")) await updateAssignedLead(id.slice(5), status === "contacted" ? "closed" : "contacted"); else await updateAgentJob(id.slice(4), status.startsWith("assigned") ? "scheduled" : status.startsWith("scheduled") ? "in_progress" : status.startsWith("in_progress") ? "inventory_ready" : status.startsWith("inventory_ready") ? "completed" : "assigned"); setReload((value) => value + 1); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update agent work."); } finally { setActionLoading(false); } }
  async function saveJobDetails() { if (!jobEdit) return; setActionLoading(true); setError(null); try { await updateAgentJob(jobEdit.id, jobEdit.status, commission.trim() ? Number(commission.replaceAll(",", "")) : null, jobNotes); setJobEdit(null); setCommission(""); setJobNotes(""); setReload((value) => value + 1); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update agent job details."); } finally { setActionLoading(false); } }

  const status = data?.status ?? copy.status(account);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title={copy.title} subtitle={copy.subtitle} onBack={onBack} />
      <View style={styles.statusCard}>
        <View style={styles.largeIcon}><Ionicons name={copy.icon} size={28} color={colors.success} /></View>
        <View style={styles.flex}><Text style={styles.statusLabel}>{copy.statusLabel}</Text><Text style={styles.statusValue}>{status}</Text></View>
      </View>
      {!account ? (
        <View style={styles.gate}>
          <Ionicons name="lock-closed" size={20} color={colors.success} />
          <Text style={styles.gateCopy}>Sign in to load your protected Hazi data and available actions.</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={onRequireAuth}><Text style={styles.buttonText}>Sign in or create account</Text></Pressable>
        </View>
      ) : null}
      {loading ? <ActivityIndicator accessibilityLabel="Loading protected account data" color={colors.success} style={styles.loader} /> : null}
      {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={20} color="#ffaaa1" /><Text style={styles.errorText}>{error}</Text></View> : null}
      {data?.tiles.length ? <View style={styles.tiles}>{data.tiles.map((tile) => <View key={tile.label} style={styles.tile}><Text style={styles.tileLabel}>{tile.label}</Text><Text style={styles.tileValue}>{tile.value}</Text></View>)}</View> : null}
      {data?.rows.length ? <><Text style={styles.sectionTitle}>Recent activity</Text><View style={styles.list}>{data.rows.map((row) => <View key={row.id} style={styles.row}><View style={styles.flex}><Text style={styles.itemTitle}>{row.title}</Text><Text style={styles.itemCopy}>{row.detail}</Text></View><Text style={styles.rowStatus}>{row.status.replaceAll("_", " ")}</Text>{section === "listings" && !row.status.startsWith("agent managed") ? <><Pressable disabled={actionLoading} onPress={() => void listingAction(row.id, row.status)}><Text style={styles.link}>{row.status === "active" ? "Pause" : row.status === "draft" ? "Publish" : "Relist"}</Text></Pressable>{["draft", "active", "paused"].includes(row.status) ? <Pressable disabled={actionLoading} onPress={() => void openListing(row.id)}><Text style={styles.link}>Edit</Text></Pressable> : null}</> : null}{section === "agent" && (row.id.startsWith("available-") || row.id.startsWith("lead-") || (row.id.startsWith("job-") && !row.status.startsWith("completed") && !row.status.startsWith("cancelled"))) ? <Pressable disabled={actionLoading} onPress={() => void agentAction(row.id, row.status)}><Text style={styles.link}>{row.id.startsWith("available-") ? "Claim" : row.id.startsWith("lead-") ? (row.status === "contacted" ? "Close" : "Contacted") : "Advance"}</Text></Pressable> : null}{section === "agent" && row.id.startsWith("job-") ? <Pressable onPress={() => { const rawStatus = row.status.split(" · ")[0].replaceAll(" ", "_") as "assigned" | "scheduled" | "in_progress" | "inventory_ready" | "completed" | "cancelled"; setJobEdit({ id: row.id.slice(4), status: rawStatus }); }}><Text style={styles.link}>Details</Text></Pressable> : null}</View>)}</View></> : null}
      {data && !data.rows.length && section !== "payouts" ? <Text style={styles.empty}>No protected records are available in this section yet.</Text> : null}
      {account && section === "wallet" ? <View style={styles.actionRow}><Pressable style={styles.smallButton} onPress={() => setAction("fund")}><Text style={styles.smallButtonText}>Fund wallet</Text></Pressable><Pressable style={styles.smallButton} onPress={() => setAction("withdraw")}><Text style={styles.smallButtonText}>Withdraw</Text></Pressable></View> : null}
      {account && section === "payouts" ? <Pressable style={styles.smallButton} onPress={() => setAction("payout")}><Text style={styles.smallButtonText}>Update bank account</Text></Pressable> : null}
      {account ? <VerificationSupportActions section={section} onComplete={() => setReload((value) => value + 1)} onError={setError} /> : null}
      {listingEdit ? <View style={styles.form}><Text style={styles.itemTitle}>Edit listing</Text><TextInput value={listingEdit.title} onChangeText={(title) => setListingEdit({ ...listingEdit, title })} placeholder="Title" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={listingEdit.description} onChangeText={(description) => setListingEdit({ ...listingEdit, description })} multiline placeholder="Description" placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 92 }]} /><TextInput value={listingEdit.sellerPrice} onChangeText={(sellerPrice) => setListingEdit({ ...listingEdit, sellerPrice })} keyboardType="numeric" placeholder="Seller price" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={listingEdit.location} onChangeText={(location) => setListingEdit({ ...listingEdit, location })} placeholder="Pickup location" placeholderTextColor={colors.muted} style={styles.input} /><View style={styles.actionRow}>{["like_new", "good", "fair", "needs_repair"].map((condition) => <Pressable key={condition} onPress={() => setListingEdit({ ...listingEdit, condition })}><Text style={[styles.link, listingEdit.condition === condition && { color: colors.white }]}>{condition.replaceAll("_", " ")}</Text></Pressable>)}</View><View style={styles.preference}><Text style={styles.itemTitle}>Pickup available</Text><Switch value={listingEdit.pickupAvailable} onValueChange={(pickupAvailable) => setListingEdit({ ...listingEdit, pickupAvailable })} trackColor={{ true: colors.primary }} /></View><View style={styles.preference}><Text style={styles.itemTitle}>Delivery available</Text><Switch value={listingEdit.deliveryAvailable} onValueChange={(deliveryAvailable) => setListingEdit({ ...listingEdit, deliveryAvailable })} trackColor={{ true: colors.primary }} /></View><Pressable style={styles.cancelButton} onPress={() => void locateListing()}><Text style={styles.smallButtonText}>Confirm current pickup point</Text></Pressable><View style={styles.actionRow}><Pressable style={styles.cancelButton} onPress={() => setListingEdit(null)}><Text style={styles.smallButtonText}>Cancel</Text></Pressable><Pressable disabled={actionLoading} style={styles.smallButton} onPress={() => void saveListing()}>{actionLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.smallButtonText}>Save listing</Text>}</Pressable></View></View> : null}
      {jobEdit ? <View style={styles.form}><Text style={styles.itemTitle}>Agent job details</Text><TextInput value={commission} onChangeText={setCommission} keyboardType="numeric" placeholder="Commission amount (optional)" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={jobNotes} onChangeText={setJobNotes} multiline placeholder="Job notes (optional)" placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 82 }]} /><View style={styles.actionRow}><Pressable style={styles.cancelButton} onPress={() => setJobEdit(null)}><Text style={styles.smallButtonText}>Cancel</Text></Pressable><Pressable disabled={actionLoading} style={styles.smallButton} onPress={() => void saveJobDetails()}>{actionLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.smallButtonText}>Save details</Text>}</Pressable></View></View> : null}
      {action ? <View style={styles.form}><Text style={styles.itemTitle}>{action === "fund" ? "Fund wallet" : action === "withdraw" ? "Request withdrawal" : "Settlement account"}</Text>{action !== "payout" ? <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Amount in NGN" placeholderTextColor={colors.muted} style={styles.input} /> : null}{action !== "fund" ? <><TextInput value={bankName} onChangeText={setBankName} placeholder="Bank name" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" placeholder="Account number" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={accountName} onChangeText={setAccountName} placeholder="Account name" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={bankCode} onChangeText={setBankCode} placeholder="Bank code (optional)" placeholderTextColor={colors.muted} style={styles.input} /></> : null}<View style={styles.actionRow}><Pressable style={styles.cancelButton} onPress={() => setAction(null)}><Text style={styles.smallButtonText}>Cancel</Text></Pressable><Pressable disabled={actionLoading} style={styles.smallButton} onPress={() => void submitAccountAction()}>{actionLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.smallButtonText}>Continue</Text>}</Pressable></View></View> : null}
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

function VerificationSupportActions({ section, onComplete, onError }: { section: AccountSection; onComplete: () => void; onError: (message: string | null) => void }) {
  const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [subject, setSubject] = useState(""); const [description, setDescription] = useState(""); const [document, setDocument] = useState<ImagePicker.ImagePickerAsset | null>(null); const [selfie, setSelfie] = useState<ImagePicker.ImagePickerAsset | null>(null);
  if (section !== "verification" && section !== "support") return null;
  async function pick(kind: "document" | "selfie") { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return onError("Photo access is required."); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 }); if (!result.canceled) { if (kind === "document") setDocument(result.assets[0]); else setSelfie(result.assets[0]); } }
  async function submit() { setLoading(true); onError(null); try { if (section === "verification") { if (!document || !selfie) throw new Error("Choose an identity document and a live selfie."); await submitVerification(document, selfie, description); } else await submitSupport("marketplace", subject, description); Alert.alert(section === "verification" ? "Verification submitted" : "Ticket created", section === "verification" ? "Hazi will review your identity and liveness evidence." : "Hazi support will review your request."); setOpen(false); onComplete(); } catch (caught) { onError(caught instanceof Error ? caught.message : "Could not submit this request."); } finally { setLoading(false); } }
  if (!open) return <Pressable style={styles.smallButton} onPress={() => setOpen(true)}><Text style={styles.smallButtonText}>{section === "verification" ? "Submit verification" : "Create support ticket"}</Text></Pressable>;
  return <View style={styles.form}>{section === "support" ? <TextInput value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.muted} style={styles.input} /> : <><Pressable style={styles.cancelButton} onPress={() => void pick("document")}><Text style={styles.smallButtonText}>{document ? "Document selected" : "Choose identity document"}</Text></Pressable><Pressable style={styles.cancelButton} onPress={() => void pick("selfie")}><Text style={styles.smallButtonText}>{selfie ? "Selfie selected" : "Choose live selfie"}</Text></Pressable></>}<TextInput value={description} onChangeText={setDescription} multiline placeholder={section === "support" ? "Describe the issue" : "Optional verification notes"} placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 82 }]} /><View style={styles.actionRow}><Pressable style={styles.cancelButton} onPress={() => setOpen(false)}><Text style={styles.smallButtonText}>Cancel</Text></Pressable><Pressable style={styles.smallButton} disabled={loading} onPress={() => void submit()}>{loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.smallButtonText}>Submit</Text>}</Pressable></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 18, paddingBottom: 36 }, flex: { flex: 1 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceRaised, borderRadius: 22, padding: 18 },
  largeIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  statusLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" }, statusValue: { color: colors.text, fontSize: 21, fontWeight: "900", marginTop: 4, textTransform: "capitalize" },
  gate: { backgroundColor: colors.primarySoft, borderRadius: 20, padding: 17, marginTop: 14 }, gateCopy: { color: "#d8f7ed", fontSize: 13, lineHeight: 19, marginTop: 9 },
  loader: { marginTop: 24 }, error: { flexDirection: "row", gap: 10, backgroundColor: "#3d2021", borderRadius: 16, padding: 14, marginTop: 14 }, errorText: { flex: 1, color: "#ffaaa1", fontSize: 12, lineHeight: 18 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }, tile: { width: "48%", minHeight: 90, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 14, justifyContent: "space-between" }, tileLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" }, tileValue: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 9 },
  button: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.success, borderRadius: 15, padding: 14, alignItems: "center", marginTop: 14 }, buttonText: { color: colors.white, fontWeight: "900" },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900", marginTop: 26, marginBottom: 12 }, list: { gap: 10 },
  item: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }, rowStatus: { color: colors.success, fontSize: 10, fontWeight: "800", maxWidth: 120, textAlign: "right", textTransform: "capitalize" }, empty: { color: colors.muted, textAlign: "center", fontSize: 12, lineHeight: 18, padding: 20 },
  link: { color: colors.success, fontSize: 10, fontWeight: "900" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 }, smallButton: { flex: 1, minHeight: 48, backgroundColor: colors.primary, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }, cancelButton: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 15, alignItems: "center", justifyContent: "center" }, smallButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" }, form: { gap: 10, backgroundColor: colors.surfaceRaised, borderRadius: 18, padding: 15, marginTop: 14 }, input: { height: 51, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, borderRadius: 14, paddingHorizontal: 13 },
  itemIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, itemTitle: { color: colors.text, fontSize: 14, fontWeight: "800" }, itemCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 }, preference: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  note: { flexDirection: "row", gap: 10, backgroundColor: colors.surfaceRaised, borderRadius: 17, padding: 15, marginTop: 18 }, noteText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 }
});
