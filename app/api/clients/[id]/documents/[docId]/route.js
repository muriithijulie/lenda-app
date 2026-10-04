import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, updateItem } from "@/lib/store";
import { requireStaff } from "@/lib/auth";
import { getSignedUrl, deleteDocument } from "@/lib/documents";

// Returns a short-lived signed URL to view/download this one document.
// Nothing is ever public — a fresh URL is generated per request for a
// signed-in staff member only.
export async function GET(req, { params }) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id, docId } = await params;
    const clients = (await getValue("clients")) || [];
    const client = clients.find((c) => c.id === id);
    const doc = client?.documents?.find((d) => d.id === docId);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const url = await getSignedUrl(doc.path);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id, docId } = await params;
    const clients = (await getValue("clients")) || [];
    const client = clients.find((c) => c.id === id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const doc = (client.documents || []).find((d) => d.id === docId);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    try {
      await deleteDocument(doc.path);
    } catch (e) {}

    const documents = (client.documents || []).filter((d) => d.id !== docId);
    await updateItem("clients", id, { documents });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
