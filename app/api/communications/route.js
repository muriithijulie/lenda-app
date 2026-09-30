import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue, uid } from "../../../lib/store";
import { logActivity } from "../../../lib/activity";

export async function GET() {
  try {
    const log = (await getValue("communications")) || [];
    return NextResponse.json([...log].sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || "")));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// This records that a reminder was sent and logs it for the team to see —
// it does not actually dispatch an SMS/email/WhatsApp message. Wire in a
// provider (e.g. Africa's Talking, Twilio, WhatsApp Business API) inside
// this handler to make sending real.
export async function POST(req) {
  try {
    const body = await req.json();
    const { clientIds, message, template } = body;
    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json({ error: "No recipients specified" }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    const clients = (await getValue("clients")) || [];
    const log = (await getValue("communications")) || [];
    const sentAt = new Date().toISOString();
    const entries = [];

    for (const clientId of clientIds) {
      const client = clients.find((c) => c.id === clientId);
      if (!client) continue;
      const entry = {
        id: uid(),
        clientId,
        clientName: client.name,
        template: template || "custom",
        message,
        sentAt,
      };
      log.push(entry);
      entries.push(entry);
    }

    await setValue("communications", log);
    if (entries.length === 1) {
      await logActivity("📨", "client", `Reminder sent to ${entries[0].clientName}`);
    } else if (entries.length > 1) {
      await logActivity("📨", "client", `Reminder sent to ${entries.length} clients`);
    }

    return NextResponse.json({ sent: entries.length, entries }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
