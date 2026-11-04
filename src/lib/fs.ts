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
