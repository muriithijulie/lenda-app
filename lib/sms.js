export const SMS_PROVIDERS = [
  { key: "africastalking", name: "Africa's Talking", recommended: true, wired: true },
  { key: "onfon", name: "Onfon Media", recommended: false, wired: false },
  { key: "infobip", name: "Infobip", recommended: false, wired: false },
  { key: "twilio", name: "Twilio SMS", recommended: false, wired: false },
  { key: "vonage", name: "Vonage (Nexmo)", recommended: false, wired: false },
  { key: "bonga", name: "Bonga SMS", recommended: false, wired: false },
];

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

// Sends an SMS if a real, configured provider integration exists. Only
// Africa's Talking is actually wired up right now (it's the most common
// gateway for Kenya and has a simple REST API); the other providers in
// SMS_PROVIDERS are selectable in Settings for parity with common ISP/fintech
// admin panels, but picking one of them just logs the message rather than
// silently pretending it sent — wire in that provider's SDK/API here to
// make it real.
export async function sendSms(smsConfig, to, message) {
  if (!smsConfig || !smsConfig.provider) {
    return { sent: false, note: "No SMS provider configured" };
  }
  const meta = SMS_PROVIDERS.find((p) => p.key === smsConfig.provider);
  if (!meta?.wired) {
    return { sent: false, note: `${meta?.name || smsConfig.provider} isn't wired up to send yet — message was logged only` };
  }
  if (smsConfig.provider === "africastalking") {
    if (!smsConfig.apiKey || !smsConfig.username) {
      return { sent: false, note: "Africa's Talking is selected but API key/username are missing" };
    }
    try {
      const result = await sendViaAfricasTalking(smsConfig, to, message);
      return { sent: true, ...result };
    } catch (err) {
      return { sent: false, note: err.message || "Africa's Talking send failed" };
    }
  }
  return { sent: false, note: "Provider not implemented" };
}
