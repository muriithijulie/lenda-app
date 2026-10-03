import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue, uid } from "../../../lib/store";
import { getSupabase } from "../../../lib/supabaseServer";
import { requireStaff } from "../../../lib/auth";

export async function GET(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json(await getValue("staff"));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// Adds a staff member AND creates their login (a real Supabase Auth account,
// created server-side so it works immediately without needing the new
// person to confirm an email first). Share the email/password you set here
// with them directly — they can change their password after logging in via
// Supabase's own password-update flow.
export async function POST(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    const { name, email, password, role, tabs } = body;
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      return NextResponse.json({ error: error.message || "Could not create this staff member's login" }, { status: 400 });
    }

    const staff = (await getValue("staff")) || [];
    const member = {
      id: uid(),
      name,
      email,
      role: role || "Loan Officer",
      tabs: Array.isArray(tabs) ? tabs : [],
      authId: data.user.id,
    };
    staff.push(member);
    await setValue("staff", staff);
    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
