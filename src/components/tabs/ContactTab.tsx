"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ConfirmDialog, Modal } from "@/components/Modal";
import {
  adminSaveContacts,
  contactHref,
  DEFAULT_CONTACTS,
  MAX_CONTACTS,
  MAX_DESCRIPTION,
  MAX_LINK,
  MAX_TITLE,
  MAX_TYPE,
  newContactId,
  subscribeContacts,
  type Contact,
} from "@/lib/contacts";

// Shown when the name or the link of a contact is empty.
const DASH = "-";

export default function ContactTab() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Contact[]>(DEFAULT_CONTACTS);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Edit popup for ONE contact: an id, or "new".
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editLink, setEditLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [descBusy, setDescBusy] = useState(false);
  const [descErr, setDescErr] = useState("");

  useEffect(() => {
    return subscribeContacts(
      ({ items: i, description: d }) => {
        setItems(i);
        setDescription(d);
        setLoading(false);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      }
    );
  }, []);

  function openEdit(item: Contact) {
    setEditingId(item.id);
    setEditType(item.type);
    setEditTitle(item.title);
    setEditLink(item.link);
    setErr("");
  }

  function openNew() {
    setEditingId("new");
    setEditType("");
    setEditTitle("");
    setEditLink("");
    setErr("");
  }

  function closeEdit() {
    setEditingId(null);
    setConfirmingRemove(false);
  }

  async function handleSaveItem() {
    setBusy(true);
    setErr("");
    try {
      const payload = { type: editType.trim(), title: editTitle.trim(), link: editLink.trim() };
      const next =
        editingId === "new"
          ? [...items, { id: newContactId(), ...payload }]
          : items.map((it) => (it.id === editingId ? { ...it, ...payload } : it));
      await adminSaveContacts({ items: next });
      setEditingId(null);
    } catch (e) {
      setErr((e as Error).message || "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmRemoveItem() {
    setBusy(true);
    try {
      await adminSaveContacts({ items: items.filter((it) => it.id !== editingId) });
      setEditingId(null);
      setConfirmingRemove(false);
    } catch {
      setErr("Gagal menghapus.");
      setConfirmingRemove(false);
    } finally {
      setBusy(false);
    }
  }

  function openEditDesc() {
    setDescDraft(description);
    setDescErr("");
    setEditingDesc(true);
  }

  async function handleSaveDesc() {
    setDescBusy(true);
    setDescErr("");
    try {
      await adminSaveContacts({ description: descDraft.trim() });
      setEditingDesc(false);
    } catch (e) {
      setDescErr((e as Error).message || "Gagal menyimpan."); // popup stays open
    } finally {
      setDescBusy(false);
    }
  }

  if (loading) return <div />;

  return (
    <div>
      <h2 className="tab-title">Contact</h2>
      <p className="hint-text" style={{ marginBottom: 18 }}>
        Informasi kontak pembuat aplikasi ini.
      </p>
      {loadError && <p className="error-text">Kontak tidak bisa dimuat.</p>}

      {items.map((item) => {
        const href = contactHref(item.link);
        const displayText = item.title || item.link;
        return (
          <div className="contact-item" key={item.id}>
            <span className="contact-item__label">
              {isAdmin && (
                <button type="button" className="contact-edit-btn" onClick={() => openEdit(item)} title="Edit kontak ini" aria-label="Edit kontak ini">
                  <EditIcon />
                </button>
              )}
              {item.type || DASH}
            </span>
            {item.link ? (
              href ? (
                <a className="contact-item__link" href={href} target="_blank" rel="noopener noreferrer nofollow" title={displayText}>
                  {displayText}
                </a>
              ) : (
                <span className="contact-item__value" title={displayText}>{displayText}</span>
              )
            ) : (
              <span className="contact-item__value">{DASH}</span>
            )}
          </div>
        );
      })}

      {isAdmin && (
        <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={openNew} disabled={items.length >= MAX_CONTACTS}>
          + Tambah kontak
        </button>
      )}
      {isAdmin && items.length >= MAX_CONTACTS && <span className="hint-text" style={{ marginLeft: 10 }}>Maksimal {MAX_CONTACTS} kontak.</span>}

      {(description || isAdmin) && (
        <div className="contact-desc">
          {description && <p className="contact-desc__text">{description}</p>}
          {isAdmin && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={openEditDesc}>
              Edit deskripsi
            </button>
          )}
        </div>
      )}

      {/* Edit popup for one contact */}
      <Modal open={isAdmin && editingId !== null} onClose={busy || confirmingRemove ? () => {} : closeEdit} labelledBy="contact-edit-title">
        <h3 id="contact-edit-title">{editingId === "new" ? "Tambah kontak" : "Edit kontak"}</h3>
        <div className="field">
          <label htmlFor="ct-type">Nama jenis kontak</label>
          <input id="ct-type" value={editType} maxLength={MAX_TYPE} onChange={(e) => setEditType(e.target.value)} placeholder="mis. Instagram" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="ct-title">
            Judul kontak <span className="hint-inline">(teks yang tampil, opsional)</span>
          </label>
          <input id="ct-title" value={editTitle} maxLength={MAX_TITLE} onChange={(e) => setEditTitle(e.target.value)} placeholder="mis. @username, kosongkan untuk pakai isi tautan apa adanya" />
        </div>
        <div className="field">
          <label htmlFor="ct-link">Tautan / isi</label>
          <input id="ct-link" value={editLink} maxLength={MAX_LINK} onChange={(e) => setEditLink(e.target.value)} placeholder='Kosongkan untuk menampilkan "-"' />
        </div>
        {err && <p className="error-text">{err}</p>}
        <div className="modal__actions" style={{ justifyContent: "space-between" }}>
          {editingId !== "new" ? (
            <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirmingRemove(true)} disabled={busy}>
              Hapus
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={closeEdit} disabled={busy}>Batal</button>
            <button type="button" className="btn btn--primary" onClick={handleSaveItem} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmingRemove}
        danger
        title="Hapus kontak ini?"
        message={`Jenis kontak "${editType || DASH}" akan dihapus dari halaman Contact dan tidak bisa dikembalikan.`}
        confirmLabel="Ya, Hapus"
        busy={busy}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={handleConfirmRemoveItem}
      />

      {/* Edit popup for the description */}
      <Modal open={isAdmin && editingDesc} onClose={descBusy ? () => {} : () => setEditingDesc(false)} labelledBy="contact-desc-title">
        <h3 id="contact-desc-title">Edit deskripsi</h3>
        <div className="field">
          <textarea value={descDraft} maxLength={MAX_DESCRIPTION} onChange={(e) => setDescDraft(e.target.value)} placeholder="Kosongkan untuk menyembunyikan deskripsi" style={{ minHeight: 100 }} autoFocus aria-label="Deskripsi" />
        </div>
        {descErr && <p className="error-text">{descErr}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setEditingDesc(false)} disabled={descBusy}>Batal</button>
          <button type="button" className="btn btn--primary" onClick={handleSaveDesc} disabled={descBusy}>{descBusy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </Modal>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M11 2.5 13.5 5 5.5 13 2.5 13.5 3 10.5 11 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
