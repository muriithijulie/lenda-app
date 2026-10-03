import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue } from "../../../lib/store";
import { requireStaff } from "../../../lib/auth";

// GET stays public on purpose — every visitor to the landing page and
// client portal needs to read the portal theme to render the page at all,
// before they've signed in to anything.
export async function GET() {
  try {
    return NextResponse.json(await getValue("theme"));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const body = await req.json();
    return NextResponse.json(await setValue("theme", body));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
