import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, updateItem } from "../../../../lib/store";
import { logActivity } from "../../../../lib/activity";
import { fmt } from "../../../../lib/eligibility";

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, amount } = body;

    const loans = (await getValue("loans")) || [];
    const loan = loans.find((l) => l.id === id);
    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

    const clients = (await getValue("clients")) || [];
    const client = clients.find((c) => c.id === loan.clientId);
    const clientName = client ? client.name : "Client";
    const rules = await getValue("rules");

    let patch = {};

    if (action === "review") {
      patch = { status: "reviewing" };
      await logActivity("🔍", "loan", `Loan application from ${clientName} moved to review`);
    } else if (action === "approve") {
      const total = Math.round(loan.amount * (1 + rules.interestRatePct / 100));
      const due = new Date();
      due.setMonth(due.getMonth() + rules.termMonths);
      patch = { status: "approved", totalDue: total, paidSoFar: 0, dueDate: due.toISOString().slice(0, 10) };
      await logActivity("✅", "loan", `Loan of ${fmt(loan.amount)} awarded to ${clientName}`);
    } else if (action === "reject") {
      patch = { status: "rejected" };
      await logActivity("❌", "loan", `Loan application from ${clientName} rejected`);
    } else if (action === "disburse") {
      patch = { status: "active", disbursedDate: new Date().toISOString().slice(0, 10) };
      await logActivity("💸", "loan", `${fmt(loan.amount)} disbursed to ${clientName}`);
    } else if (action === "pay") {
      const amt = Number(amount);
      if (!amt || amt <= 0) return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
      const paidSoFar = (loan.paidSoFar || 0) + amt;
      const paymentRecord = { amount: amt, date: new Date().toISOString().slice(0, 10) };
      const payments = [...(loan.payments || []), paymentRecord];
      patch = { paidSoFar, payments, status: paidSoFar >= loan.totalDue ? "closed" : "active" };
      await logActivity("💳", "payment", `${clientName} paid ${fmt(amt)}`);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const updated = await updateItem("loans", id, patch);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
