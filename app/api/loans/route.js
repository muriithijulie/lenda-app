import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue, uid } from "../../../lib/store";
import { logActivity } from "../../../lib/activity";
import { eligibility, fmt } from "../../../lib/eligibility";
import { getAuthedClient, getAuthedStaff } from "../../../lib/auth";

export async function GET(req) {
  try {
    const loans = (await getValue("loans")) || [];
    const sorted = [...loans].sort((a, b) => (b.appliedDate || "").localeCompare(a.appliedDate || ""));

    const { staff } = await getAuthedStaff(req);
    if (staff) return NextResponse.json(sorted);

    const { client } = await getAuthedClient(req);
    if (client) return NextResponse.json(sorted.filter((l) => l.clientId === client.id));

    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { user, client } = await getAuthedClient(req);
    if (!user) return NextResponse.json({ error: "Please sign in to apply for a loan" }, { status: 401 });
    if (!client) return NextResponse.json({ error: "No client profile is linked to this account yet" }, { status: 404 });

    const body = await req.json();
    const { amount } = body;

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
      clientId: client.id,
      amount: Number(amount),
      status: "pending",
      appliedDate: new Date().toISOString().slice(0, 10),
    };
    const loans = (await getValue("loans")) || [];
    loans.push(loan);
    await setValue("loans", loans);
    await logActivity("📝", "loan", `${client.name} applied for ${fmt(amount)}`);
    return NextResponse.json(loan, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
