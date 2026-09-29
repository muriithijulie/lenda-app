import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue } from "../../../lib/store";

export async function GET() {
  return NextResponse.json(await getValue("payments"));
}

export async function PUT(req) {
  const body = await req.json();
  return NextResponse.json(await setValue("payments", body));
}
