// Pure helpers for the file tree (no Firebase imports, easy to test).

export type NodeType = "file" | "folder";

export interface FsNode {
  id: string;
  ownerUid: string;
  parentId: string | null; // null = workspace root
  type: NodeType;
  name: string;
  language?: string; // "java" for now
  size?: number; // bytes (files only)
  createdAt?: number; // epoch ms
  updatedAt?: number;
}

export const MAX_NAME_LENGTH = 64;
export const MAX_FILE_CHARS = 200_000; // keep in sync with firestore.rules
export const MAX_DEPTH = 12;

export function sortNodes(list: FsNode[]): FsNode[] {
  return [...list].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function childrenMap(nodes: FsNode[]): Map<string | null, FsNode[]> {
  const map = new Map<string | null, FsNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    const arr = map.get(key);
    if (arr) arr.push(n);
    else map.set(key, [n]);
  }
  for (const [k, v] of map) map.set(k, sortNodes(v));
  return map;
}

export function byId(nodes: FsNode[]): Map<string, FsNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

// True if `id` is `ancestorId` itself or lives somewhere below it.
export function isSelfOrDescendant(nodes: Map<string, FsNode>, ancestorId: string, id: string | null): boolean {
  let cur: string | null = id;
  let guard = 0;
  while (cur && guard++ < 1000) {
    if (cur === ancestorId) return true;
    cur = nodes.get(cur)?.parentId ?? null;
  }
  return false;
}

export function depthOf(nodes: Map<string, FsNode>, id: string | null): number {
  let d = 0;
  let cur: string | null = id;
  while (cur && d < 1000) {
    d += 1;
    cur = nodes.get(cur)?.parentId ?? null;
  }
  return d;
}

// Height of the subtree rooted at `id` (a file = 1).
export function subtreeHeight(kids: Map<string | null, FsNode[]>, id: string): number {
  const c = kids.get(id) ?? [];
  return 1 + (c.length ? Math.max(...c.map((k) => subtreeHeight(kids, k.id))) : 0);
}

export function descendantIds(kids: Map<string | null, FsNode[]>, id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    for (const k of kids.get(cur) ?? []) stack.push(k.id);
  }
  return out;
}

export function pathOf(nodes: Map<string, FsNode>, id: string): string {
  const parts: string[] = [];
  let cur: string | null = id;
  let guard = 0;
  while (cur && guard++ < 1000) {
    const n = nodes.get(cur);
    if (!n) break;
    parts.unshift(n.name);
    cur = n.parentId;
  }
  return "/" + parts.join("/");
}

export function nameTaken(
  kids: Map<string | null, FsNode[]>,
  parentId: string | null,
  name: string,
  ignoreId?: string
): boolean {
  const lower = name.toLowerCase();
  return (kids.get(parentId) ?? []).some((n) => n.id !== ignoreId && n.name.toLowerCase() === lower);
}

// Names are shown in the UI and used as Java file names, so keep them boring.
export function validateName(raw: string, type: NodeType): string | null {
  const name = raw.trim();
  if (!name) return "Name can't be empty.";
  if (name.length > MAX_NAME_LENGTH) return `Name can't be longer than ${MAX_NAME_LENGTH} characters.`;
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(name)) return 'Name can\'t contain \\ / : * ? " < > |';
  if (name === "." || name === "..") return "That name isn't allowed.";
  if (type === "file") {
    if (!/\.java$/i.test(name)) return "Java files must end in .java";
    // The file name doubles as the public class name, so it must be a valid identifier.
    if (!/^[A-Za-z_][A-Za-z0-9_]*\.java$/.test(name)) return "Use letters, digits and _ only, e.g. Main.java";
  }
  return null;
}

export function fileClassName(fileName: string): string {
  return fileName.replace(/\.java$/i, "");
}

export function formatBytes(n = 0): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
