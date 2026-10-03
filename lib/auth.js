import { getSupabase } from "./supabaseServer";
import { getValue } from "./store";

async function verifyToken(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Verifies the "Authorization: Bearer <access_token>" header (sent by the
// client portal) against Supabase Auth, then looks up the matching record in
// our own clients list by authId.
export async function getAuthedClient(req) {
  const user = await verifyToken(req);
  if (!user) return { user: null, client: null };
  const clients = (await getValue("clients")) || [];
  const client = clients.find((c) => c.authId === user.id) || null;
  return { user, client };
}

// Same idea, but resolves to a staff record instead of a client record —
// used to gate the admin dashboard and its API routes.
export async function getAuthedStaff(req) {
  const user = await verifyToken(req);
  if (!user) return { user: null, staff: null };
  const staff = (await getValue("staff")) || [];
  const member = staff.find((s) => s.authId === user.id) || null;
  return { user, staff: member };
}

// Convenience for routes that are staff-only: returns the staff record, or
// null if the request isn't from a signed-in staff member.
export async function requireStaff(req) {
  const { staff } = await getAuthedStaff(req);
  return staff;
}
