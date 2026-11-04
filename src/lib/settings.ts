import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// settings/app is world-readable (the sign-up page must read it before anyone
// is signed in) and writable only by admins (see firestore.rules).
const SETTINGS_DOC = () => doc(db, "settings", "app");

// Default: open, when the document or field doesn't exist yet.
export async function isRegistrationOpen(): Promise<boolean> {
  const snap = await getDoc(SETTINGS_DOC());
  if (!snap.exists()) return true;
  return snap.data().registrationOpen !== false;
}

// This only controls what the UI shows. The real enforcement is on the server
// (/api/auth/gate deletes the new Auth account) and in firestore.rules (new
// profiles and usernames are refused), so calling Firebase Auth directly
// doesn't produce a usable account either.
export async function setRegistrationOpen(open: boolean): Promise<void> {
  await setDoc(SETTINGS_DOC(), { registrationOpen: open }, { merge: true });
}
