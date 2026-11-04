import { collection, doc, getDocs, runTransaction, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Role, UserProfile } from "./profile";

export interface AdminUserRow extends UserProfile {
  uid: string;
}

// Fetch ALL profiles, then sort on the client. orderBy("createdAt") would
// silently drop any profile that lacks that field.
export async function listAllUsers(): Promise<AdminUserRow[]> {
  const snap = await getDocs(collection(db, "users"));
  const list = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as UserProfile) }));
  list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  return list;
}

export async function setUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
}

// Safe mode is a per-admin switch stored on the admin's own profile.
// ON (default) = this admin cannot modify other people's code. Enforced by
// firestore.rules and by /api/admin/delete-user, not just by the UI.
export async function setAdminSafeMode(uid: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), { adminSafeMode: enabled });
}

export async function adminChangeUsername(targetUid: string, newUsername: string): Promise<void> {
  const key = newUsername.toLowerCase();
  const targetRef = doc(db, "users", targetUid);
  const newRef = doc(db, "usernames", key);
  await runTransaction(db, async (tx) => {
    const target = await tx.get(targetRef);
    if (!target.exists()) throw new Error("user-not-found");
    if ((await tx.get(newRef)).exists()) throw new Error("username-taken");
    tx.delete(doc(db, "usernames", target.data().username));
    tx.set(newRef, { uid: targetUid });
    tx.update(targetRef, { username: key });
  });
}

// Deleting a user (Auth account + all their code) needs the Admin SDK on the
// server. The route re-checks admin status AND safe mode before doing anything.
export async function adminDeleteUser(targetUid: string): Promise<void> {
  const idToken = await auth.currentUser!.getIdToken();
  const res = await fetch("/api/admin/delete-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ targetUid }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.code || body.error || "delete-failed");
}
