type OutboxNotification = {
  id: string;
  channel: string;
  destination: string | null;
  subject: string;
  body: string;
};

async function sendTermiiSms(notification: OutboxNotification) {
  const apiKey = process.env.TERMII_API_KEY;

  if (!apiKey || !notification.destination) {
    throw new Error("Termii API key or destination is missing.");
  }

  const response = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      to: notification.destination,
      from: process.env.TERMII_SENDER_ID || "N-Alert",
      sms: notification.body,
      type: "plain",
      channel: "generic"
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload?.message === "string" ? payload.message : "Termii SMS failed.");
  }

  return String(payload?.message_id ?? payload?.messageId ?? payload?.pinId ?? notification.id);
}

async function sendResendEmail(notification: OutboxNotification) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !notification.destination) {
    throw new Error("Resend API key or destination is missing.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Hazi.ng <notifications@hazi.ng>",
      to: [notification.destination],
      subject: notification.subject,
      text: notification.body
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload?.message === "string" ? payload.message : "Resend email failed.");
  }

  return String(payload?.id ?? notification.id);
}

export async function sendExternalNotification(notification: OutboxNotification) {
  if (notification.channel === "email") {
    return {
      provider: "resend",
      providerMessageId: await sendResendEmail(notification)
    };
  }

  return {
    provider: "termii",
    providerMessageId: await sendTermiiSms(notification)
  };
}
