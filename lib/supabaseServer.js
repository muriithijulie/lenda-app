import { createClient } from "@supabase/supabase-js";

let client = null;

// Server-side only. Never import this file from a "use client" component —
// the service role key must never reach the browser bundle.
export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
        "Set them in .env.local for development, and in your Render service's " +
        "Environment settings for deployment. See README.md for setup steps."
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
