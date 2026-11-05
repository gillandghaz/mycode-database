"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { adminSaveContacts, contactHref, loadContacts, MAX_CONTACTS, MAX_LINK, MAX_TITLE, MAX_TYPE, type Contact } from "@/lib/contacts";

const DASH = "-";

export default function ContactTab() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setItems(await loadContacts());
    } catch {
      setError("Kontak tidak bisa dimuat.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h2 className="tab-title">Contact</h2>

      <div className="card">
        <div className="card__head">
          <div>
            <h3>Kontak</h3>
            <p className="desc">Hubungi kami lewat salah satu kontak berikut.</p>
          </div>
          {isAdmin && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)} disabled={!items}>
              Edit
            </button>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}
        {!items && !error && <p className="hint-text">Memuat…</p>}
        {items && items.length === 0 && <p className="hint-text" style={{ margin: 0 }}>Belum ada kontak.</p>}
        {items && items.length > 0 && (
          <div className="contact-list">
            {items.map((c, i) => {
              const href = contactHref(c.link);
              const shown = c.title.trim() || c.link.trim();
              return (
                <div className="contact-row" key={i}>
                  <div className="contact-row__type">{c.type.trim() || DASH}</div>
                  <div className="contact-row__value">
                    {!c.link.trim() ? (
                      DASH
                    ) : href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer nofollow">{shown}</a>
                    ) : (
                      shown
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdmin && items && (
        <EditContacts
          open={editing}
          initial={items}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setItems(saved);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function EditContacts({ open, initial, onClose, onSaved }: { open: boolean; initial: Contact[]; onClose: () => void; onSaved: (items: Contact[]) => void }) {
  const [rows, setRows] = useState<Contact[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Start from the saved list every time the popup opens.
  useEffect(() => {
    if (open) {
      setRows(initial.map((c) => ({ ...c })));
      setError("");
    }
  }, [open, initial]);

  function update(i: number, patch: Partial<Contact>) {
    setRows((r) => r.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function save() {
    setBusy(true);
    setError("");
    const clean = rows.map((c) => ({ type: c.type.trim(), title: c.title.trim(), link: c.link.trim() }));
    try {
      await adminSaveContacts(clean);
      onSaved(clean);
    } catch (e) {
      setError((e as Error).message || "Gagal menyimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} labelledBy="contact-edit-title" wide>
      <h3 id="contact-edit-title">Edit kontak</h3>
      <p>Jika nama jenis atau tautan dikosongkan, yang tampil adalah “-”. Awali tautan dengan https:// (email dan tel: juga bisa).</p>

      {rows.length === 0 && <p className="hint-text">Belum ada kontak. Tekan “Tambah kontak”.</p>}
      {rows.map((c, i) => (
        <div className="contact-edit" key={i}>
          <div className="contact-edit__head">
            <span>Kontak {i + 1}</span>
            <button type="button" className="btn btn--ghost btn--sm" style={{ color: "var(--danger)" }} onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} disabled={busy}>
              Hapus
            </button>
          </div>
          <div className="field">
            <label htmlFor={`ct-type-${i}`}>Nama jenis kontak</label>
            <input id={`ct-type-${i}`} value={c.type} maxLength={MAX_TYPE} placeholder="mis. Email, WhatsApp, Instagram" onChange={(e) => update(i, { type: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`ct-title-${i}`}>Judul kontak (teks yang tampil, opsional)</label>
            <input id={`ct-title-${i}`} value={c.title} maxLength={MAX_TITLE} placeholder="Jika kosong, tautan yang ditampilkan" onChange={(e) => update(i, { title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`ct-link-${i}`}>Tautan / isi</label>
            <input id={`ct-link-${i}`} value={c.link} maxLength={MAX_LINK} placeholder="https://… atau alamat email" onChange={(e) => update(i, { link: e.target.value })} />
          </div>
        </div>
      ))}

      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRows((r) => [...r, { type: "", title: "", link: "" }])} disabled={busy || rows.length >= MAX_CONTACTS}>
        Tambah kontak
      </button>
      {rows.length >= MAX_CONTACTS && <span className="hint-text" style={{ marginLeft: 10 }}>Maksimal {MAX_CONTACTS} kontak.</span>}

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
      <div className="modal__actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Batal</button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
      </div>
    </Modal>
  );
}
