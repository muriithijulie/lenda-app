import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, pushItem, uid } from "../../../lib/store";

export async function GET() {
  return NextResponse.json(await getValue("staff"));
}

export async function POST(req) {
  const body = await req.json();
  if (!body.name || !body.email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  const member = {
    id: uid(),
    name: body.name,
    email: body.email,
    role: body.role || "Loan Officer",
    tabs: Array.isArray(body.tabs) ? body.tabs : [],
  };
  await pushItem("staff", member);
  return NextResponse.json(member, { status: 201 });
}
