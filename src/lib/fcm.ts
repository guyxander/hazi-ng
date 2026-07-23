import { createSign } from "node:crypto";

export type MobilePushDelivery = {
  delivery_id: string;
  notification_id: string;
  token_id: string;
  native_push_token: string;
  title: string;
  body: string;
  notification_type: string;
};

type FirebaseCredential = {
  client_email: string;
  private_key: string;
  project_id: string;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function credential(): FirebaseCredential | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<FirebaseCredential>;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return parsed as FirebaseCredential;
  } catch {
    return null;
  }
}

export function isFcmConfigured() {
  return credential() !== null;
}

async function accessToken(config: FirebaseCredential) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: config.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(config.private_key, "base64url")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payload = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || `FCM authentication failed (${response.status}).`);
  }

  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000
  };
  return payload.access_token;
}

export async function sendFcmPush(delivery: MobilePushDelivery) {
  const config = credential();
  if (!config) throw new Error("FCM V1 is not configured.");

  const token = await accessToken(config);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.project_id)}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token: delivery.native_push_token,
        notification: { title: delivery.title, body: delivery.body },
        data: { notificationId: delivery.notification_id, type: delivery.notification_type },
        android: { priority: "high", notification: { channel_id: "hazi-updates", color: "#0B6B50", sound: "default" } }
      }
    })
  });
  const payload = await response.json() as { name?: string; error?: { message?: string; status?: string } };
  if (!response.ok || !payload.name) {
    throw new Error(payload.error?.message || payload.error?.status || `FCM delivery failed (${response.status}).`);
  }
  return payload.name;
}
