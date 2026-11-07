"use client";

// Admin switches that limit who may use a feature. Two pieces each, both set
// by admins through /api/admin/run-access:
//   settings/{doc} { allowAll }  -  false = only selected users may use it
//   users/{uid}.{field}          -  true = this user may, while allowAll is off
//
//   feature      doc            user field            what it controls
//   "run"        settings/run   runAllowed            running code (ENFORCED in /api/run)
//   "interactive" settings/interactive interactiveAllowed  typing input in the Output
//
// "interactive" is a convenience of the editor (it re-runs the program with the
// lines you typed), not a security boundary: the Input tab, which feeds the
// same stdin, always works. Only "run" is also enforced on the server.

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useAuth } from "./auth-context";

export type Feature = "run" | "interactive";

export const FEATURE_FIELD = { run: "runAllowed", interactive: "interactiveAllowed" } as const;

export function useFeatureAllowAll(feature: Feature): boolean {
  const { user, profile } = useAuth();
  const [allowAll, setAllowAll] = useState(true);
  const signedIn = !!user && !!profile;

  useEffect(() => {
    if (!signedIn) return;
    return onSnapshot(
      doc(db, "settings", feature),
      (snap) => setAllowAll(!snap.exists() || snap.data().allowAll !== false),
      // If the setting can't be read, don't block anything here; the server decides.
      () => setAllowAll(true)
    );
  }, [signedIn, feature]);

  return allowAll;
}

export function useCanUseFeature(feature: Feature): boolean {
  const { profile } = useAuth();
  const allowAll = useFeatureAllowAll(feature);
  return allowAll || profile?.[FEATURE_FIELD[feature]] === true;
}

export const useRunAllowAll = () => useFeatureAllowAll("run");
export const useCanRun = () => useCanUseFeature("run");

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

export function adminSetFeatureAllowAll(feature: Feature, allowAll: boolean): Promise<void> {
  return post({ feature, allowAll });
}

export function adminSetFeatureUsers(feature: Feature, users: Record<string, boolean>): Promise<void> {
  return post({ feature, users });
}

export async function readFeatureAllowAll(feature: Feature): Promise<boolean> {
  const snap = await getDoc(doc(db, "settings", feature));
  return !snap.exists() || snap.data().allowAll !== false;
}

export const adminSetRunAllowAll = (allowAll: boolean) => adminSetFeatureAllowAll("run", allowAll);
export const adminSetRunUsers = (users: Record<string, boolean>) => adminSetFeatureUsers("run", users);
export const readRunAllowAll = () => readFeatureAllowAll("run");
