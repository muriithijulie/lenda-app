import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getAuthedClient } from "../../../lib/auth";

export async function GET(req) {
  try {
    const { user, client } = await getAuthedClient(req);
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (!client) return NextResponse.json({ error: "No client profile is linked to this account yet" }, { status: 404 });
    return NextResponse.json(client);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
