"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { TEMPLATES } from "@/lib/templates";
import { fileClassName, isSelfOrDescendant, nameTaken, pathOf, validateName, type FsNode, type NodeType } from "@/lib/tree";

export type DialogState =
  | { kind: "new"; type: NodeType; parentId: string | null }
  | { kind: "rename"; node: FsNode };

interface NodeDialogProps {
  state: DialogState;
  kids: Map<string | null, FsNode[]>;
  onSubmit: (name: string, templateKey: string) => Promise<void>;
  onClose: () => void;
}

// Create / rename dialog. Validates the name, checks for duplicates in the
// same folder, and (for new files) lets you pick a starter template.
export function NodeDialog({ state, kids, onSubmit, onClose }: NodeDialogProps) {
  const type: NodeType = state.kind === "new" ? state.type : state.node.type;
  const parentId = state.kind === "new" ? state.parentId : state.node.parentId;
  const [name, setName] = useState(state.kind === "rename" ? state.node.name : type === "file" ? "Main.java" : "");
  const [template, setTemplate] = useState("hello");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let finalName = name.trim();
    if (type === "file" && finalName && !finalName.includes(".")) finalName += ".java";
    const problem = validateName(finalName, type);
    if (problem) return setError(problem);
    if (nameTaken(kids, parentId, finalName, state.kind === "rename" ? state.node.id : undefined)) {
      return setError("Something with that name already exists here.");
    }
    setBusy(true);
    try {
      await onSubmit(finalName, template);
    } catch {
      setError("Couldn't save that change. Check your connection and try again.");
      setBusy(false);
    }
  }

  const title = state.kind === "rename" ? `Rename ${type}` : type === "file" ? "New file" : "New folder";
  const preview = type === "file" && state.kind === "new" ? fileClassName(name.trim() || "Main.java") : "";

  return (
    <Modal open onClose={busy ? () => {} : onClose} labelledBy="node-dialog-title">
      <h3 id="node-dialog-title">{title}</h3>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="node-name">Name</label>
          <input id="node-name" autoFocus value={name} maxLength={64} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder={type === "file" ? "Main.java" : "week-01"} autoComplete="off" spellCheck={false} />
        </div>
        {type === "file" && state.kind === "new" && (
          <div className="field">
            <label htmlFor="node-template">Start from</label>
            <select id="node-template" value={template} onChange={(e) => setTemplate(e.target.value)}>
              {TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <span className="hint-text">The class will be named <code>{preview}</code>.</span>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Saving…" : state.kind === "rename" ? "Rename" : "Create"}</button>
        </div>
      </form>
    </Modal>
  );
}

interface MoveDialogProps {
  node: FsNode;
  nodes: FsNode[];
  kids: Map<string | null, FsNode[]>;
  onMove: (targetId: string | null) => Promise<void>;
  onClose: () => void;
}

// "Move to…" picker: the touch-friendly alternative to drag and drop.
export function MoveDialog({ node, nodes, kids, onMove, onClose }: MoveDialogProps) {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const folders = nodes.filter((n) => n.type === "folder").sort((a, b) => pathOf(map, a.id).localeCompare(pathOf(map, b.id)));
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function blocked(folderId: string | null): string | null {
    if (folderId === node.parentId) return "Already here";
    if (folderId && isSelfOrDescendant(map, node.id, folderId)) return "Can't move into itself";
    if (nameTaken(kids, folderId, node.name, node.id)) return "Name already used there";
    return null;
  }

  async function go() {
    if (target === undefined) return;
    setBusy(true);
    try {
      await onMove(target);
    } catch (e) {
      setError((e as Error).message === "too-deep" ? "That would nest folders too deeply." : "Couldn't move it. Try again.");
      setBusy(false);
    }
  }

  const options: { id: string | null; label: string }[] = [{ id: null, label: "/  (workspace root)" }, ...folders.map((f) => ({ id: f.id, label: pathOf(map, f.id) }))];

  return (
    <Modal open onClose={busy ? () => {} : onClose} labelledBy="move-title">
      <h3 id="move-title">Move “{node.name}”</h3>
      <div className="folder-pick" role="listbox" aria-label="Destination folder">
        {options.map((o) => {
          const why = blocked(o.id);
          return (
            <button key={o.id ?? "root"} type="button" role="option" aria-selected={target === o.id} className={target === o.id ? "is-selected" : ""} disabled={!!why} title={why ?? undefined} onClick={() => setTarget(o.id)}>
              {o.label}{why ? ` — ${why}` : ""}
            </button>
          );
        })}
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="modal__actions">
        <button className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn--primary" onClick={go} disabled={busy || target === undefined}>{busy ? "Moving…" : "Move here"}</button>
      </div>
    </Modal>
  );
}
