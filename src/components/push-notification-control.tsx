"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PushNotificationControlProps = {
  userId: string;
  existingCount: number;
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function getSubscriptionKeys(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint ?? subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? ""
  };
}

export function PushNotificationControl({ userId, existingCount }: PushNotificationControlProps) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [status, setStatus] = useState<string>("");
  const configured = Boolean(vapidPublicKey);
  const ready = supported && configured;
  const statusCopy = useMemo(() => {
    if (!supported) {
      return "This browser does not support push notifications.";
    }

    if (!configured) {
      return "Push collection is built. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to enable browser subscriptions.";
    }

    if (permission === "granted") {
      return existingCount > 0 ? `${existingCount} browser subscription${existingCount === 1 ? "" : "s"} saved.` : "Push permission is granted. Save this browser to receive updates.";
    }

    if (permission === "denied") {
      return "Browser push is blocked. Enable notifications in your browser settings.";
    }

    return "Enable browser push for escrow, bid, and delivery alerts.";
  }, [configured, existingCount, permission, supported]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
      if ("Notification" in window) {
        setPermission(Notification.permission);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function enablePush() {
    if (!ready || !vapidPublicKey) {
      return;
    }

    setStatus("Preparing browser push...");

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);

    if (nextPermission !== "granted") {
      setStatus("Permission was not granted.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/push-worker.js");
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    const keys = getSubscriptionKeys(subscription);

    if (!keys.endpoint || !keys.p256dh || !keys.auth) {
      setStatus("Browser did not return a complete push subscription.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: keys.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
      status: "active",
      failure_reason: null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "endpoint" });

    setStatus(error ? error.message : "Browser push saved.");
  }

  async function disablePush() {
    if (!supported) {
      return;
    }

    setStatus("Removing browser push...");

    const registration = await navigator.serviceWorker.getRegistration("/push-worker.js");
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      const supabase = createSupabaseBrowserClient();
      await supabase
        .from("push_subscriptions")
        .update({ status: "disabled", updated_at: new Date().toISOString() })
        .eq("endpoint", subscription.endpoint)
        .eq("user_id", userId);
      await subscription.unsubscribe();
    }

    setStatus("Browser push disabled on this device.");
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
          <BellRing size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Browser push</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{statusCopy}</p>
          {status ? <p className="mt-2 text-xs font-bold text-[var(--primary)]">{status}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="button button-primary" type="button" disabled={!ready || permission === "denied"} onClick={enablePush}>
          Enable on this browser
        </button>
        <button className="button button-outline" type="button" disabled={!supported} onClick={disablePush}>
          Disable this browser
        </button>
      </div>
    </div>
  );
}
