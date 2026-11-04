// Firestore-backed workspace: folders + files per user.
//
//   nodes/{id}          metadata: ownerUid, parentId, type, name, size, ...
//   fileContents/{id}   { ownerUid, content }   (split out so the tree query
//                       stays small: the file list never downloads code)
//
// Security Rules (firestore.rules) are the real gate. Everything here also runs
// for an admin who is viewing someone else's workspace; in that case the rules
// reject the write unless the admin's Safe Mode is off.

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  type WriteBatch,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { childrenMap, descendantIds, MAX_FILE_CHARS, type FsNode, type NodeType } from "./tree";

const NODES = "nodes";
const CONTENTS = "fileContents";
const BATCH_LIMIT = 400; // Firestore max is 500 writes per batch
const IMPORT_BATCH = 100; // imports use smaller batches (each file = 2 writes)

function toMs(v: unknown): number | undefined {
  return v instanceof Timestamp ? v.toMillis() : undefined;
}

function toNode(id: string, d: DocumentData): FsNode {
  return {
    id,
    ownerUid: d.ownerUid,
    parentId: d.parentId ?? null,
    type: d.type,
    name: d.name,
    language: d.language,
    size: d.size,
    createdAt: toMs(d.createdAt),
    updatedAt: toMs(d.updatedAt),
  };
}

// NOTE: the owner filter is mandatory, not cosmetic: security rules are not
// filters, so a query without where("ownerUid","==",...) would be rejected.
export function subscribeNodes(
  ownerUid: string,
  onData: (nodes: FsNode[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, NODES), where("ownerUid", "==", ownerUid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toNode(d.id, d.data()))),
    (err) => onError(err)
  );
}

export async function createNode(args: {
  ownerUid: string;
  parentId: string | null;
  type: NodeType;
  name: string;
  content?: string;
}): Promise<string> {
  const ref = doc(collection(db, NODES));
  const batch = writeBatch(db);
  const isFile = args.type === "file";
  const content = isFile ? (args.content ?? "") : "";
  if (content.length > MAX_FILE_CHARS) throw new Error("file-too-large");

  const data: Record<string, unknown> = {
    ownerUid: args.ownerUid,
    parentId: args.parentId,
    type: args.type,
    name: args.name.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (isFile) {
    data.language = "java";
    data.size = new Blob([content]).size;
  }
  batch.set(ref, data);
  if (isFile) {
    batch.set(doc(db, CONTENTS, ref.id), { ownerUid: args.ownerUid, content, updatedAt: serverTimestamp() });
  }
  await batch.commit();
  return ref.id;
}

export async function renameNode(id: string, name: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, NODES, id), { name: name.trim(), updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function moveNode(id: string, newParentId: string | null): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, NODES, id), { parentId: newParentId, updatedAt: serverTimestamp() });
  await batch.commit();
}

// Deletes a node and everything below it (and file contents), in chunks.
export async function deleteNodeTree(allNodes: FsNode[], id: string): Promise<void> {
  const kids = childrenMap(allNodes);
  const ids = descendantIds(kids, id);
  const byIdMap = new Map(allNodes.map((n) => [n.id, n]));
  const ops: Array<{ coll: string; id: string }> = [];
  for (const nid of ids) {
    ops.push({ coll: NODES, id: nid });
    if (byIdMap.get(nid)?.type === "file") ops.push({ coll: CONTENTS, id: nid });
  }
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_LIMIT)) batch.delete(doc(db, op.coll, op.id));
    await batch.commit();
  }
}

export async function loadContent(id: string): Promise<string> {
  const snap = await getDoc(doc(db, CONTENTS, id));
  return snap.exists() ? String(snap.data().content ?? "") : "";
}

export async function saveContent(id: string, ownerUid: string, content: string): Promise<void> {
  if (content.length > MAX_FILE_CHARS) throw new Error("file-too-large");
  const batch = writeBatch(db);
  batch.set(doc(db, CONTENTS, id), { ownerUid, content, updatedAt: serverTimestamp() });
  batch.update(doc(db, NODES, id), { size: new Blob([content]).size, updatedAt: serverTimestamp() });
  await batch.commit();
}

// A fresh Firestore id, so an import can wire up parent ids before writing.
export function newNodeId(): string {
  return doc(collection(db, NODES)).id;
}

// Writes many folders/files at once (import). Folders go first; each file's
// metadata and content are written in the same batch. Throws on the first
// failed batch; whatever was committed before that stays.
export async function importNodes(
  ownerUid: string,
  folders: Array<{ id: string; parentId: string | null; name: string }>,
  files: Array<{ id: string; parentId: string | null; name: string; content: string }>
): Promise<void> {
  const enc = new TextEncoder();
  const steps: Array<{ cost: number; write: (b: WriteBatch) => void }> = [];

  // Parents before children (ids were generated top-down, so insertion order already is).
  for (const f of folders) {
    steps.push({
      cost: 1,
      write: (b) =>
        b.set(doc(db, NODES, f.id), {
          ownerUid,
          parentId: f.parentId,
          type: "folder",
          name: f.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
    });
  }
  for (const f of files) {
    if (f.content.length > MAX_FILE_CHARS) throw new Error("file-too-large");
    steps.push({
      cost: 2,
      write: (b) => {
        b.set(doc(db, NODES, f.id), {
          ownerUid,
          parentId: f.parentId,
          type: "file",
          name: f.name,
          language: "java",
          size: enc.encode(f.content).length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        b.set(doc(db, CONTENTS, f.id), { ownerUid, content: f.content, updatedAt: serverTimestamp() });
      },
    });
  }

  let batch = writeBatch(db);
  let used = 0;
  for (const step of steps) {
    if (used + step.cost > IMPORT_BATCH) {
      await batch.commit();
      batch = writeBatch(db);
      used = 0;
    }
    step.write(batch);
    used += step.cost;
  }
  if (used > 0) await batch.commit();
}
