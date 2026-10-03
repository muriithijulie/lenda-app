import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getAuthedStaff } from "../../../../lib/auth";

export async function GET(req) {
  try {
    const { user, staff } = await getAuthedStaff(req);
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (!staff) return NextResponse.json({ error: "No staff profile is linked to this account" }, { status: 404 });
    return NextResponse.json(staff);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
