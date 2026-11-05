import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin, readJson, errorResponse, HttpError } from "@/lib/server-auth";

const MAX_CONTACTS = 20;
const MAX_TYPE = 40;
const MAX_TITLE = 80;
const MAX_LINK = 300;

function clean(value: unknown, max: number, field: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new HttpError(400, `Invalid ${field}.`);
  // Strip control characters, trim, and cap the length.
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (text.length > max) throw new HttpError(400, `${field} is too long (max ${max} characters).`);
  return text;
}

// Replaces the whole contact list. Admins only; not gated by safe mode (it
// never touches anybody's code).
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    if (!Array.isArray(body.items)) throw new HttpError(400, "items must be a list.");
    if (body.items.length > MAX_CONTACTS) throw new HttpError(400, `You can add up to ${MAX_CONTACTS} contacts.`);

    const items = body.items.map((raw) => {
      if (!raw || typeof raw !== "object") throw new HttpError(400, "Invalid contact.");
      const r = raw as Record<string, unknown>;
      return {
        type: clean(r.type, MAX_TYPE, "Contact type"),
        title: clean(r.title, MAX_TITLE, "Contact title"),
        link: clean(r.link, MAX_LINK, "Link"),
      };
    });

    await adminDb().collection("settings").doc("contacts").set({ items, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "admin contacts");
  }
}
