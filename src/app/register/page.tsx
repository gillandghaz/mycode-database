"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { validatePassword, validateUsername, validateEmail } from "@/lib/validators";
import { createUserProfile, isUsernameAvailable, ensureUserProfile } from "@/lib/profile";
import PasswordInput from "@/components/PasswordInput";
import AuthRedirect from "@/components/landing/AuthRedirect";
import Logo, { BrandWord } from "@/components/Logo";
import GoogleIcon from "@/components/GoogleIcon";

function friendlyAuthError(code?: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Try signing in instead.";
    case "auth/invalid-email":
      return "That email address isn't valid.";
    case "auth/weak-password":
      return "That password is too weak.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pwCheck = validatePassword(password);
  const userCheck = validateUsername(username);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) return setError("That email address isn't valid.");
    if (!userCheck.valid) return setError(userCheck.errors[0]);
    if (!pwCheck.valid) return setError(pwCheck.errors[0]);
    if (password !== confirmPassword) return setError("The passwords don't match.");

    setBusy(true);
    try {
      if (!(await isUsernameAvailable(username))) {
        setError("That username is taken. Try another one.");
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await cred.user.getIdToken(true);
      await createUserProfile(cred.user, { username, displayName: displayName.trim() || username });
      router.push("/app");
    } catch (err) {
      console.error("Register error:", err);
      const e2 = err as { message?: string; code?: string };
      if (e2.message === "username-taken") setError("Someone just took that username. Try another one.");
      else setError(friendlyAuthError(e2.code));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleRegister() {
    setError("");
    setBusy(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
      router.push("/app");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError(friendlyAuthError(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <AuthRedirect />
      <div className="auth-card">
        <Link href="/" className="brand"><Logo size={26} /><BrandWord /></Link>
        <h1>Create your account</h1>
        <p className="sub">Free, and it only takes a minute.</p>

        <button type="button" className="btn btn--ghost btn--block" onClick={handleGoogleRegister} disabled={busy}>
          <GoogleIcon /> Sign up with Google
        </button>

        <div className="auth-divider">OR</div>

        <form onSubmit={handleRegister}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="username">Username <span style={{ color: "var(--text-3)" }}>(unique)</span></label>
            <input id="username" type="text" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} required />
            {username && !userCheck.valid && <span className="hint-text" style={{ color: "var(--danger)" }}>{userCheck.errors[0]}</span>}
          </div>

          <div className="field">
            <label htmlFor="displayName">Display name <span style={{ color: "var(--text-3)" }}>(optional, changeable)</span></label>
            <input id="displayName" type="text" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={username || "Your name"} />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {password && !pwCheck.valid && (
              <ul className="hint-text" style={{ color: "var(--danger)", margin: "2px 0 0", paddingLeft: 16 }}>
                {pwCheck.errors.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <PasswordInput id="confirmPassword" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Working…" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
