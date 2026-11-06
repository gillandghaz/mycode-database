"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { adminDeleteUser, listAllUsers, listAvatars, setAdminSafeMode, setUserRole, type AdminUserRow } from "@/lib/admin";
import { isRegistrationOpen, setRegistrationOpen } from "@/lib/settings";
import { ConfirmDialog } from "@/components/Modal";
import { adminSetRunAllowAll, readRunAllowAll } from "@/lib/run-access";
import RunAccessDialog from "./RunAccessDialog";

export default function AdminTab() {
  const { user, safeMode } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSafeOff, setConfirmSafeOff] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUserRow | null>(null);
  const [toggleRole, setToggleRole] = useState<AdminUserRow | null>(null);

  const [regOpen, setRegOpen] = useState<boolean | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [runAll, setRunAll] = useState<boolean | null>(null);
  const [editRun, setEditRun] = useState(false);

  useEffect(() => {
    readRunAllowAll().then(setRunAll).catch(() => setError("Couldn't load the run setting."));
  }, []);

  async function changeRunAll(allow: boolean) {
    setBusy(true);
    setError("");
    try {
      await adminSetRunAllowAll(allow);
      setRunAll(allow);
    } catch {
      setError("Couldn't change the run setting.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    isRegistrationOpen().then(setRegOpen).catch(() => setError("Couldn't load the sign-up setting."));
  }, []);

  async function changeRegistration(open: boolean) {
    setBusy(true);
    setError("");
    try {
      await setRegistrationOpen(open);
      setRegOpen(open);
    } catch {
      setError("Couldn't change the sign-up setting.");
    } finally {
      setBusy(false);
    }
  }

  const load = useCallback(async () => {
    setError("");
    try {
      const [list, photos] = await Promise.all([listAllUsers(), listAvatars()]);
      setAvatars(photos);
      setUsers(list);
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
              ? "You can view other users' code, but not change it, delete users, or change roles."
              : "You CAN edit other users' code, delete accounts and change roles. Turn safe mode back on when you're done."}
          </div>
        </div>
        <label className="switch" title="Safe mode">
          <input type="checkbox" checked={safeMode} disabled={busy} onChange={(e) => (e.target.checked ? changeSafeMode(true) : setConfirmSafeOff(true))} aria-label="Safe mode" />
          <i />
        </label>
      </div>

      <div className="card">
        <h3>Sign-ups</h3>
        <div className="switch-row" style={{ borderTop: 0, paddingBottom: 0 }}>
          <div>
            <strong>Allow new accounts</strong>
            <span className="hint-text">
              {regOpen === false
                ? "Closed: nobody can create an account, by email or Google. Existing users can still sign in."
                : "Open: anyone can create an account."}
            </span>
          </div>
          <label className="switch" title="Allow new accounts">
            <input type="checkbox" checked={regOpen !== false} disabled={busy || regOpen === null} onChange={(e) => changeRegistration(e.target.checked)} aria-label="Allow new accounts" />
            <i />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Running code</h3>
        <div className="switch-row" style={{ borderTop: 0, paddingBottom: 0 }}>
          <div>
            <strong>Allow everyone to run code</strong>
            <span className="hint-text">
              {runAll === false
                ? "Off: only the users selected in Edit can run code. Everyone else, admins included, gets a message instead."
                : "On: every signed-in user can run code. Use Edit to choose who keeps access if you turn this off."}
            </span>
          </div>
          <div className="switch-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditRun(true)} disabled={runAll === null} title="Choose who can run code">Edit</button>
            <label className="switch" title="Allow everyone to run code">
              <input type="checkbox" checked={runAll !== false} disabled={busy || runAll === null} onChange={(e) => changeRunAll(e.target.checked)} aria-label="Allow everyone to run code" />
              <i />
            </label>
          </div>
        </div>
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
                      <td className="cell-trunc">
                        <div className="user-cell">
                          <div className="avatar avatar--sm avatar--static" aria-hidden="true">
                            {avatars[u.uid] ? <img src={avatars[u.uid]} alt="" /> : (u.displayName || u.email || "?").trim()[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="user-cell__text">
                            <div className="trunc" title={u.displayName}>{u.displayName}</div>
                            <div className="mono hint-text trunc" title={`@${u.username}`}>@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono cell-trunc"><div className="trunc" title={u.email}>{u.email}</div></td>
                      <td>{u.role === "admin" ? <span className="badge">admin</span> : "user"}</td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn btn--ghost btn--sm" href={isMe ? "/app" : `/app?user=${u.uid}`}>{isMe ? "My code" : "View code"}</Link>
                          {!isMe && <button className="btn btn--ghost btn--sm" onClick={() => setToggleRole(u)} disabled={safeMode} title={safeMode ? "Turn safe mode off to change roles" : undefined}>{u.role === "admin" ? "Remove admin" : "Make admin"}</button>}
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

      <RunAccessDialog open={editRun} users={users} allowAll={runAll !== false} onClose={() => setEditRun(false)} onSaved={load} />
      <ConfirmDialog open={confirmSafeOff} danger title="Turn safe mode off?" message="You will be able to edit and delete other users' code. Everything you change is real and can't be undone." confirmLabel="Turn off" busy={busy} onConfirm={() => changeSafeMode(false)} onCancel={() => setConfirmSafeOff(false)} />
      <ConfirmDialog open={!!toggleRole} title={toggleRole?.role === "admin" ? "Remove admin rights?" : "Make this user an admin?"} message={`@${toggleRole?.username} ${toggleRole?.role === "admin" ? "will lose" : "will gain"} access to the admin tools.`} confirmLabel="Confirm" busy={busy} onConfirm={doRole} onCancel={() => setToggleRole(null)} />
      <ConfirmDialog open={!!toDelete} danger title="Delete this account?" message={`@${toDelete?.username} and ALL of their code will be permanently deleted.`} confirmLabel="Delete forever" busy={busy} onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
