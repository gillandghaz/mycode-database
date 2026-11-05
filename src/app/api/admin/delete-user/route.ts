import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAdmin, readJson, errorResponse, HttpError, DOC_ID_RE } from "@/lib/server-auth";

const BATCH = 400;

async function deleteWhereOwner(collectionName: string, uid: string): Promise<number> {
  const db = adminDb();
  let total = 0;
  // Loop until nothing is left (each pass removes up to BATCH docs).
  for (;;) {
    const snap = await db.collection(collectionName).where("ownerUid", "==", uid).limit(BATCH).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < BATCH) break;
  }
  return total;
}

// Deletes another user's account AND all of their code. Destructive, so it is
// gated by the caller's Safe Mode on the server (not just hidden in the UI).
export async function POST(request: Request) {
  try {
    const { decoded, safeMode } = await requireAdmin(request);
    if (safeMode) {
      throw new HttpError(403, "Safe mode is ON. Turn it off to delete other users' data.", "safe-mode");
    }

    const body = await readJson(request);
    const targetUid = typeof body.targetUid === "string" ? body.targetUid : "";
    if (!DOC_ID_RE.test(targetUid)) throw new HttpError(400, "Invalid user id.");
    if (targetUid === decoded.uid) throw new HttpError(400, "You can't delete your own account here.");

    const db = adminDb();
    const userSnap = await db.collection("users").doc(targetUid).get();
    const username: string | undefined = userSnap.data()?.username;

    // Auth account first: if anything below fails, the user can no longer sign in.
    try {
      await adminAuth().deleteUser(targetUid);
    } catch (e) {
      if ((e as { code?: string })?.code !== "auth/user-not-found") throw e;
    }

    await deleteWhereOwner("fileContents", targetUid);
    await deleteWhereOwner("nodes", targetUid);
    if (username) await db.collection("usernames").doc(username).delete();
    await db.collection("avatars").doc(targetUid).delete();
    await db.collection("users").doc(targetUid).delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "admin delete-user");
  }
}
