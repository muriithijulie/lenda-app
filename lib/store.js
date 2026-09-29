import { getSupabase } from "./supabaseServer";

const TABLE = "store_kv";

const DEFAULTS = {
  rules: {
    minIncome: 10000,
    maxMultiplier: 3,
    interestRatePct: 12,
    termMonths: 6,
    allowed: ["Employed", "Self-employed", "Business owner"],
  },
  company: {
    name: "Hambi Loans",
    logoEmoji: "💠",
    tagline: "Fast, fair loans for growing businesses",
    address: "",
    regNumber: "",
    website: "",
    careEmail: "",
    carePhone: "",
    careWhatsapp: "",
  },
  payments: {
    mpesaPaybill: "",
    mpesaAccount: "",
    mpesaInstructions: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankBranch: "",
  },
  landing: {
    heroTitle: "Loans that fit your business",
    heroSubtitle: "Apply in minutes. Get a decision fast. Grow on your terms with Hambi Loans.",
    aboutText:
      "Hambi Loans helps small business owners and salaried workers access fair, transparent credit — no hidden fees, clear repayment terms.",
    features: [
      { title: "Fast approval", desc: "Applications reviewed quickly by our team." },
      { title: "Fair limits", desc: "Your limit is based on your income, not guesswork." },
      { title: "Flexible repayment", desc: "Clear due dates and running balance, always visible." },
    ],
  },
  clients: [],
  loans: [],
  staff: [],
  activity: [],
};

async function readKey(key) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (data) return data.value;
  // First time this key is read: seed it with the default so the row exists from now on.
  const def = DEFAULTS[key] ?? null;
  await writeKey(key, def);
  return def;
}

async function writeKey(key, value) {
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
  return value;
}

export async function getAll() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(TABLE).select("key,value");
  if (error) throw error;
  const result = { ...DEFAULTS };
  (data || []).forEach((row) => {
    result[row.key] = row.value;
  });
  return result;
}

export async function getValue(key) {
  return readKey(key);
}

export async function setValue(key, value) {
  return writeKey(key, value);
}

export async function pushItem(key, item) {
  const list = (await readKey(key)) || [];
  list.push(item);
  await writeKey(key, list);
  return item;
}

export async function updateItem(key, id, patch) {
  const list = (await readKey(key)) || [];
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  await writeKey(key, list);
  return list[idx];
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
