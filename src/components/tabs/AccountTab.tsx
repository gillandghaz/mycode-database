"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { updateDisplayName, requestPasswordChange, currentUserAuthProvider } from "@/lib/account";
import { avatarErrorMessage, fileToAvatarDataUrl, saveAvatar } from "@/lib/avatar";

export default function AccountTab() {
  const { user, profile, avatarUrl } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const isPasswordAccount = currentUserAuthProvider() === "password";

  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const initial = (profile?.displayName || user?.email || "?").trim()[0]?.toUpperCase() || "?";

  async function onPhotoPicked(file: File | undefined) {
    if (!file || !user) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      await saveAvatar(user.uid, await fileToAvatarDataUrl(file));
      setPhotoMsg({ text: "Photo updated.", ok: true });
    } catch (err) {
      setPhotoMsg({ text: avatarErrorMessage(err), ok: false });
    } finally {
      setPhotoBusy(false);
    }
  }

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
        <h3>Profile photo</h3>
        <div className="avatar-row" style={{ marginTop: 12, marginBottom: 0 }}>
          <div className="avatar avatar--xl" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</div>
          <div className="avatar-row__text">
            <p className="desc" style={{ marginBottom: 10 }}>
              {avatarUrl ? "Choose a new photo to replace this one." : "Add a photo so your account is easy to recognise."} It is cropped to a square.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                onPhotoPicked(file);
              }}
            />
            <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
              {photoBusy ? "Saving…" : avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            <span className="hint-text" style={{ marginLeft: 10 }}>JPG, PNG or WebP</span>
            {photoMsg && <p className={photoMsg.ok ? "ok-text" : "error-text"} style={{ marginBottom: 0 }}>{photoMsg.text}</p>}
          </div>
        </div>
      </div>

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
