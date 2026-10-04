// Field meanings differ per provider but are stored in the same four generic
// columns (apiKey, username, senderId) so Settings → SMS Provider can stay
// one simple form. See FIELD_LABELS below for what each field actually means
// per provider, and the provider notes for where to find each value.
export const SMS_PROVIDERS = [
  { key: "africastalking", name: "Africa's Talking", recommended: true, wired: true },
  { key: "onfon", name: "Onfon Media", recommended: false, wired: true },
  { key: "infobip", name: "Infobip", recommended: false, wired: true },
  { key: "twilio", name: "Twilio SMS", recommended: false, wired: true },
  { key: "vonage", name: "Vonage (Nexmo)", recommended: false, wired: true },
  { key: "bonga", name: "Bonga SMS", recommended: false, wired: false },
];

// What the generic apiKey/username/senderId fields actually hold for each
// provider, and where to find them — shown in the Settings form so the
// labels match what the person is actually pasting in.
export const FIELD_LABELS = {
  africastalking: {
    apiKey: "API Key",
    username: "Username",
    senderId: "Sender ID (optional)",
    note: "Register at africastalking.com → Settings → API Key.",
  },
  onfon: {
    apiKey: "API Key",
    username: "Client ID",
    senderId: "Sender ID",
    note: "Dashboard → Settings → API Settings for API Key & Client ID; Dashboard → Sender IDs for an approved Sender ID.",
  },
  infobip: {
    apiKey: "API Key",
    username: "Base URL (e.g. https://xxxxx.api.infobip.com)",
    senderId: "Sender (optional)",
    note: "Your base URL and API key are both on your Infobip dashboard homepage.",
  },
  twilio: {
    apiKey: "Auth Token",
    username: "Account SID",
    senderId: "From number (e.g. +1XXXXXXXXXX, must be a Twilio number)",
    note: "Found on your Twilio Console dashboard. The From number must be a number you've purchased or verified in Twilio — it can't be an arbitrary sender name.",
  },
  vonage: {
    apiKey: "API Key",
    username: "API Secret",
    senderId: "Sender name/number",
    note: "Found on your Vonage API dashboard under API settings.",
  },
  bonga: {
    apiKey: "API Key",
    username: "Username",
    senderId: "Sender ID",
    note: "",
  },
};

function normalizeKenyanPhone(phone) {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("254")) return "+" + digits;
  if (digits.startsWith("0")) return "+254" + digits.slice(1);
  return "+254" + digits;
}

async function sendViaAfricasTalking(config, to, message) {
  const params = new URLSearchParams();
  params.set("username", config.username || "");
  params.set("to", normalizeKenyanPhone(to));
  params.set("message", message);
  if (config.senderId) params.set("from", config.senderId);

  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey: config.apiKey || "",
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  const recipient = data?.SMSMessageData?.Recipients?.[0];
  if (!res.ok || !recipient || !["Success", "Sent"].includes(recipient.status)) {
    throw new Error(recipient?.status || data?.SMSMessageData?.Message || "Africa's Talking rejected the message");
  }
  return { provider: "africastalking", cost: recipient.cost, messageId: recipient.messageId };
}

// Onfon Media (Kenya) — REST API confirmed against their own published docs
// at docs.onfonmedia.co.ke/rest/sms/.
async function sendViaOnfon(config, to, message) {
  const res = await fetch("https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      ApiKey: config.apiKey || "",
      ClientId: config.username || "",
      SenderId: config.senderId || "",
      MessageParameters: [{ Number: normalizeKenyanPhone(to).replace("+", ""), Text: message }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.Description || data?.Message || "Onfon Media rejected the message");
  }
  return { provider: "onfon", raw: data };
}

// Infobip's standard SMS endpoint. Infobip assigns each account its own base
// URL (shown on your dashboard) rather than a single shared one — that's
// stored in the "username" field here since Infobip has no separate
// username/password concept.
async function sendViaInfobip(config, to, message) {
  const baseUrl = (config.username || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("Infobip base URL is required (enter it in the Username field)");

  const res = await fetch(`${baseUrl}/sms/2/text/advanced`, {
    method: "POST",
    headers: {
      Authorization: `App ${config.apiKey || ""}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          destinations: [{ to: normalizeKenyanPhone(to).replace("+", "") }],
          from: config.senderId || undefined,
          text: message,
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const status = data?.messages?.[0]?.status;
  if (!res.ok || !status) {
    throw new Error(data?.requestError?.serviceException?.text || "Infobip rejected the message");
  }
  return { provider: "infobip", messageId: data.messages[0].messageId, status: status.name };
}

// Twilio — config.username holds the Account SID, config.apiKey holds the
// Auth Token, config.senderId holds a real Twilio phone number.
async function sendViaTwilio(config, to, message) {
  const accountSid = config.username || "";
  const authToken = config.apiKey || "";
  const from = config.senderId || "";
  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio requires Account SID, Auth Token, and a From number");
  }
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const params = new URLSearchParams();
  params.set("To", normalizeKenyanPhone(to));
  params.set("From", from);
  params.set("Body", message);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Twilio rejected the message");
  }
  return { provider: "twilio", sid: data.sid, status: data.status };
}

// Vonage (Nexmo) SMS API — config.username holds the API Secret here (the
// generic field name doesn't match Vonage's own terminology, but the value
// is the same thing).
async function sendViaVonage(config, to, message) {
  const params = new URLSearchParams();
  params.set("api_key", config.apiKey || "");
  params.set("api_secret", config.username || "");
  params.set("to", normalizeKenyanPhone(to).replace("+", ""));
  params.set("from", config.senderId || "Vonage");
  params.set("text", message);

  const res = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  const msg = data?.messages?.[0];
  if (!res.ok || !msg || msg.status !== "0") {
    throw new Error(msg?.["error-text"] || "Vonage rejected the message");
  }
  return { provider: "vonage", messageId: msg["message-id"] };
}

const SENDERS = {
  africastalking: sendViaAfricasTalking,
  onfon: sendViaOnfon,
  infobip: sendViaInfobip,
  twilio: sendViaTwilio,
  vonage: sendViaVonage,
};

// Sends an SMS if a real, configured provider integration exists.
// Africa's Talking, Onfon Media, Infobip, Twilio and Vonage are wired up
// against each provider's own documented API. Bonga SMS is listed for
// parity with common ISP/fintech admin panels but isn't wired up — no
// verified public API documentation could be found for it, so rather than
// guess at an endpoint and risk silently failing (or worse, sending
// somewhere wrong), it just logs instead. Wire it in here once you have
// the provider's actual API docs.
export async function sendSms(smsConfig, to, message) {
  if (!smsConfig || !smsConfig.provider) {
    return { sent: false, note: "No SMS provider configured" };
  }
  const meta = SMS_PROVIDERS.find((p) => p.key === smsConfig.provider);
  if (!meta?.wired) {
    return { sent: false, note: `${meta?.name || smsConfig.provider} isn't wired up to send yet — message was logged only` };
  }
  const sender = SENDERS[smsConfig.provider];
  if (!sender) {
    return { sent: false, note: "Provider not implemented" };
  }
  try {
    const result = await sender(smsConfig, to, message);
    return { sent: true, ...result };
  } catch (err) {
    return { sent: false, note: err.message || `${meta.name} send failed` };
  }
}
