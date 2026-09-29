import { createClient } from "@supabase/supabase-js";

let client = null;

// Client-side only. Uses the public anon key, which is safe to expose to the
// browser by design — we only ever use it for Supabase Auth (signUp,
// signInWithPassword, getSession), never for reading/writing app data
// directly. All data still goes through our own /api/* routes, which use the
// service role key server-side (see lib/supabaseServer.js).
export function getSupabaseBrowser() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set them in .env.local for development, and in Render's Environment " +
        "tab for deployment. See README.md."
    );
  }
  client = createClient(url, key);
  return client;
}
