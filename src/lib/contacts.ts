import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

// settings/contacts is readable by signed-in users and written only through
// /api/admin/contacts (Admin SDK), which checks that the caller is an admin.
export interface Contact {
  id: string;
  type: string; // kind of contact, e.g. "Instagram"
  title: string; // text shown instead of the link (optional)
  link: string; // link or plain content
}

export const MAX_CONTACTS = 20;
export const MAX_TYPE = 40;
export const MAX_TITLE = 80;
export const MAX_LINK = 300;
export const MAX_DESCRIPTION = 500;

// Shown until an admin saves the list for the first time.
export const DEFAULT_CONTACTS: Contact[] = [
  { id: "github", type: "GitHub", title: "", link: "" },
  { id: "email", type: "Email", title: "", link: "" },
  { id: "phone", type: "Telepon", title: "", link: "" },
];

export interface ContactsData {
  items: Contact[];
  description: string;
}

export function newContactId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Live updates, so everyone sees an admin's change without reloading.
export function subscribeContacts(onData: (data: ContactsData) => void, onError?: () => void): () => void {
  return onSnapshot(
    doc(db, "settings", "contacts"),
    (snap) => {
      if (!snap.exists()) return onData({ items: DEFAULT_CONTACTS, description: "" });
      const data = snap.data();
      const raw = Array.isArray(data.items) ? data.items : [];
      const items = raw.slice(0, MAX_CONTACTS).map((i: Partial<Contact>, idx: number) => ({
        id: typeof i?.id === "string" && i.id ? i.id : `legacy-${idx}`,
        type: typeof i?.type === "string" ? i.type : "",
        title: typeof i?.title === "string" ? i.title : "",
        link: typeof i?.link === "string" ? i.link : "",
      }));
      onData({ items, description: typeof data.description === "string" ? data.description : "" });
    },
    () => onError?.()
  );
}

// Send `items` and/or `description`; whatever is left out is kept as it is.
export async function adminSaveContacts(payload: { items?: Contact[]; description?: string }): Promise<void> {
  const idToken = await auth.currentUser!.getIdToken();
  const res = await fetch("/api/admin/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.code || "save-failed");
}

// Turns what an admin typed into a link that makes sense: URL as is, email ->
// mailto:, phone number -> tel:, a bare domain such as "github.com/name" ->
// https://. Anything else (and anything with another scheme, such as
// javascript:) is plain text, never a link.
export function contactHref(raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  if (/^mailto:\S+$/i.test(v)) return v;
  if (/^tel:[+0-9().\-\s]+$/i.test(v)) return v.replace(/\s+/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^\+?[0-9][0-9 ()-]{5,}$/.test(v)) return `tel:${v.replace(/[^0-9+]/g, "")}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v)) return `https://${v}`;
  return null;
}
