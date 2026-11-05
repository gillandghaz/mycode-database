import { doc, getDoc, runTransaction, serverTimestamp, type Timestamp } from "firebase/firestore";
import { deleteUser, signOut, type User } from "firebase/auth";
import { auth, db } from "./firebase";

export type Role = "user" | "admin";

export interface UserSettings {
  fontSize?: number; // editor font size in px
  wordWrap?: boolean;
  reduceMotion?: boolean;
}

export interface UserProfile {
  email: string;
  username: string;
  displayName: string;
  role: Role;
  createdAt?: Timestamp;
  settings?: UserSettings;
  // Admin-only. Safe mode is ON unless this is explicitly false.
  adminSafeMode?: boolean;
  // Set by admins (/api/admin/run-access). Only matters while "Allow everyone
  // to run code" is off: true = this user may still run code.
  runAllowed?: boolean;
}

// ---- sign-up in progress ---------------------------------------------------
// Creating an account fires onAuthStateChanged BEFORE the sign-up form has
// written the profile. Without this guard, the "self-heal" in AuthProvider saw
// "account without profile" and tried to create one in parallel, which clashed
// with the real one (permission-denied). While a sign-up form is running,
// self-heal stays out of the way.
let signupDepth = 0;

export async function withSignup<T>(fn: () => Promise<T>): Promise<T> {
  signupDepth += 1;
  try {
    return await fn();
  } finally {
    signupDepth -= 1;
  }
}

export function isSignupInProgress(): boolean {
  return signupDepth > 0;
}

// Firestore has no unique constraints. Pattern: use the username as a
// document ID in a separate "usernames" collection and claim it inside a
// transaction, so two people can't take the same name at once.
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "usernames", username.toLowerCase()));
  return !snap.exists();
}

// Server-side sign-up gate (see /api/auth/gate). Throws
// Error("registration-closed") when sign-ups are off; the server has then
// already deleted the brand-new Auth account, so the caller just signs out.
export async function gateRegistration(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/gate", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 403) throw new Error("registration-closed");
  if (!res.ok) throw new Error("gate-failed");
}

// Fail closed: when a sign-up/first Google sign-in doesn't complete (sign-ups
// closed, gate unreachable, ...), don't leave a usable session or an orphan
// Auth account behind. Only a brand-new account is deleted; an existing one is
// just signed out.
export async function discardFailedSignup(user: User | null, isNewAccount: boolean): Promise<void> {
  if (user && isNewAccount) await deleteUser(user).catch(() => {});
  await signOut(auth).catch(() => {});
}

export async function createUserProfile(
  user: User,
  { username, displayName }: { username: string; displayName: string }
): Promise<void> {
  await gateRegistration(user);

  const cleanUsername = username.trim();
  const key = cleanUsername.toLowerCase();
  const usernameRef = doc(db, "usernames", key);
  const userRef = doc(db, "users", user.uid);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(usernameRef);
    if (existing.exists()) throw new Error("username-taken");
    tx.set(usernameRef, { uid: user.uid });
    tx.set(userRef, {
      email: user.email,
      username: key,
      // Display name is optional: fall back to the username.
      displayName: displayName.trim() || cleanUsername,
      role: "user", // only an admin can change this later (enforced by rules)
      createdAt: serverTimestamp(),
    });
  });
}

// CSPRNG suffix for auto-generated usernames (Google sign-in).
function randomSuffix(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % 10000;
}

// Several callers (login page + self-heal in AuthProvider) may run this at the
// same time for one account; share a single in-flight promise.
const inflight = new Map<string, Promise<void>>();

export function ensureUserProfile(user: User): Promise<void> {
  let p = inflight.get(user.uid);
  if (!p) {
    p = ensureUserProfileOnce(user).finally(() => inflight.delete(user.uid));
    inflight.set(user.uid, p);
  }
  return p;
}

async function ensureUserProfileOnce(user: User): Promise<void> {
  const existing = await getDoc(doc(db, "users", user.uid));
  if (existing.exists()) return;

  const base = (user.email || "user").split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
  let candidate = base.length >= 3 ? base : `user${Date.now() % 100000}`;
  let attempt = 0;
  while (!(await isUsernameAvailable(candidate))) {
    attempt += 1;
    candidate = `${base || "user"}${randomSuffix()}`.slice(0, 20);
    if (attempt > 8) {
      candidate = `user${user.uid.slice(0, 8)}`.slice(0, 20);
      break;
    }
  }
  await createUserProfile(user, { username: candidate, displayName: user.displayName || candidate });
}
