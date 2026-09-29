import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, pushItem, uid } from "../../../lib/store";
import { logActivity } from "../../../lib/activity";

export async function GET() {
  return NextResponse.json(await getValue("clients"));
}

export async function POST(req) {
  const body = await req.json();
  if (!body.name || !body.phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }
  const client = {
    id: uid(),
    name: body.name,
    phone: body.phone,
    nationalId: body.nationalId || "",
    income: Number(body.income) || 0,
    employment: body.employment || "Employed",
    dateJoined: new Date().toISOString().slice(0, 10),
  };
  await pushItem("clients", client);
  await logActivity("👤", "client", `${client.name} registered as a new client`);
  return NextResponse.json(client, { status: 201 });
}
