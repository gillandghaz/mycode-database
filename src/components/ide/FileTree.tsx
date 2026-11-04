"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevron, IconFile, IconFolder, IconFolderOpen, IconMore } from "@/components/Icons";
import type { FsNode } from "@/lib/tree";

export type TreeAction = "new-file" | "new-folder" | "import" | "export" | "download" | "rename" | "move" | "delete";

interface Props {
  kids: Map<string | null, FsNode[]>;
  expanded: Set<string>;
  selectedId: string | null;
  activeId: string | null;
  readOnly: boolean;
  onToggle: (id: string) => void;
  onSelect: (node: FsNode) => void;
  onAction: (action: TreeAction, node: FsNode) => void;
  onDropOn: (dragId: string, targetFolderId: string | null) => void;
}

interface MenuState {
  node: FsNode;
  x: number;
  y: number;
}

const DRAG_TYPE = "application/x-mcd-node";

export default function FileTree({ kids, expanded, selectedId, activeId, readOnly, onToggle, onSelect, onAction, onDropOn }: Props) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e.type === "pointerdown" && menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  function openMenu(node: FsNode, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const width = 190;
    setMenu({ node, x: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)), y: Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 330)) });
  }

  function endDrag() {
    setDragId(null);
    setDropTarget(null);
  }

  function renderLevel(parentId: string | null, depth: number): React.ReactNode {
    return (kids.get(parentId) ?? []).map((n) => {
      const isFolder = n.type === "folder";
      const isOpen = expanded.has(n.id);
      const rowClass =
        "tree-row" +
        (selectedId === n.id || activeId === n.id ? " is-active" : "") +
        (dropTarget === n.id ? " is-drop" : "") +
        (dragId === n.id ? " is-dragging" : "") +
        (menu?.node.id === n.id ? " is-menu" : "");
      return (
        <div key={n.id}>
          <div
            className={rowClass}
            style={{ paddingLeft: 8 + depth * 14 }}
            role="treeitem"
            aria-expanded={isFolder ? isOpen : undefined}
            tabIndex={0}
            draggable={!readOnly}
            onClick={() => (isFolder ? (onToggle(n.id), onSelect(n)) : onSelect(n))}
            onKeyDown={(e) => {
              if (e.key === "Enter") isFolder ? (onToggle(n.id), onSelect(n)) : onSelect(n);
              if (e.key === "F2" && !readOnly) onAction("rename", n);
              if (e.key === "Delete" && !readOnly) onAction("delete", n);
            }}
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_TYPE, n.id);
              e.dataTransfer.effectAllowed = "move";
              setDragId(n.id);
            }}
            onDragEnd={endDrag}
            onDragOver={(e) => {
              if (!dragId || !isFolder) return;
              e.preventDefault();
              e.stopPropagation();
              if (dropTarget !== n.id) setDropTarget(n.id);
            }}
            onDrop={(e) => {
              if (!isFolder) return;
              e.preventDefault();
              e.stopPropagation();
              const id = e.dataTransfer.getData(DRAG_TYPE);
              endDrag();
              if (id) onDropOn(id, n.id);
            }}
          >
            <span style={{ width: 16, display: "grid", placeItems: "center", flex: "none" }}>{isFolder ? <IconChevron size={14} open={isOpen} /> : null}</span>
            <span style={{ flex: "none", display: "grid", color: isFolder ? "var(--accent)" : "var(--text-3)" }}>
              {isFolder ? (isOpen ? <IconFolderOpen size={15} /> : <IconFolder size={15} />) : <IconFile size={15} />}
            </span>
            <span className="tree-row__name" title={n.name}>{n.name}</span>
            {(
              <button type="button" className="icon-btn tree-row__more" aria-label={`Actions for ${n.name}`} onClick={(e) => { e.stopPropagation(); openMenu(n, e.currentTarget); }}>
                <IconMore size={15} />
              </button>
            )}
          </div>
          {isFolder && isOpen && renderLevel(n.id, depth + 1)}
        </div>
      );
    });
  }

  const empty = (kids.get(null) ?? []).length === 0;

  return (
    <div
      className={"tree" + (dropTarget === "root" ? " is-drop-root" : "")}
      role="tree"
      onDragOver={(e) => {
        if (!dragId) return;
        e.preventDefault();
        if (dropTarget !== "root") setDropTarget("root");
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData(DRAG_TYPE);
        endDrag();
        if (id) onDropOn(id, null);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropTarget(null);
      }}
    >
      {empty ? (
        <div className="tree-empty">
          {readOnly ? "This workspace is empty." : "Nothing here yet. Use the buttons above to create a folder or a file."}
        </div>
      ) : (
        renderLevel(null, 0)
      )}

      {menu && (
        <div ref={menuRef} className="ctx-menu" style={{ left: menu.x, top: menu.y }} role="menu">
          {menu.node.type === "folder" && !readOnly && (
            <>
              <button className="menu__item" role="menuitem" onClick={() => { onAction("new-file", menu.node); setMenu(null); }}>New file here</button>
              <button className="menu__item" role="menuitem" onClick={() => { onAction("new-folder", menu.node); setMenu(null); }}>New folder here</button>
              <button className="menu__item" role="menuitem" onClick={() => { onAction("import", menu.node); setMenu(null); }}>Import files here…</button>
            </>
          )}
          {menu.node.type === "folder" ? (
            <button className="menu__item" role="menuitem" onClick={() => { onAction("export", menu.node); setMenu(null); }}>Export folder (.zip)</button>
          ) : (
            <button className="menu__item" role="menuitem" onClick={() => { onAction("download", menu.node); setMenu(null); }}>Download file</button>
          )}
          {!readOnly && (
            <>
              <button className="menu__item" role="menuitem" onClick={() => { onAction("rename", menu.node); setMenu(null); }}>Rename</button>
              <button className="menu__item" role="menuitem" onClick={() => { onAction("move", menu.node); setMenu(null); }}>Move to…</button>
              <button className="menu__item menu__item--danger" role="menuitem" onClick={() => { onAction("delete", menu.node); setMenu(null); }}>Delete</button>
            </>
          )}
          {readOnly && <div className="menu__sub" style={{ padding: "8px 10px" }}>Read-only (safe mode)</div>}
        </div>
      )}
    </div>
  );
}
