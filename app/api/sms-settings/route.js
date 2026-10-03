import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue } from "../../../lib/store";
import { requireStaff } from "../../../lib/auth";

export async function GET(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json(await getValue("smsConfig"));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const body = await req.json();
    return NextResponse.json(await setValue("smsConfig", body));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
