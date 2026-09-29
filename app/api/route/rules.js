import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue } from "../../../lib/store";

export async function GET() {
  try {
    return NextResponse.json(await getValue("rules"));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    return NextResponse.json(await setValue("rules", body));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
