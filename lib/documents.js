import { getSupabase } from "@/lib/supabaseServer";

const BUCKET = "client-documents";

async function ensureBucket() {
  const supabase = getSupabase();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    // Private on purpose — these are ID copies and other sensitive client
    // documents. Nothing in this bucket is ever served from a public URL;
    // viewing always goes through a short-lived signed URL (see
    // getSignedUrl below), generated on demand for a signed-in staff member.
    await supabase.storage.createBucket(BUCKET, { public: false });
  }
}

export async function uploadDocument(clientId, file, label) {
  await ensureBucket();
  const supabase = getSupabase();
  const safeName = (file.name || "document").replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${clientId}/${Date.now()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(arrayBuffer), {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;

  return {
    path,
    label: label || file.name,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  };
}

export async function getSignedUrl(path) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocument(path) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
