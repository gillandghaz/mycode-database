import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin, readJson, errorResponse, HttpError } from "@/lib/server-auth";

const MAX_CONTACTS = 20;
const MAX_TYPE = 40;
const MAX_TITLE = 80;
const MAX_LINK = 300;
const MAX_DESCRIPTION = 500;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

function clean(value: unknown, max: number, field: string, keepNewlines = false): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new HttpError(400, `Invalid ${field}.`);
  // Strip control characters (newlines only where allowed), trim, cap length.
  const re = keepNewlines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  const text = value.replace(re, " ").trim();
  if (text.length > max) throw new HttpError(400, `${field} is too long (max ${max} characters).`);
  return text;
}

function randomId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Saves the Contact page. Send `items` (the whole list) and/or `description`;
// what is left out stays as it was. Admins only; not gated by safe mode (it
// never touches anybody's code).
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    const update: Record<string, unknown> = {};

    if ("items" in body) {
      if (!Array.isArray(body.items)) throw new HttpError(400, "items must be a list.");
      if (body.items.length > MAX_CONTACTS) throw new HttpError(400, `You can add up to ${MAX_CONTACTS} contacts.`);
      const seen = new Set<string>();
      update.items = body.items.map((raw) => {
        if (!raw || typeof raw !== "object") throw new HttpError(400, "Invalid contact.");
        const r = raw as Record<string, unknown>;
        let id = typeof r.id === "string" && ID_RE.test(r.id) ? r.id : randomId();
        while (seen.has(id)) id = randomId();
        seen.add(id);
        return {
          id,
          type: clean(r.type, MAX_TYPE, "Contact type"),
          title: clean(r.title, MAX_TITLE, "Contact title"),
          link: clean(r.link, MAX_LINK, "Link"),
        };
      });
    }

    if ("description" in body) {
      update.description = clean(body.description, MAX_DESCRIPTION, "Description", true);
    }

    if (Object.keys(update).length === 0) throw new HttpError(400, "Nothing to change.");
    update.updatedAt = FieldValue.serverTimestamp();
    await adminDb().collection("settings").doc("contacts").set(update, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "admin contacts");
  }
}
