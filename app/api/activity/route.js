import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue } from "../../../lib/store";
import { requireStaff } from "../../../lib/auth";

export async function GET(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json(await getValue("activity"));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
