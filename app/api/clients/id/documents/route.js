import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, updateItem, uid } from "@/lib/store";
import { requireStaff } from "@/lib/auth";
import { uploadDocument } from "@/lib/documents";

export async function POST(req, { params }) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const clients = (await getValue("clients")) || [];
    const client = clients.find((c) => c.id === id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file");
    const label = formData.get("label") || "";
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "File is too large (max 8MB)" }, { status: 400 });
    }

    const meta = await uploadDocument(id, file, label);
    const doc = { id: uid(), ...meta };
    const documents = [...(client.documents || []), doc];
    await updateItem("clients", id, { documents });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
