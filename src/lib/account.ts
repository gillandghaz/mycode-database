import { doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "./firebase";
import type { UserSettings } from "./profile";

export async function updateDisplayName(uid: string, displayName: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { displayName });
}

export async function updateSetting<K extends keyof UserSettings>(uid: string, key: K, value: UserSettings[K]): Promise<void> {
  await updateDoc(doc(db, "users", uid), { [`settings.${key}`]: value });
}

export async function requestPasswordChange(): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("no-email");
  await sendPasswordResetEmail(auth, user.email);
}

export function currentUserAuthProvider(): string | null {
  return auth.currentUser?.providerData?.[0]?.providerId || null; // "password" | "google.com"
}
