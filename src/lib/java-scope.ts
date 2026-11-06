import type { FsNode } from "./tree";
import { maskNonCode, type Candidate } from "./java-bundle";

// Which files may the running file use? Its "project": the folder it is in,
// including sub-folders. If the file declares a package that matches its
// folders (src/app/Main.java with "package app;") the project starts above
// those folders instead, so sibling packages such as src/models are found too.
export function javaScope(
  entry: FsNode,
  nodeMap: Map<string, FsNode>,
  kids: Map<string | null, FsNode[]>,
  entryCode: string
): { entryDir: string[]; candidates: Candidate[] } {
  const namesTo = (parentId: string | null): string[] => {
    const names: string[] = [];
    let p = parentId;
    while (p) {
      const n = nodeMap.get(p);
      if (!n) break;
      names.unshift(n.name);
      p = n.parentId;
    }
    return names;
  };

  // Walk up as many folders as the package has parts, if the names match.
  let rootId = entry.parentId;
  const pkg = /^[ \t]*package\s+([\w.]+)\s*;/m.exec(maskNonCode(entryCode))?.[1];
  if (pkg) {
    const parts = pkg.split(".");
    const dirNames = namesTo(entry.parentId);
    const tail = dirNames.slice(dirNames.length - parts.length);
    if (tail.length === parts.length && tail.every((n, i) => n === parts[i])) {
      for (let i = 0; i < parts.length && rootId; i++) rootId = nodeMap.get(rootId)?.parentId ?? null;
    }
  }

  const rootDepth = namesTo(rootId).length;
  const entryDir = namesTo(entry.parentId).slice(rootDepth);

  const candidates: Candidate[] = [];
  const walk = (parentId: string | null, rel: string[]) => {
    for (const k of kids.get(parentId) ?? []) {
      if (k.type === "folder") walk(k.id, [...rel, k.name]);
      else if (k.id !== entry.id && /\.java$/i.test(k.name)) candidates.push({ id: k.id, name: k.name, dir: rel });
    }
  };
  walk(rootId, []);
  return { entryDir, candidates };
}
