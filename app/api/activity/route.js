import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue } from "../../../lib/store";

export async function GET() {
  return NextResponse.json(await getValue("activity"));
}
