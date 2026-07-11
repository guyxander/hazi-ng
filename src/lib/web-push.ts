import webPush from "web-push";

export type PushDelivery = {
  delivery_id: string;
  notification_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  notification_type: string;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured.");
  }

  webPush.setVapidDetails("mailto:hello@hazi.ng", publicKey, privateKey);
}

export function isWebPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendBrowserPush(delivery: PushDelivery) {
  configureWebPush();

  const result = await webPush.sendNotification(
    {
      endpoint: delivery.endpoint,
      keys: {
        p256dh: delivery.p256dh,
        auth: delivery.auth
      }
    },
    JSON.stringify({
      title: delivery.title,
      body: delivery.body,
      type: delivery.notification_type,
      url: "/dashboard/notifications"
    }),
    {
      TTL: 60 * 60 * 24
    }
  );

  return String(result.headers.location ?? result.statusCode ?? delivery.delivery_id);
}
