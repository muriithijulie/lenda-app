import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, setValue, uid } from "../../../lib/store";
import { logActivity } from "../../../lib/activity";
import { requireStaff } from "../../../lib/auth";
import { getSupabase } from "../../../lib/supabaseServer";

export async function GET(req) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json(await getValue("clients"));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body.name || !body.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    // Two legitimate ways to hit this route: (1) a client signing themselves
    // up from the landing page, which arrives with an authId — verified
    // below to actually match the signed-in Supabase user making the
    // request, not just trusted at face value; or (2) a staff member
    // registering a walk-in client with no authId. Anything else is refused.
    if (body.authId) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user || data.user.id !== body.authId) {
        return NextResponse.json({ error: "Authentication mismatch" }, { status: 401 });
      }
    } else {
      const me = await requireStaff(req);
      if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const clients = (await getValue("clients")) || [];

    if (body.authId) {
      const existing = clients.find(
        (c) => !c.authId && ((body.email && c.email === body.email) || c.phone === body.phone)
      );
      if (existing) {
        existing.authId = body.authId;
        existing.email = body.email || existing.email || "";
        await setValue("clients", clients);
        return NextResponse.json(existing, { status: 200 });
      }
    }

    const client = {
      id: uid(),
      name: body.name,
      phone: body.phone,
      email: body.email || "",
      authId: body.authId || null,
      nationalId: body.nationalId || "",
      income: Number(body.income) || 0,
      employment: body.employment || "Employed",
      dateJoined: new Date().toISOString().slice(0, 10),
    };
    clients.push(client);
    await setValue("clients", clients);
    await logActivity("👤", "client", `${client.name} registered as a new client`);
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
