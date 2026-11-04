"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { ensureUserProfile } from "@/lib/profile";
import { takeAuthNotice } from "@/lib/auth-hint";
import PasswordInput from "@/components/PasswordInput";
import AuthRedirect from "@/components/landing/AuthRedirect";
import Logo, { BrandWord } from "@/components/Logo";
import GoogleIcon from "@/components/GoogleIcon";

function friendlyAuthError(code?: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Try again in a few minutes.";
    case "auth/invalid-email":
      return "That email address isn't valid.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // Message left by a forced sign-out (disabled account, closed sign-ups...).
  useEffect(() => {
    const notice = takeAuthNotice();
    if (notice) setError(notice);
  }, []);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/app");
    } catch (err) {
      setError(friendlyAuthError((err as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
      router.push("/app");
    } catch (err) {
      const e2 = err as { message?: string; code?: string };
      if (e2.message === "registration-closed") {
        // A first-time Google sign-in is a sign-up; the server already removed the new account.
        await signOut(auth).catch(() => {});
        setError("Sign-ups are currently closed. Only existing accounts can sign in.");
      } else if (e2.code !== "auth/popup-closed-by-user" && e2.code !== "auth/cancelled-popup-request") {
        setError(friendlyAuthError(e2.code));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Type your email in the field above first, then click again.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      /* same message either way, so the form can't be used to probe which emails exist */
    } finally {
      setInfo("If that email is registered, a reset link is on its way.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <AuthRedirect />
      <div className="auth-card">
        <Link href="/" className="brand"><Logo size={26} /><BrandWord /></Link>
        <h1>Sign in</h1>
        <p className="sub">Pick up where you left off.</p>

        <button type="button" className="btn btn--ghost btn--block" onClick={handleGoogleLogin} disabled={busy}>
          <GoogleIcon /> Continue with Google
        </button>

        <div className="auth-divider">OR</div>

        <form onSubmit={handleEmailLogin}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && <p className="error-text">{error}</p>}
          {info && <p className="hint-text" style={{ marginBottom: 12 }}>{info}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Working…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 10 }}>
          <button type="button" className="link-btn" onClick={handleForgotPassword} disabled={busy}>Forgot password?</button>
        </p>

        <p className="auth-switch">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
