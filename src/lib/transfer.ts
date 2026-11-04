// Import / export of workspace files (client side, no Firebase imports here).
//
//  Import: .java files and .zip archives (folders inside a zip are kept).
//  Export: a folder becomes a .zip with the same folder structure; a single
//          file is downloaded as-is.
//
// Everything is validated with the same rules as "New file" / "New folder"
// (names, depth, size), so an import can never create something the editor
// itself would refuse. Firestore rules still have the last word.

import { strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { depthOf, MAX_DEPTH, MAX_FILE_CHARS, validateName, type FsNode } from "./tree";

export const MAX_IMPORT_FILES = 300;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // one uploaded file / zip
const MAX_UNPACKED_BYTES = 20 * 1024 * 1024; // everything inside one zip
const MAX_ENTRY_BYTES = MAX_FILE_CHARS * 4; // UTF-8 is at most 4 bytes per character

export interface Skipped {
  name: string;
  reason: string;
}

export interface PlanFile {
  dir: string[]; // folder path relative to the import target
  name: string;
  content: string;
}

export interface ImportPlan {
  dirs: string[][]; // explicit (possibly empty) folders from zips
  files: PlanFile[];
  skipped: Skipped[];
}

export interface NewFolder {
  id: string;
  parentId: string | null;
  name: string;
}

export interface NewFile extends NewFolder {
  content: string;
}

export interface ResolvedImport {
  folders: NewFolder[];
  files: NewFile[];
  skipped: Skipped[];
}

// ---- reading what the user picked -----------------------------------------

function decodeText(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\u0000")) return null; // binary file
    return text.replace(/^\uFEFF/, "");
  } catch {
    return null;
  }
}

function isHidden(segs: string[]): boolean {
  return segs[0] === "__MACOSX" || segs.some((s) => s.startsWith("."));
}

function dirError(segs: string[]): string | null {
  for (const s of segs) {
    const err = validateName(s, "folder");
    if (err) return `folder "${s}": ${err}`;
  }
  return null;
}

export async function planFromFiles(files: File[]): Promise<ImportPlan> {
  const plan: ImportPlan = { dirs: [], files: [], skipped: [] };

  for (const f of files) {
    const lower = f.name.toLowerCase();

    if (lower.endsWith(".zip")) {
      if (f.size > MAX_UPLOAD_BYTES) {
        plan.skipped.push({ name: f.name, reason: "zip is larger than 10 MB" });
        continue;
      }
      let nonJava = 0;
      let unpacked = 0;
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(new Uint8Array(await f.arrayBuffer()), {
          filter: (e) => {
            const segs = e.name.split("/").filter((s) => s !== "" && s !== ".");
            if (segs.length === 0 || isHidden(segs)) return false;
            if (e.name.endsWith("/")) return true;
            if (!/\.java$/i.test(e.name)) {
              nonJava += 1;
              return false;
            }
            if (e.originalSize > MAX_ENTRY_BYTES) {
              plan.skipped.push({ name: `${f.name}:${e.name}`, reason: `larger than ${MAX_FILE_CHARS.toLocaleString()} characters` });
              return false;
            }
            unpacked += e.originalSize;
            if (unpacked > MAX_UNPACKED_BYTES) {
              plan.skipped.push({ name: `${f.name}:${e.name}`, reason: "zip contents are too large" });
              return false;
            }
            return true;
          },
        });
      } catch {
        plan.skipped.push({ name: f.name, reason: "couldn't read this zip file" });
        continue;
      }
      if (nonJava > 0) plan.skipped.push({ name: `${nonJava} other file(s) in ${f.name}`, reason: "not .java files" });

      for (const [path, bytes] of Object.entries(entries)) {
        const segs = path.split("/").filter((s) => s !== "" && s !== ".");
        if (path.endsWith("/")) {
          const err = dirError(segs);
          if (err) plan.skipped.push({ name: `${f.name}:${segs.join("/")}`, reason: err });
          else plan.dirs.push(segs);
          continue;
        }
        const dir = segs.slice(0, -1);
        const name = segs[segs.length - 1];
        const label = `${f.name}:${segs.join("/")}`;
        const err = dirError(dir) || validateName(name, "file");
        if (err) {
          plan.skipped.push({ name: label, reason: err });
          continue;
        }
        const text = decodeText(bytes);
        if (text === null) plan.skipped.push({ name: label, reason: "not valid UTF-8 text" });
        else if (text.length > MAX_FILE_CHARS) plan.skipped.push({ name: label, reason: `larger than ${MAX_FILE_CHARS.toLocaleString()} characters` });
        else plan.files.push({ dir, name, content: text });
      }
      continue;
    }

    if (lower.endsWith(".java")) {
      const err = validateName(f.name, "file");
      if (err) {
        plan.skipped.push({ name: f.name, reason: err });
        continue;
      }
      if (f.size > MAX_ENTRY_BYTES) {
        plan.skipped.push({ name: f.name, reason: `larger than ${MAX_FILE_CHARS.toLocaleString()} characters` });
        continue;
      }
      const text = decodeText(new Uint8Array(await f.arrayBuffer()));
      if (text === null) plan.skipped.push({ name: f.name, reason: "not valid UTF-8 text" });
      else if (text.length > MAX_FILE_CHARS) plan.skipped.push({ name: f.name, reason: `larger than ${MAX_FILE_CHARS.toLocaleString()} characters` });
      else plan.files.push({ dir: [], name: f.name, content: text });
      continue;
    }

    plan.skipped.push({ name: f.name, reason: "only .java and .zip files can be imported" });
  }

  if (plan.files.length > MAX_IMPORT_FILES) {
    const extra = plan.files.length - MAX_IMPORT_FILES;
    plan.files = plan.files.slice(0, MAX_IMPORT_FILES);
    plan.skipped.push({ name: `${extra} more file(s)`, reason: `import limit is ${MAX_IMPORT_FILES} files at a time` });
  }
  return plan;
}

// ---- fitting the plan into the existing tree --------------------------------

type DirResult = { id: string } | { error: string };

export function resolvePlan(
  plan: ImportPlan,
  ctx: {
    baseId: string;
    nodeMap: Map<string, FsNode>;
    kids: Map<string | null, FsNode[]>;
    newId: () => string;
  }
): ResolvedImport {
  const { baseId, nodeMap, kids, newId } = ctx;
  const folders: NewFolder[] = [];
  const files: NewFile[] = [];
  const skipped: Skipped[] = [...plan.skipped];
  const baseDepth = depthOf(nodeMap, baseId);

  // folder path (lower-cased) -> existing or newly planned folder
  const cache = new Map<string, DirResult>();
  const newNames = new Map<string, Set<string>>(); // parentId -> lower-cased names we add

  function ensureDir(segs: string[]): DirResult {
    let key = "";
    let parent = baseId;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      key += "\u0000" + seg.toLowerCase();
      const hit = cache.get(key);
      if (hit) {
        if ("error" in hit) return hit;
        parent = hit.id;
        continue;
      }
      let result: DirResult;
      if (baseDepth + i + 1 > MAX_DEPTH) {
        result = { error: "folders would be nested too deeply" };
      } else {
        const existing = (kids.get(parent) ?? []).find((n) => n.name.toLowerCase() === seg.toLowerCase());
        if (existing && existing.type === "folder") result = { id: existing.id };
        else if (existing) result = { error: `"${seg}" already exists as a file` };
        else {
          const id = newId();
          folders.push({ id, parentId: parent, name: seg });
          result = { id };
        }
      }
      cache.set(key, result);
      if ("error" in result) return result;
      parent = result.id;
    }
    return { id: parent };
  }

  for (const dir of plan.dirs) {
    const r = ensureDir(dir);
    if ("error" in r) skipped.push({ name: dir.join("/"), reason: r.error });
  }

  for (const f of plan.files) {
    const label = [...f.dir, f.name].join("/");
    const r = ensureDir(f.dir);
    if ("error" in r) {
      skipped.push({ name: label, reason: r.error });
      continue;
    }
    const lower = f.name.toLowerCase();
    const taken = (kids.get(r.id) ?? []).some((n) => n.name.toLowerCase() === lower) || newNames.get(r.id)?.has(lower);
    if (taken) {
      skipped.push({ name: label, reason: "a file or folder with that name already exists" });
      continue;
    }
    if (!newNames.has(r.id)) newNames.set(r.id, new Set());
    newNames.get(r.id)!.add(lower);
    files.push({ id: newId(), parentId: r.id, name: f.name, content: f.content });
  }

  return { folders, files, skipped };
}

// ---- export ----------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function textBlob(text: string): Blob {
  return new Blob([text], { type: "text/x-java-source;charset=utf-8" });
}

// Zips `folder` (and everything under it). Entries live under "<folder name>/".
export async function exportFolderZip(
  folder: FsNode,
  kids: Map<string | null, FsNode[]>,
  getText: (id: string) => Promise<string>
): Promise<{ blob: Blob; fileCount: number }> {
  const zippable: Zippable = {};
  const fileNodes: Array<{ id: string; path: string }> = [];

  const walk = (node: FsNode, prefix: string) => {
    const path = `${prefix}${node.name}/`;
    zippable[path] = new Uint8Array(0); // keeps empty folders
    for (const k of kids.get(node.id) ?? []) {
      if (k.type === "folder") walk(k, path);
      else fileNodes.push({ id: k.id, path: path + k.name });
    }
  };
  walk(folder, "");

  // A few reads at a time: fast, but not hundreds of parallel requests.
  let next = 0;
  const worker = async () => {
    while (next < fileNodes.length) {
      const item = fileNodes[next++];
      zippable[item.path] = strToU8(await getText(item.id));
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, fileNodes.length) }, worker));

  const zipped = zipSync(zippable, { level: 6 });
  return { blob: new Blob([zipped as unknown as BlobPart], { type: "application/zip" }), fileCount: fileNodes.length };
}

export function formatSkipped(skipped: Skipped[], limit = 8): string[] {
  const lines = skipped.slice(0, limit).map((s) => `${s.name} — ${s.reason}`);
  if (skipped.length > limit) lines.push(`…and ${skipped.length - limit} more`);
  return lines;
}
