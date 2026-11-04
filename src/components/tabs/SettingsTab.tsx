"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { updateSetting } from "@/lib/account";

export default function SettingsTab() {
  const { user, profile } = useAuth();
  const s = profile?.settings ?? {};
  const [err, setErr] = useState("");

  async function save<K extends "fontSize" | "wordWrap" | "reduceMotion">(key: K, value: NonNullable<typeof s[K]>) {
    setErr("");
    try {
      await updateSetting(user!.uid, key, value);
    } catch {
      setErr("Couldn't save that setting.");
    }
  }

  return (
    <div>
      <h2 className="tab-title">Settings</h2>
      <div className="card">
        <h3>Editor</h3>
        <p className="desc">Applied the next time you open the editor.</p>

        <div className="switch-row">
          <div>
            <strong>Font size</strong>
            <span className="hint-text">Code text size in pixels.</span>
          </div>
          <select value={s.fontSize ?? 14} onChange={(e) => save("fontSize", Number(e.target.value))} aria-label="Font size"
            style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", font: "inherit" }}>
            {[12, 13, 14, 15, 16, 18, 20].map((n) => <option key={n} value={n}>{n}px</option>)}
          </select>
        </div>

        <div className="switch-row">
          <div>
            <strong>Wrap long lines</strong>
            <span className="hint-text">Wrap instead of scrolling sideways.</span>
          </div>
          <label className="switch"><input type="checkbox" checked={!!s.wordWrap} onChange={(e) => save("wordWrap", e.target.checked)} /><i /></label>
        </div>
      </div>

      <div className="card">
        <h3>Interface</h3>
        <div className="switch-row">
          <div>
            <strong>Reduce motion</strong>
            <span className="hint-text">Turns off transitions and animations.</span>
          </div>
          <label className="switch"><input type="checkbox" checked={!!s.reduceMotion} onChange={(e) => save("reduceMotion", e.target.checked)} /><i /></label>
        </div>
      </div>
      {err && <p className="error-text">{err}</p>}
    </div>
  );
}
