"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { adminSetFeatureUsers, FEATURE_FIELD, type Feature } from "@/lib/run-access";
import type { AdminUserRow } from "@/lib/admin";

const COPY: Record<Feature, { title: string; on: string; off: string; list: string }> = {
  run: {
    title: "Who can run code",
    on: "Everyone can run code right now. The users you tick here keep access if you turn the switch off.",
    off: "The switch is off: only the users ticked here can run code.",
    list: "Users who can run code",
  },
  interactive: {
    title: "Who can type input in the Output",
    on: "Everyone can type input in the Output right now. The users you tick here keep it if you turn the switch off.",
    off: "The switch is off: only the users ticked here can type input in the Output (everyone can still use the Input tab).",
    list: "Users who can type input in the Output",
  },
};

interface Props {
  feature?: Feature;
  open: boolean;
  users: AdminUserRow[] | null;
  allowAll: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// Pick which users may run code while "Allow everyone to run code" is off.
export default function RunAccessDialog({ feature = "run", open, users, allowAll, onClose, onSaved }: Props) {
  const field = FEATURE_FIELD[feature];
  const copy = COPY[feature];
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Start from the saved state every time the popup opens.
  useEffect(() => {
    if (!open) return;
    const next: Record<string, boolean> = {};
    (users ?? []).forEach((u) => (next[u.uid] = u[field] === true));
    setDraft(next);
    setQuery("");
    setError("");
  }, [open, users, field]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users ?? [];
    return q ? list.filter((u) => u.username?.includes(q) || u.email?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q)) : list;
  }, [users, query]);

  const selected = Object.values(draft).filter(Boolean).length;

  function setMany(list: AdminUserRow[], value: boolean) {
    setDraft((d) => {
      const n = { ...d };
      list.forEach((u) => (n[u.uid] = value));
      return n;
    });
  }

  async function save() {
    const changed: Record<string, boolean> = {};
    (users ?? []).forEach((u) => {
      if ((draft[u.uid] ?? false) !== (u[field] === true)) changed[u.uid] = draft[u.uid] ?? false;
    });
    if (Object.keys(changed).length === 0) return onClose();
    setBusy(true);
    setError("");
    try {
      await adminSetFeatureUsers(feature, changed);
      onSaved();
      onClose();
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} labelledBy={`${feature}-access-title`} wide>
      <h3 id={`${feature}-access-title`}>{copy.title}</h3>
      <p>{allowAll ? copy.on : copy.off}</p>

      <div className="field" style={{ marginBottom: 10 }}>
        <input placeholder="Search username, name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMany(shown, true)} disabled={busy || shown.length === 0}>Select shown</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMany(shown, false)} disabled={busy || shown.length === 0}>Clear shown</button>
        <span className="hint-text">{selected} of {users?.length ?? 0} selected</span>
      </div>

      {!users && <p className="hint-text">Loading…</p>}
      {users && (
        <div className="pick-list" role="group" aria-label={copy.list}>
          {shown.length === 0 && <p className="hint-text" style={{ padding: 12, margin: 0 }}>No users match.</p>}
          {shown.map((u) => (
            <label className="pick-row" key={u.uid}>
              <input type="checkbox" checked={draft[u.uid] ?? false} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, [u.uid]: e.target.checked }))} />
              <span className="pick-row__name">
                <div>{u.displayName} {u.role === "admin" && <span className="badge">admin</span>}</div>
                <div className="mono hint-text">@{u.username} · {u.email}</div>
              </span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      <div className="modal__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={busy || !users}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}
