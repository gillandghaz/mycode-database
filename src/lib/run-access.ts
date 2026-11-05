"use client";

// "Who may run code". Two pieces, both set by admins through
// /api/admin/run-access and ENFORCED in /api/run on the server:
//   settings/run { allowAll }  -  false = only selected users may run
//   users/{uid}.runAllowed     -  true = this user may run while allowAll is off
// The UI below only reflects that so the Run button can explain itself.

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useAuth } from "./auth-context";

export function useRunAllowAll(): boolean {
  const { user, profile } = useAuth();
  const [allowAll, setAllowAll] = useState(true);
  const signedIn = !!user && !!profile;

  useEffect(() => {
    if (!signedIn) return;
    return onSnapshot(
      doc(db, "settings", "run"),
      (snap) => setAllowAll(!snap.exists() || snap.data().allowAll !== false),
      // If the setting can't be read, don't block the button; the server decides.
      () => setAllowAll(true)
    );
  }, [signedIn]);

  return allowAll;
}

export function useCanRun(): boolean {
  const { profile } = useAuth();
  const allowAll = useRunAllowAll();
  return allowAll || profile?.runAllowed === true;
}

async function post(body: unknown): Promise<void> {
  const idToken = await auth.currentUser!.getIdToken();
  const res = await fetch("/api/admin/run-access", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.code || "save-failed");
}

export function adminSetRunAllowAll(allowAll: boolean): Promise<void> {
  return post({ allowAll });
}

export function adminSetRunUsers(users: Record<string, boolean>): Promise<void> {
  return post({ users });
}

export async function readRunAllowAll(): Promise<boolean> {
  const snap = await getDoc(doc(db, "settings", "run"));
  return !snap.exists() || snap.data().allowAll !== false;
}
