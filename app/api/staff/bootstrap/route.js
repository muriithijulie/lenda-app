import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue, uid } from "../../../../lib/store";
import { getSupabase } from "../../../../lib/supabaseServer";
import { ALL_TAB_KEYS } from "../../../../lib/tabs";

// Tells the client whether any staff account exists yet. Safe to call with
// no auth — it reveals nothing except a boolean.
export async function GET() {
  try {
    const staff = (await getValue("staff")) || [];
    return NextResponse.json({ hasStaff: staff.length > 0 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// Creates the very first admin account. Only works while the staff list is
// empty — once any staff member exists, this always refuses, so it can't be
// used to add a backdoor account later. Creates the Supabase Auth user
// server-side (via the admin API, bypassing email confirmation) so the
// account works immediately regardless of the project's email-confirmation
// setting, since this is the one account nobody else can create for you.
export async function POST(req) {
  try {
    const staff = (await getValue("staff")) || [];
    if (staff.length > 0) {
      return NextResponse.json({ error: "Setup has already been completed" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password } = body;
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      return NextResponse.json({ error: error.message || "Could not create the admin account" }, { status: 400 });
    }

    const member = { id: uid(), name, email, role: "Admin", tabs: ALL_TAB_KEYS, authId: data.user.id };
    await setValue("staff", [member]);
    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
