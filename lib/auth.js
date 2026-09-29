import { getSupabase } from "./supabaseServer";
import { getValue } from "./store";

// Verifies the "Authorization: Bearer <access_token>" header (sent by the
// client portal) against Supabase Auth, then looks up the matching record in
// our own clients list by authId. Returns { user: null, client: null } if
// there's no valid token — callers use that to distinguish "not signed in"
// (portal) from "no auth header at all" (admin dashboard, which is allowed
// to see everything since it doesn't send one).
export async function getAuthedClient(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { user: null, client: null };

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { user: null, client: null };

  const clients = (await getValue("clients")) || [];
  const client = clients.find((c) => c.authId === data.user.id) || null;
  return { user: data.user, client };
}
