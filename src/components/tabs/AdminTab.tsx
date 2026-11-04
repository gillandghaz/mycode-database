"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { adminDeleteUser, listAllUsers, setAdminSafeMode, setUserRole, type AdminUserRow } from "@/lib/admin";
import { ConfirmDialog } from "@/components/Modal";

export default function AdminTab() {
  const { user, safeMode } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSafeOff, setConfirmSafeOff] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUserRow | null>(null);
  const [toggleRole, setToggleRole] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setUsers(await listAllUsers());
    } catch {
      setError("Couldn't load users.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!users) return [];
    return q ? users.filter((u) => u.username?.includes(q) || u.email?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q)) : users;
  }, [users, query]);

  async function changeSafeMode(enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      await setAdminSafeMode(user!.uid, enabled);
    } catch {
      setError("Couldn't change safe mode.");
    } finally {
      setBusy(false);
      setConfirmSafeOff(false);
    }
  }

  async function doRole() {
    if (!toggleRole) return;
    setBusy(true);
    try {
      await setUserRole(toggleRole.uid, toggleRole.role === "admin" ? "user" : "admin");
      setToggleRole(null);
      await load();
    } catch {
      setError("Couldn't change that role.");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await adminDeleteUser(toDelete.uid);
      setToDelete(null);
      await load();
    } catch (e) {
      const code = (e as Error).message;
      setError(code === "safe-mode" ? "Safe mode is ON, so deleting users is blocked." : "Couldn't delete that user.");
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="tab-title">Admin</h2>

      <div className={"safe-banner " + (safeMode ? "safe-banner--on" : "safe-banner--off")}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>Safe mode: {safeMode ? "ON" : "OFF"}</b>
          <div className="hint-text" style={{ marginTop: 2 }}>
            {safeMode
              ? "You can view other users' code but not change or delete it."
              : "You CAN edit and delete other users' code and accounts. Turn safe mode back on when you're done."}
          </div>
        </div>
        <label className="switch" title="Safe mode">
          <input type="checkbox" checked={safeMode} disabled={busy} onChange={(e) => (e.target.checked ? changeSafeMode(true) : setConfirmSafeOff(true))} aria-label="Safe mode" />
          <i />
        </label>
      </div>

      <div className="card">
        <h3>Users {users && <span className="hint-text">({users.length})</span>}</h3>
        <p className="desc">Open a workspace to view someone's code.</p>
        <div className="field" style={{ maxWidth: 320 }}>
          <input placeholder="Search username, name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
        </div>
        {error && <p className="error-text">{error}</p>}
        {!users && !error && <p className="hint-text">Loading…</p>}
        {users && (
          <div className="table-scroll">
            <table className="user-table">
              <thead><tr><th>User</th><th>Email</th><th>Role</th><th></th></tr></thead>
              <tbody>
                {shown.map((u) => {
                  const isMe = u.uid === user?.uid;
                  return (
                    <tr key={u.uid}>
                      <td><div>{u.displayName}</div><div className="mono hint-text">@{u.username}</div></td>
                      <td className="mono">{u.email}</td>
                      <td>{u.role === "admin" ? <span className="badge">admin</span> : "user"}</td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn btn--ghost btn--sm" href={isMe ? "/app" : `/app?user=${u.uid}`}>{isMe ? "My code" : "View code"}</Link>
                          {!isMe && <button className="btn btn--ghost btn--sm" onClick={() => setToggleRole(u)}>{u.role === "admin" ? "Remove admin" : "Make admin"}</button>}
                          {!isMe && <button className="btn btn--ghost btn--sm" style={{ color: "var(--danger)" }} onClick={() => setToDelete(u)} disabled={safeMode} title={safeMode ? "Turn safe mode off to delete" : undefined}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog open={confirmSafeOff} danger title="Turn safe mode off?" message="You will be able to edit and delete other users' code. Everything you change is real and can't be undone." confirmLabel="Turn off" busy={busy} onConfirm={() => changeSafeMode(false)} onCancel={() => setConfirmSafeOff(false)} />
      <ConfirmDialog open={!!toggleRole} title={toggleRole?.role === "admin" ? "Remove admin rights?" : "Make this user an admin?"} message={`@${toggleRole?.username} ${toggleRole?.role === "admin" ? "will lose" : "will gain"} access to the admin tools.`} confirmLabel="Confirm" busy={busy} onConfirm={doRole} onCancel={() => setToggleRole(null)} />
      <ConfirmDialog open={!!toDelete} danger title="Delete this account?" message={`@${toDelete?.username} and ALL of their code will be permanently deleted.`} confirmLabel="Delete forever" busy={busy} onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
