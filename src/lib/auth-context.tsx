"use client";

// Exposes Firebase Auth state plus the Firestore profile (incl. role) through
// useAuth(). This is the only client place that answers "is this user an admin?".

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { ensureUserProfile, type UserProfile } from "./profile";
import { setAuthHint } from "./auth-hint";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  // Admin safe mode: ON unless the admin explicitly turned it off.
  safeMode: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  isAdmin: false,
  safeMode: true,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
        // half-way) gets one created automatically.
        if (!data && !healed) {
          healed = true;
          ensureUserProfile(user).catch((err) => console.error("Profile self-heal failed:", err));
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

  // Periodic session check: if the account was disabled or the token revoked,
  // the server answers 401 and we sign out right away.
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const DEAD = ["auth/user-disabled", "auth/user-token-expired", "auth/user-not-found", "auth/id-token-revoked"];

    async function check() {
      if (stopped) return;
      try {
        const idToken = await user!.getIdToken();
        const res = await fetch("/api/auth/session", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
        if (res.status === 401 && !stopped) signOut(auth).catch(() => {});
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code && DEAD.includes(code) && !stopped) signOut(auth).catch(() => {});
        // plain network error: retry on the next tick
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const timer = setInterval(check, 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    check();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [user]);

  const isAdmin = profile?.role === "admin";
  const safeMode = profile?.adminSafeMode !== false;

  return <AuthContext.Provider value={{ user, profile, isAdmin, safeMode, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
