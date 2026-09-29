import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, pushItem, uid } from "../../../lib/store";
import { logActivity } from "../../../lib/activity";
import { eligibility, fmt } from "../../../lib/eligibility";

export async function GET() {
  const loans = (await getValue("loans")) || [];
  return NextResponse.json([...loans].sort((a, b) => (b.appliedDate || "").localeCompare(a.appliedDate || "")));
}

export async function POST(req) {
  const body = await req.json();
  const { clientId, amount } = body;
  const clients = (await getValue("clients")) || [];
  const client = clients.find((c) => c.id === clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const rules = await getValue("rules");
  const elig = eligibility(client, rules);
  if (!elig.qualifies) {
    return NextResponse.json({ error: "Client does not currently qualify" }, { status: 400 });
  }
  if (!amount || amount <= 0 || amount > elig.maxLoan) {
    return NextResponse.json({ error: `Amount must be between 1 and ${elig.maxLoan}` }, { status: 400 });
  }

  const loan = {
    id: uid(),
    clientId,
    amount: Number(amount),
    status: "pending",
    appliedDate: new Date().toISOString().slice(0, 10),
  };
  await pushItem("loans", loan);
  await logActivity("📝", "loan", `${client.name} applied for ${fmt(amount)}`);
  return NextResponse.json(loan, { status: 201 });
}
