import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getValue, updateItem, deleteItem } from "@/lib/store";
import { requireStaff } from "@/lib/auth";
import { deleteDocument } from "@/lib/documents";

export async function PATCH(req, { params }) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const patch = {};
    ["name", "phone", "email", "nationalId", "employment"].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    if (body.income !== undefined) patch.income = Number(body.income) || 0;

    const updated = await updateItem("clients", id, patch);
    if (!updated) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// Refuses to delete a client with an unresolved loan (pending through
// active), so a client can't quietly disappear from the books while they
// still owe money or have a decision pending. Closed/rejected loans don't
// block deletion. Any uploaded documents are removed from storage too.
export async function DELETE(req, { params }) {
  try {
    const me = await requireStaff(req);
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const loans = (await getValue("loans")) || [];
    const openLoan = loans.find((l) => l.clientId === id && !["closed", "rejected"].includes(l.status));
    if (openLoan) {
      return NextResponse.json(
        { error: "This client has an open loan — resolve or close it before deleting them" },
        { status: 400 }
      );
    }

    const clients = (await getValue("clients")) || [];
    const client = clients.find((c) => c.id === id);
    if (client?.documents?.length) {
      for (const doc of client.documents) {
        try {
          await deleteDocument(doc.path);
        } catch (e) {
          // Best-effort cleanup — don't block deleting the client record over a storage hiccup.
        }
      }
    }

    const ok = await deleteItem("clients", id);
    if (!ok) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
