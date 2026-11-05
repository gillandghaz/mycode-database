import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// settings/contacts is readable by signed-in users and written only through
// /api/admin/contacts (Admin SDK), which checks that the caller is an admin.
export interface Contact {
  type: string; // kind of contact, e.g. "Email"
  title: string; // text shown instead of the link (optional)
  link: string; // link or plain content
}

export const MAX_CONTACTS = 20;
export const MAX_TYPE = 40;
export const MAX_TITLE = 80;
export const MAX_LINK = 300;

export async function loadContacts(): Promise<Contact[]> {
  const snap = await getDoc(doc(db, "settings", "contacts"));
  const items = snap.exists() ? snap.data().items : [];
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_CONTACTS).map((i: Partial<Contact>) => ({
    type: typeof i?.type === "string" ? i.type : "",
    title: typeof i?.title === "string" ? i.title : "",
    link: typeof i?.link === "string" ? i.link : "",
  }));
}

export async function adminSaveContacts(items: Contact[]): Promise<void> {
  const idToken = await auth.currentUser!.getIdToken();
  const res = await fetch("/api/admin/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ items }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.code || "save-failed");
}

// Only these schemes ever become a clickable link. javascript:, data: and
// anything else is shown as plain text.
export function contactHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\/[^\s]+$/i.test(v)) return v;
  if (/^mailto:[^\s]+$/i.test(v)) return v;
  if (/^tel:[+0-9().\-\s]+$/i.test(v)) return v.replace(/\s+/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^www\.[^\s]+\.[^\s]+$/i.test(v)) return `https://${v}`;
  return null;
}
