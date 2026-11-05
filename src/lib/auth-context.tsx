"use client";

// Exposes Firebase Auth state plus the Firestore profile (incl. role) through
// useAuth(). This is the only client place that answers "is this user an admin?".

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { ensureUserProfile, isSignupInProgress, type UserProfile } from "./profile";
import { setAuthHint, setAuthNotice } from "./auth-hint";
import { isValidAvatar } from "./avatar";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  // Admin safe mode: ON unless the admin explicitly turned it off.
  safeMode: boolean;
  // The user's profile photo (a validated JPEG data URL) or null.
  avatarUrl: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  isAdmin: false,
  safeMode: true,
  avatarUrl: null,
  loading: true,
});

// How often a signed-in tab asks the server whether the account is still
// active (disabled in the Firebase Console, deleted, token revoked).
const SESSION_CHECK_MS = 15 * 1000;

const MSG_DISABLED = "Your account has been disabled.";

function kickOut(message?: string) {
  if (message) setAuthNotice(message);
  signOut(auth).catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthHint(!!firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Live profile (role changes show up without a reload).
  useEffect(() => {
    if (!user) return;
    let healed = false;
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const data = snap.exists() ? (snap.data() as UserProfile) : null;
        // Self-heal: an Auth account without a profile (e.g. a signup that died
        // half-way) gets one created automatically. Skipped while a sign-up
        // form is busy creating that very profile.
        if (!data && !healed && !isSignupInProgress()) {
          healed = true;
          ensureUserProfile(user).catch((err: Error) => {
            if (err?.message === "registration-closed") kickOut("Sign-ups are currently closed.");
            else console.error("Profile self-heal failed:", err);
          });
        }
        setProfile(data);
        setLoading(false);
        document.documentElement.setAttribute("data-reduce-motion", String(!!data?.settings?.reduceMotion));
      },
      (err) => {
        console.error("Profile listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  // Profile photo (avatars/{uid}). Only listened to once the profile exists,
  // because the rules only let registered members read data.
  const uid = user?.uid;
  const hasProfile = !!profile;
  useEffect(() => {
    if (!uid || !hasProfile) {
      setAvatarUrl(null);
      return;
    }
    return onSnapshot(
      doc(db, "avatars", uid),
      (snap) => {
        const url = snap.exists() ? snap.data().dataUrl : null;
        setAvatarUrl(isValidAvatar(url) ? url : null);
      },
      () => setAvatarUrl(null)
    );
  }, [uid, hasProfile]);

  // Session check: if the account was disabled (e.g. in the Firebase Console),
  // deleted, or its token revoked, the server answers 401 and we sign out
  // right away, with a message on the login page. Firebase Auth itself refuses
  // to sign a disabled account in again.
  useEffect(() => {
    if (!user) return;
    let stopped = false;

    async function check() {
      if (stopped) return;
      try {
        const idToken = await user!.getIdToken();
        const res = await fetch("/api/auth/session", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
        if (res.status === 401 && !stopped) {
          const body = await res.json().catch(() => ({}));
          kickOut(body?.code === "session-revoked" ? MSG_DISABLED : undefined);
        }
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (stopped) return;
        if (code === "auth/user-disabled") kickOut(MSG_DISABLED);
        else if (code === "auth/user-not-found") kickOut("This account no longer exists.");
        else if (code === "auth/user-token-expired" || code === "auth/id-token-revoked") kickOut("Your session ended. Please sign in again.");
        // plain network error: retry on the next tick
      }
    }

    const tick = () => {
      if (document.visibilityState === "visible") check();
    };
    const timer = setInterval(tick, SESSION_CHECK_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", check);
    check();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", check);
    };
  }, [user]);

  const isAdmin = profile?.role === "admin";
  const safeMode = profile?.adminSafeMode !== false;

  return <AuthContext.Provider value={{ user, profile, isAdmin, safeMode, avatarUrl, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
