import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue, uid } from "../../../lib/store";
import { logActivity } from "../../../lib/activity";
import { sendSms } from "../../../lib/sms";
import { requireStaff } from "../../../lib/auth";

export async function GET(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const log = (await getValue("communications")) || [];
    return NextResponse.json([...log].sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || "")));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    const { clientIds, message, template } = body;
    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json({ error: "No recipients specified" }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    const clients = (await getValue("clients")) || [];
    const smsConfig = await getValue("smsConfig");
    const log = (await getValue("communications")) || [];
    const sentAt = new Date().toISOString();
    const entries = [];

    for (const clientId of clientIds) {
      const client = clients.find((c) => c.id === clientId);
      if (!client) continue;

      const result = client.phone
        ? await sendSms(smsConfig, client.phone, message)
        : { sent: false, note: "Client has no phone number on file" };

      const entry = {
        id: uid(),
        clientId,
        clientName: client.name,
        template: template || "custom",
        message,
        sentAt,
        deliveryStatus: result.sent ? "sent" : "logged_only",
        deliveryNote: result.note || (result.sent ? `Sent via ${result.provider}` : ""),
      };
      log.push(entry);
      entries.push(entry);
    }

    await setValue("communications", log);
    const sentCount = entries.filter((e) => e.deliveryStatus === "sent").length;
    if (entries.length === 1) {
      await logActivity("📨", "client", `Reminder ${entries[0].deliveryStatus === "sent" ? "sent" : "logged"} for ${entries[0].clientName}`);
    } else if (entries.length > 1) {
      await logActivity("📨", "client", `Reminder sent to ${entries.length} clients (${sentCount} delivered by SMS)`);
    }

    return NextResponse.json({ sent: entries.length, delivered: sentCount, entries }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
