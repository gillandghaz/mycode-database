"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, deleteUser, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { validatePassword, validateUsername, validateEmail } from "@/lib/validators";
import { createUserProfile, isUsernameAvailable, ensureUserProfile, withSignup } from "@/lib/profile";
import { isRegistrationOpen } from "@/lib/settings";
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
  const [checkingOpen, setCheckingOpen] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // Display only; the server and firestore.rules enforce it for real.
    isRegistrationOpen()
      .then(setOpen)
      .catch(() => setOpen(true))
      .finally(() => setCheckingOpen(false));
  }, []);

  const pwCheck = validatePassword(password);
  const userCheck = validateUsername(username);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) return setError("That email address isn't valid.");
    if (!userCheck.valid) return setError(userCheck.errors[0]);
    if (!pwCheck.valid) return setError(pwCheck.errors[0]);
    if (password !== confirmPassword) return setError("The passwords don't match.");

    const uname = username.trim();
    const created: { user: User | null } = { user: null };
    setBusy(true);
    try {
      if (!(await isUsernameAvailable(uname))) {
        setError("That username is taken. Try another one.");
        return;
      }
      // withSignup keeps the background profile self-heal out of the way
      // while this form creates the profile.
      await withSignup(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        created.user = cred.user;
        await cred.user.getIdToken(true);
        // Display name is optional: empty falls back to the username.
        await createUserProfile(cred.user, { username: uname, displayName: displayName.trim() || uname });
      });
      router.push("/app");
    } catch (err) {
      console.error("Register error:", err);
      // Don't leave a half-made account behind (it would block the email).
      if (created.user) await deleteUser(created.user).catch(() => {});
      await signOut(auth).catch(() => {});
      const e2 = err as { message?: string; code?: string };
      if (e2.message === "registration-closed") setError("Sign-ups are currently closed.");
      else if (e2.message === "username-taken") setError("Someone just took that username. Try another one.");
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
      const e2 = err as { message?: string; code?: string };
      if (e2.message === "registration-closed") {
        await signOut(auth).catch(() => {});
        setError("Sign-ups are currently closed.");
      } else if (e2.code !== "auth/popup-closed-by-user" && e2.code !== "auth/cancelled-popup-request") {
        setError(friendlyAuthError(e2.code));
      }
    } finally {
      setBusy(false);
    }
  }

  if (checkingOpen) {
    return <div className="auth-shell"><AuthRedirect /></div>;
  }

  if (!open) {
    return (
      <div className="auth-shell">
        <AuthRedirect />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <Link href="/" className="brand" style={{ justifyContent: "center" }}><Logo size={26} /><BrandWord /></Link>
          <h1>Sign-ups are closed</h1>
          <p className="sub">New accounts can't be created right now. If you already have an account, you can still sign in.</p>
          <Link href="/login" className="btn btn--primary btn--block">Go to sign in</Link>
        </div>
      </div>
    );
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
