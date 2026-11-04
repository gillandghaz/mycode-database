"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { updateDisplayName, requestPasswordChange, currentUserAuthProvider } from "@/lib/account";

export default function AccountTab() {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const isPasswordAccount = currentUserAuthProvider() === "password";

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return setNameMsg("Display name can't be empty.");
    setSaving(true);
    setNameMsg("");
    try {
      await updateDisplayName(user!.uid, name);
      setNameMsg("Saved.");
    } catch {
      setNameMsg("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPwBusy(true);
    setPwMsg("");
    try {
      await requestPasswordChange();
      setPwMsg(`A reset link was sent to ${user!.email}. Check your inbox (and spam).`);
    } catch {
      setPwMsg("Couldn't send the email. Try again in a moment.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div>
      <h2 className="tab-title">Account</h2>

      <div className="card">
        <h3>Profile</h3>
        <p className="desc">Your username is permanent; your display name can change any time.</p>
        <form onSubmit={saveName}>
          <div className="field">
            <label htmlFor="un">Username</label>
            <input id="un" value={profile?.username || ""} disabled readOnly />
          </div>
          <div className="field">
            <label htmlFor="em">Email</label>
            <input id="em" value={user?.email || ""} disabled readOnly />
          </div>
          <div className="field">
            <label htmlFor="dn">Display name</label>
            <input id="dn" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <button className="btn btn--primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          {nameMsg && <p className="ok-text">{nameMsg}</p>}
        </form>
      </div>

      <div className="card">
        <h3>Password</h3>
        {isPasswordAccount ? (
          <>
            <p className="desc">We'll email you a link to set a new password.</p>
            <button className="btn btn--ghost" onClick={changePassword} disabled={pwBusy}>{pwBusy ? "Sending…" : "Send reset link"}</button>
            {pwMsg && <p className="ok-text">{pwMsg}</p>}
          </>
        ) : (
          <p className="desc" style={{ margin: 0 }}>You sign in with Google, so there's no password to manage here.</p>
        )}
      </div>
    </div>
  );
}
