"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CodeMirror from "@uiw/react-codemirror";
import { java } from "@codemirror/lang-java";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { setAdminSafeMode } from "@/lib/admin";
import { createNode, deleteNodeTree, importNodes, loadContent, moveNode, newNodeId, renameNode, saveContent, subscribeNodes } from "@/lib/fs";
import { useCanRun } from "@/lib/run-access";
import { collectDependencies } from "@/lib/java-bundle";
import { javaScope } from "@/lib/java-scope";
import { downloadBlob, exportFolderZip, formatSkipped, planFromFiles, resolvePlan, textBlob } from "@/lib/transfer";
import { getTemplate } from "@/lib/templates";
import {
  byId, childrenMap, depthOf, fileClassName, isSelfOrDescendant, nameTaken, pathOf, subtreeHeight,
  MAX_DEPTH, MAX_FILE_CHARS, type FsNode,
} from "@/lib/tree";
import { TopbarBrand } from "@/components/Logo";
import ProfileMenu from "@/components/ProfileMenu";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { IconFilePlus, IconFolderPlus, IconMenu, IconPlay, IconClose, IconLock, IconTerminal } from "@/components/Icons";
import FileTree, { type TreeAction } from "./FileTree";
import Terminal, { type TermLine } from "./Terminal";
import { MoveDialog, NodeDialog, type DialogState } from "./NodeDialogs";

type SaveState = "idle" | "saving" | "saved" | "error";

interface RunResponse {
  phase: "compile" | "run";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

const editorBase = EditorView.theme({
  "&": { backgroundColor: "#1b1f26", height: "100%" },
  ".cm-gutters": { backgroundColor: "#1b1f26", border: "none", color: "#5b6270" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(242,181,68,0.06)" },
  "&.cm-focused": { outline: "none" },
});

export default function Ide() {
  const { user, profile, isAdmin, safeMode } = useAuth();
  const params = useSearchParams();

  // ---- whose workspace is this? -------------------------------------------
  const requested = params.get("user");
  const viewingOther = isAdmin && !!requested && requested !== user!.uid;
  const workspaceUid = viewingOther ? requested! : user!.uid;
  // Safe mode only restricts OTHER people's code. Admins can always edit their own.
  const readOnly = viewingOther && safeMode;

  const [ownerName, setOwnerName] = useState("");
  useEffect(() => {
    if (!viewingOther) return;
    let cancelled = false;
    getDoc(doc(db, "users", workspaceUid))
      .then((s) => !cancelled && setOwnerName(s.exists() ? String(s.data().username) : "unknown"))
      .catch(() => !cancelled && setOwnerName("unknown"));
    return () => { cancelled = true; };
  }, [viewingOther, workspaceUid]);

  // ---- data ---------------------------------------------------------------
  const [nodes, setNodes] = useState<FsNode[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const firstLoad = useRef(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setNodes(null);
    setLoadError("");
    firstLoad.current = true;
    return subscribeNodes(
      workspaceUid,
      (list) => {
        setNodes(list);
        if (firstLoad.current) {
          firstLoad.current = false;
          setExpanded(new Set(list.filter((n) => n.type === "folder").map((n) => n.id)));
        }
      },
      () => setLoadError(viewingOther ? "Couldn't open that workspace." : "Couldn't load your workspace.")
    );
  }, [workspaceUid, viewingOther]);

  const nodeList = useMemo(() => nodes ?? [], [nodes]);
  const kids = useMemo(() => childrenMap(nodeList), [nodeList]);
  const nodeMap = useMemo(() => byId(nodeList), [nodeList]);

  // ---- tabs & buffers -----------------------------------------------------
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const saved = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 5000);
  }, []);

  // Reset per-workspace editor state when switching workspace.
  useEffect(() => {
    setOpenIds([]); setActiveId(null); setSelectedId(null); setBuffers({}); saved.current = {};
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }, [workspaceUid]);

  // Drop tabs whose file no longer exists (deleted here or elsewhere).
  useEffect(() => {
    if (!nodes) return;
    setOpenIds((ids) => {
      const next = ids.filter((id) => nodeMap.has(id));
      return next.length === ids.length ? ids : next;
    });
    setActiveId((id) => (id && !nodeMap.has(id) ? null : id));
  }, [nodes, nodeMap]);

  const writeFile = useCallback(
    async (id: string, text: string) => {
      setSaveState("saving");
      try {
        await saveContent(id, workspaceUid, text);
        saved.current[id] = text;
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        flash((e as Error).message === "file-too-large" ? `File is too large (max ${MAX_FILE_CHARS.toLocaleString()} characters).` : "Couldn't save. Your changes are still in the editor.");
      }
    },
    [workspaceUid, flash]
  );

  // Save one file now (cancels its pending autosave).
  const flushFile = useCallback(
    async (id: string) => {
      clearTimeout(timers.current[id]);
      const text = buffersRef.current[id];
      if (readOnly || text === undefined || text === saved.current[id]) return;
      await writeFile(id, text);
    },
    [readOnly, writeFile]
  );

  const buffersRef = useRef(buffers);
  buffersRef.current = buffers;

  const openFile = useCallback(
    async (node: FsNode) => {
      setSelectedId(node.id);
      setOpenIds((ids) => (ids.includes(node.id) ? ids : [...ids, node.id]));
      setActiveId(node.id);
      setSidebarOpen(false);
      if (saved.current[node.id] === undefined) {
        try {
          const text = await loadContent(node.id);
          saved.current[node.id] = text;
          setBuffers((b) => (b[node.id] === undefined ? { ...b, [node.id]: text } : b));
        } catch {
          flash("Couldn't open that file.");
          setOpenIds((ids) => ids.filter((i) => i !== node.id));
          setActiveId((cur) => (cur === node.id ? null : cur));
        }
      }
    },
    [flash]
  );

  function onEdit(id: string, value: string) {
    if (readOnly) return;
    setBuffers((b) => ({ ...b, [id]: value }));
    setSaveState("idle");
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      if (buffersRef.current[id] !== undefined && buffersRef.current[id] !== saved.current[id]) writeFile(id, buffersRef.current[id]);
    }, 900);
  }

  async function closeTab(id: string) {
    await flushFile(id);
    setOpenIds((ids) => {
      const idx = ids.indexOf(id);
      const next = ids.filter((i) => i !== id);
      setActiveId((cur) => (cur === id ? (next[Math.min(idx, next.length - 1)] ?? null) : cur));
      return next;
    });
  }

  // Warn before leaving with unsaved work.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const dirty = Object.keys(buffersRef.current).some((id) => buffersRef.current[id] !== saved.current[id]);
      if (dirty && !readOnly) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [readOnly]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  // ---- tree actions -------------------------------------------------------
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [moving, setMoving] = useState<FsNode | null>(null);
  const [deleting, setDeleting] = useState<FsNode | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // New items go inside the selected folder (or next to the selected file).
  function currentParent(): string | null {
    const sel = selectedId ? nodeMap.get(selectedId) : null;
    if (!sel) return null;
    return sel.type === "folder" ? sel.id : sel.parentId;
  }

  // ---- import / export ----------------------------------------------------
  const [transferBusy, setTransferBusy] = useState(false);
  const [report, setReport] = useState<{ title: string; summary: string; lines: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<FsNode | null>(null);

  // Unsaved editor text wins over what is stored, so an export matches the screen.
  const textOf = useCallback(async (id: string) => buffersRef.current[id] ?? (await loadContent(id)), []);

  async function exportFolder(node: FsNode) {
    if (transferBusy) return;
    setTransferBusy(true);
    try {
      const { blob, fileCount } = await exportFolderZip(node, kids, textOf);
      if (fileCount === 0) flash("That folder has no files to export.");
      else downloadBlob(blob, `${node.name}.zip`);
    } catch {
      flash("Couldn't export that folder. Try again.");
    } finally {
      setTransferBusy(false);
    }
  }

  async function downloadFile(node: FsNode) {
    if (transferBusy) return;
    setTransferBusy(true);
    try {
      downloadBlob(textBlob(await textOf(node.id)), node.name);
    } catch {
      flash("Couldn't download that file. Try again.");
    } finally {
      setTransferBusy(false);
    }
  }

  async function handleImportPicked(list: File[]) {
    const target = importTargetRef.current;
    importTargetRef.current = null;
    const picked = list;
    if (!target || picked.length === 0 || readOnly) return;
    if (transferBusy) return flash("Another import or export is still running.");
    setTransferBusy(true);
    try {
      const plan = await planFromFiles(picked);
      const res = resolvePlan(plan, { baseId: target.id, nodeMap, kids, newId: newNodeId });
      if (res.files.length > 0 || res.folders.length > 0) {
        await importNodes(workspaceUid, res.folders, res.files);
        setExpanded((s) => {
          const n = new Set(s);
          n.add(target.id);
          res.folders.forEach((f) => n.add(f.id));
          return n;
        });
      }
      const imported = res.files.length + res.folders.length > 0;
      setReport({
        title: imported ? "Import finished" : "Nothing was imported",
        summary: imported
          ? `Added ${res.files.length} file${res.files.length === 1 ? "" : "s"} and ${res.folders.length} folder${res.folders.length === 1 ? "" : "s"} to “${target.name}”.` +
            (res.skipped.length ? ` ${res.skipped.length} item${res.skipped.length === 1 ? " was" : "s were"} skipped:` : "")
          : "Nothing could be added to “" + target.name + "”:",
        lines: formatSkipped(res.skipped),
      });
    } catch (e) {
      flash((e as Error).message === "file-too-large" ? `A file is too large (max ${MAX_FILE_CHARS.toLocaleString()} characters).` : "Import stopped part-way. Some items may have been added; check the explorer.");
    } finally {
      setTransferBusy(false);
    }
  }

  function handleAction(action: TreeAction, node: FsNode) {
    if (action === "export") return void exportFolder(node);
    if (action === "download") return void downloadFile(node);
    if (readOnly) return;
    if (action === "import") {
      importTargetRef.current = node;
      fileInputRef.current?.click();
      return;
    }
    if (action === "new-file") setDialog({ kind: "new", type: "file", parentId: node.id });
    if (action === "new-folder") setDialog({ kind: "new", type: "folder", parentId: node.id });
    if (action === "rename") setDialog({ kind: "rename", node });
    if (action === "move") setMoving(node);
    if (action === "delete") setDeleting(node);
  }

  async function submitDialog(name: string, templateKey: string) {
    if (!dialog) return;
    if (dialog.kind === "rename") {
      await renameNode(dialog.node.id, name);
    } else {
      if (dialog.parentId && depthOf(nodeMap, dialog.parentId) >= MAX_DEPTH) throw new Error("too-deep");
      const content = dialog.type === "file" ? getTemplate(templateKey).code(fileClassName(name)) : undefined;
      const id = await createNode({ ownerUid: workspaceUid, parentId: dialog.parentId, type: dialog.type, name, content });
      if (dialog.parentId) setExpanded((s) => new Set(s).add(dialog.parentId!));
      if (dialog.type === "file") {
        saved.current[id] = content ?? "";
        setBuffers((b) => ({ ...b, [id]: content ?? "" }));
        setOpenIds((ids) => [...ids, id]);
        setActiveId(id);
        setSelectedId(id);
        setSidebarOpen(false);
      } else {
        setSelectedId(id);
      }
    }
    setDialog(null);
  }

  async function moveTo(id: string, targetId: string | null) {
    const node = nodeMap.get(id);
    if (!node || readOnly) return;
    if (node.parentId === targetId) return;
    if (targetId && isSelfOrDescendant(nodeMap, id, targetId)) return flash("A folder can't be moved into itself.");
    if (nameTaken(kids, targetId, node.name, id)) return flash(`"${node.name}" already exists in that folder.`);
    if (depthOf(nodeMap, targetId) + subtreeHeight(kids, id) > MAX_DEPTH) throw new Error("too-deep");
    await moveNode(id, targetId);
    if (targetId) setExpanded((s) => new Set(s).add(targetId));
  }

  async function dropOn(dragId: string, targetId: string | null) {
    try {
      await moveTo(dragId, targetId);
    } catch (e) {
      flash((e as Error).message === "too-deep" ? "That would nest folders too deeply." : "Couldn't move it. Try again.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteNodeTree(nodeList, deleting.id);
      setDeleting(null);
    } catch {
      flash("Couldn't delete. Try again.");
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  // ---- running code -------------------------------------------------------
  const [lines, setLines] = useState<TermLine[]>([]);
  const [stdin, setStdin] = useState("");
  const [termTab, setTermTab] = useState<"output" | "input">("output");
  const [running, setRunning] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);

  const activeNode = activeId ? nodeMap.get(activeId) : undefined;
  const canRun = useCanRun();

  async function handleRun() {
    if (!activeNode || running) return;
    if (!canRun) {
      setTermTab("output");
      setLines((l) => [...l, { kind: "err", text: "Running code is turned off for your account right now." }]);
      return;
    }
    const id = activeNode.id;
    setTermTab("output");
    await flushFile(id);
    setRunning(true);
    setLines((l) => [...l, { kind: "cmd", text: `$ run ${activeNode.name}` }]);
    try {
      const token = await auth.currentUser!.getIdToken();
      const entryCode = buffersRef.current[id] ?? "";

      // OOP across files: find the other files this one uses (same folder and
      // sub-folders), including unsaved edits, and send them along.
      let files: Array<{ name: string; code: string }> = [];
      try {
        const scope = javaScope(activeNode, nodeMap, kids, entryCode);
        if (scope.candidates.length > 0) {
          const dep = await collectDependencies({
            entry: { id, name: activeNode.name, dir: scope.entryDir, code: entryCode },
            candidates: scope.candidates,
            getCode: textOf,
          });
          files = dep.files.map((f) => ({ name: f.name, code: f.code }));
          if (dep.truncated) setLines((l) => [...l, { kind: "dim", text: "Some referenced files were left out (too many or too large)." }]);
        }
      } catch {
        setLines((l) => [...l, { kind: "err", text: "Couldn't read the other files this program uses. Try again." }]);
        return;
      }
      if (files.length > 0) setLines((l) => [...l, { kind: "dim", text: `using ${files.map((f) => f.name).join(", ")}` }]);

      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: "java", fileName: activeNode.name, code: entryCode, stdin, files }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503 && body.code === "runner-unavailable") {
        setLines((l) => [...l, { kind: "dim", text: "The Java runner isn't connected yet." }]);
        setNotAvailable(true);
      } else if (!res.ok) {
        setLines((l) => [...l, { kind: "err", text: body.error || `Request failed (HTTP ${res.status}).` }]);
      } else {
        const r = body as RunResponse;
        const out: TermLine[] = [];
        if (r.stdout) out.push({ kind: "out", text: r.stdout });
        if (r.stderr) out.push({ kind: "err", text: r.stderr });
        if (r.phase === "compile") out.push({ kind: "err", text: `✗ compilation failed (exit code ${r.exitCode ?? "?"})` });
        else out.push({ kind: r.exitCode === 0 ? "good" : "err", text: `${r.exitCode === 0 ? "✓" : "✗"} exited with code ${r.exitCode ?? "?"} · ${r.durationMs} ms` });
        setLines((l) => [...l, ...out]);
      }
    } catch {
      setLines((l) => [...l, { kind: "err", text: "Couldn't reach the server. Check your connection." }]);
    } finally {
      setRunning(false);
    }
  }

  function onEditorKeyDown(e: React.KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (activeId) flushFile(activeId);
    }
    if (mod && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  }

  // ---- render -------------------------------------------------------------
  const settings = profile?.settings ?? {};
  const extensions = useMemo(() => {
    const ext = [java(), editorBase];
    if (settings.wordWrap) ext.push(EditorView.lineWrapping);
    return ext;
  }, [settings.wordWrap]);

  const activeText = activeId ? buffers[activeId] : undefined;
  const dirty = (id: string) => !readOnly && buffers[id] !== undefined && buffers[id] !== saved.current[id];

  return (
    <div className="ide">
      <header className="topbar">
        <button className="icon-btn sidebar-toggle" aria-label="Toggle file explorer" onClick={() => setSidebarOpen((v) => !v)}><IconMenu size={20} /></button>
        <TopbarBrand />
        <span className="topbar__crumb">{activeNode ? pathOf(nodeMap, activeNode.id) : ""}</span>
        <div className="topbar__right">
          <button className="btn btn--run btn--sm" onClick={handleRun} disabled={!activeNode || running || !canRun} title={canRun ? "Run (Ctrl+Enter)" : "Running code is turned off for your account"}>
            {running ? <span className="spinner" role="status" aria-label="Running" /> : <IconPlay size={13} />}{" "}
            <span className={"topbar__runlabel" + (running ? " is-running" : "")}>{running ? "Running…" : "Run"}</span>
          </button>
          <Link href="/dashboard" className="btn btn--ghost btn--sm topbar__nav">Dashboard</Link>
          <ProfileMenu />
        </div>
      </header>

      {viewingOther && (
        <div className={"ide-banner " + (readOnly ? "ide-banner--ro" : "ide-banner--rw")}>
          <IconLock size={14} />
          {readOnly ? (
            <span>Viewing <b>@{ownerName || "…"}</b>&apos;s workspace · read-only (safe mode is on)</span>
          ) : (
            <span>Safe mode is OFF — changes you make here edit <b>@{ownerName || "…"}</b>&apos;s real code.</span>
          )}
          {readOnly ? (
            <Link href="/dashboard?tab=admin" className="btn btn--ghost btn--sm">Manage in Admin</Link>
          ) : (
            <button className="btn btn--ghost btn--sm" onClick={() => setAdminSafeMode(user!.uid, true).catch(() => flash("Couldn't change safe mode."))}>Turn safe mode on</button>
          )}
        </div>
      )}

      <div className="ide-body">
        <div className={"ide-scrim" + (sidebarOpen ? " is-open" : "")} onClick={() => setSidebarOpen(false)} />
        <aside className={"ide-side" + (sidebarOpen ? " is-open" : "")} aria-label="File explorer">
          <div className="ide-side__head">
            <span>{viewingOther ? `@${ownerName || "…"}` : "Explorer"}</span>
            {!readOnly && (
              <>
                <button className="icon-btn" aria-label="New file" title="New file" onClick={() => setDialog({ kind: "new", type: "file", parentId: currentParent() })}><IconFilePlus size={17} /></button>
                <button className="icon-btn" aria-label="New folder" title="New folder" onClick={() => setDialog({ kind: "new", type: "folder", parentId: currentParent() })}><IconFolderPlus size={17} /></button>
              </>
            )}
          </div>
          {nodes === null && !loadError ? (
            <div className="tree-empty">Loading…</div>
          ) : loadError ? (
            <div className="tree-empty" style={{ color: "var(--danger)" }}>{loadError}</div>
          ) : (
            <FileTree
              kids={kids}
              expanded={expanded}
              selectedId={selectedId}
              activeId={activeId}
              readOnly={readOnly}
              onToggle={(id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
              onSelect={(n) => (n.type === "file" ? openFile(n) : setSelectedId(n.id))}
              onAction={handleAction}
              onDropOn={dropOn}
            />
          )}
        </aside>

        <main className="ide-main">
          <div className="ide-tabs" role="tablist">
            {openIds.map((id) => {
              const n = nodeMap.get(id);
              if (!n) return null;
              return (
                <div key={id} role="tab" aria-selected={id === activeId} tabIndex={0} className={"ide-tab" + (id === activeId ? " is-active" : "")} onClick={() => setActiveId(id)} onKeyDown={(e) => e.key === "Enter" && setActiveId(id)}>
                  <span className="ide-tab__name" title={n.name}>{n.name}</span>
                  {dirty(id) && <span className="ide-tab__dot" aria-label="unsaved" />}
                  <button className="ide-tab__x" aria-label={`Close ${n.name}`} onClick={(e) => { e.stopPropagation(); closeTab(id); }}><IconClose size={13} /></button>
                </div>
              );
            })}
          </div>

          <div className="ide-editor" onKeyDown={onEditorKeyDown}>
            {activeNode && activeText !== undefined ? (
              <CodeMirror
                key={activeNode.id}
                value={activeText}
                height="100%"
                theme={oneDark}
                extensions={extensions}
                editable={!readOnly}
                readOnly={readOnly}
                onChange={(v) => onEdit(activeNode.id, v)}
                basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, indentOnInput: true, autocompletion: true }}
                style={{ fontSize: settings.fontSize ?? 14, height: "100%", ["--editor-fs" as string]: `${settings.fontSize ?? 14}px` }}
              />
            ) : activeNode ? (
              <div className="ide-welcome">Opening…</div>
            ) : (
              <div className="ide-welcome">
                <div>
                  <b>{readOnly ? "Pick a file to read" : "Pick a file, or create one"}</b>
                  {readOnly ? "Choose a file in the explorer." : "Use the explorer on the left. Folders and files can be dragged to reorganise them."}
                </div>
              </div>
            )}
          </div>

          <div className="ide-status">
            <span>{activeNode ? "Java" : ""}</span>
            {readOnly && <span><IconLock size={11} /> read-only</span>}
            <span className="grow" />
            {transferBusy && <span>working…</span>}
            {notice && <span className="is-err">{notice}</span>}
            {!readOnly && activeNode && (
              <span className={saveState === "error" ? "is-err" : ""}>
                {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : saveState === "error" ? "not saved" : dirty(activeNode.id) ? "unsaved changes" : "saved"}
              </span>
            )}
          </div>

          <Terminal lines={lines} stdin={stdin} running={running} tab={termTab} onTab={setTermTab} onStdin={setStdin} onClear={() => setLines([])} />
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".java,.zip,application/zip"
        style={{ display: "none" }}
        onChange={(e) => {
          const files = e.target.files;
          // Copy first: clearing the input empties the live FileList.
          const copy = files ? Array.from(files) : [];
          e.target.value = "";
          handleImportPicked(copy);
        }}
      />

      {dialog && <NodeDialog state={dialog} kids={kids} onSubmit={submitDialog} onClose={() => setDialog(null)} />}
      {moving && (
        <MoveDialog
          node={moving}
          nodes={nodeList}
          kids={kids}
          onMove={async (t) => { await moveTo(moving.id, t); setMoving(null); }}
          onClose={() => setMoving(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        danger
        title={`Delete ${deleting?.type === "folder" ? "folder" : "file"}?`}
        message={deleting?.type === "folder" ? `“${deleting?.name}” and everything inside it will be permanently deleted.` : `“${deleting?.name}” will be permanently deleted.`}
        confirmLabel="Delete"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <Modal open={!!report} onClose={() => setReport(null)} labelledBy="report-title">
        <h3 id="report-title">{report?.title}</h3>
        <p>{report?.summary}</p>
        {!!report?.lines.length && (
          <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13, color: "var(--text-2)", maxHeight: 220, overflow: "auto", wordBreak: "break-word" }}>
            {report.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
        <div className="modal__actions">
          <button className="btn btn--primary" autoFocus onClick={() => setReport(null)}>OK</button>
        </div>
      </Modal>

      <Modal open={notAvailable} onClose={() => setNotAvailable(false)} labelledBy="na-title">
        <div className="modal__icon"><IconTerminal size={20} /></div>
        <h3 id="na-title">Not available yet</h3>
        <p>The Java compiler isn&apos;t connected yet, so Run can&apos;t execute your code. Everything else works, and your code is saved. Run will start working as soon as the compiler is switched on.</p>
        <div className="modal__actions">
          <button className="btn btn--primary" autoFocus onClick={() => setNotAvailable(false)}>Got it</button>
        </div>
      </Modal>
    </div>
  );
}
