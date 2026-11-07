import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin, readJson, errorResponse, HttpError, DOC_ID_RE } from "@/lib/server-auth";

const MAX_USERS = 1000;
const CHUNK = 300;

// The features whose access an admin can limit. "run" is also enforced in
// /api/run; "interactive" (typing input in the Output) is an editor feature.
const FEATURES = {
  run: { doc: "run", field: "runAllowed" },
  interactive: { doc: "interactive", field: "interactiveAllowed" },
} as const;

// Admin settings for "who may use <feature>" (feature defaults to "run").
//   { feature?, allowAll: boolean }          -> settings/{doc}.allowAll
//   { feature?, users: { [uid]: boolean } }  -> users/{uid}.{field}
// Not gated by safe mode: it changes access rules, never anybody's code.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    const db = adminDb();
    let touched = 0;

    const featureName = body.feature === undefined ? "run" : body.feature;
    if (typeof featureName !== "string" || !Object.prototype.hasOwnProperty.call(FEATURES, featureName)) throw new HttpError(400, "Unknown feature.");
    const feature = FEATURES[featureName as keyof typeof FEATURES];

    if ("allowAll" in body) {
      if (typeof body.allowAll !== "boolean") throw new HttpError(400, "allowAll must be true or false.");
      await db.collection("settings").doc(feature.doc).set({ allowAll: body.allowAll, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      touched += 1;
    }

    if ("users" in body) {
      const users = body.users;
      if (!users || typeof users !== "object" || Array.isArray(users)) throw new HttpError(400, "users must be an object.");
      const entries = Object.entries(users as Record<string, unknown>);
      if (entries.length > MAX_USERS) throw new HttpError(400, "Too many users in one request.");
      for (const [uid, value] of entries) {
        if (!DOC_ID_RE.test(uid) || typeof value !== "boolean") throw new HttpError(400, "Invalid user entry.");
      }
      for (let i = 0; i < entries.length; i += CHUNK) {
        const part = entries.slice(i, i + CHUNK);
        const refs = part.map(([uid]) => db.collection("users").doc(uid));
        const snaps = await db.getAll(...refs);
        const batch = db.batch();
        snaps.forEach((snap, idx) => {
          // Only existing profiles are touched: never create a users/{uid}
          // document (that would turn a bare Auth account into a "member").
          if (snap.exists) {
            batch.update(snap.ref, { [feature.field]: part[idx][1] });
            touched += 1;
          }
        });
        await batch.commit();
      }
    }

    if (touched === 0 && !("allowAll" in body) && !("users" in body)) throw new HttpError(400, "Nothing to change.");
    return NextResponse.json({ ok: true, updated: touched });
  } catch (err) {
    return errorResponse(err, "admin run-access");
  }
}
