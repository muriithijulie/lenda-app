import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue, uid } from "../../../lib/store";
import { logActivity } from "../../../lib/activity";

export async function GET() {
  try {
    return NextResponse.json(await getValue("clients"));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body.name || !body.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    const clients = (await getValue("clients")) || [];

    // If this is a self-signup (authId present) and staff already registered
    // this person at the counter with the same email or phone, link the new
    // login to that existing record instead of creating a duplicate.
    if (body.authId) {
      const existing = clients.find(
        (c) => !c.authId && ((body.email && c.email === body.email) || c.phone === body.phone)
      );
      if (existing) {
        existing.authId = body.authId;
        existing.email = body.email || existing.email || "";
        await setValue("clients", clients);
        return NextResponse.json(existing, { status: 200 });
      }
    }

    const client = {
      id: uid(),
      name: body.name,
      phone: body.phone,
      email: body.email || "",
      authId: body.authId || null,
      nationalId: body.nationalId || "",
      income: Number(body.income) || 0,
      employment: body.employment || "Employed",
      dateJoined: new Date().toISOString().slice(0, 10),
    };
    clients.push(client);
    await setValue("clients", clients);
    await logActivity("👤", "client", `${client.name} registered as a new client`);
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
