import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./marketplace";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export async function registerNativePush(userId: string) {
  if (!supabase || !Device.isDevice || Platform.OS === "web") return;
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("hazi-updates", { name: "Hazi updates", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], lightColor: "#0B6B50" });
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Hazi push project is not configured.");
  const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const nativeToken = (await Notifications.getDevicePushTokenAsync()).data;
  const now = new Date().toISOString();
  const result = await supabase.from("mobile_push_tokens").upsert({ user_id: userId, expo_push_token: expoToken, native_push_token: String(nativeToken), platform: Platform.OS, provider: Platform.OS === "android" ? "fcm" : "apns", status: "active", last_seen_at: now, updated_at: now }, { onConflict: "expo_push_token" });
  if (result.error) throw new Error(result.error.message);
}
