"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { setAuthHint } from "@/lib/auth-hint";
import { ConfirmDialog } from "./Modal";

export default function ProfileMenu() {
  const router = useRouter();
  const { user, profile, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function handleLogout() {
    setBusy(true);
    setAuthHint(false); // so /login doesn't bounce straight back to /app
    await signOut(auth);
    router.push("/login");
  }

  const label = profile?.displayName || user?.email || "?";
  const initial = label.trim()[0]?.toUpperCase() || "?";

  return (
    <div className="profile-wrap" ref={wrapRef}>
      <button type="button" className="avatar" title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {initial}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu__head">
            <div className="menu__name">
              {profile?.displayName} {isAdmin && <span className="badge">admin</span>}
            </div>
            <span className="menu__sub">@{profile?.username}</span>
          </div>
          <Link href="/app" className="menu__item" role="menuitem">Editor</Link>
          <Link href="/dashboard" className="menu__item" role="menuitem">Dashboard</Link>
          <button className="menu__item menu__item--danger" role="menuitem" onClick={() => { setOpen(false); setConfirming(true); }}>Sign out</button>
        </div>
      )}
      <ConfirmDialog open={confirming} title="Sign out?" message="You'll need to sign in again to reach your code." confirmLabel="Sign out" busy={busy} onConfirm={handleLogout} onCancel={() => setConfirming(false)} />
    </div>
  );
}
