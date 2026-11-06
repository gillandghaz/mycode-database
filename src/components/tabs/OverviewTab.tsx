"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { subscribeNodes } from "@/lib/fs";
import { formatBytes, type FsNode } from "@/lib/tree";

export default function OverviewTab() {
  const { user, profile } = useAuth();
  const [nodes, setNodes] = useState<FsNode[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    return subscribeNodes(user.uid, setNodes, () => setError("Couldn't load your workspace."));
  }, [user]);

  const files = nodes?.filter((n) => n.type === "file") ?? [];
  const folders = nodes?.filter((n) => n.type === "folder") ?? [];
  const bytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
  const recent = [...files].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 5);

  return (
    <div>
      <h2 className="tab-title">Welcome, {profile?.displayName}</h2>
      {error && <p className="error-text">{error}</p>}

      <div className="stat-grid">
        <div className="stat"><b>{nodes ? folders.length : "–"}</b><span>Folders</span></div>
        <div className="stat"><b>{nodes ? files.length : "–"}</b><span>Files</span></div>
        <div className="stat"><b>{nodes ? formatBytes(bytes) : "–"}</b><span>Code stored</span></div>
      </div>

      <div className="card">
        <h3>Recently edited</h3>
        <p className="desc">Your five most recently saved files.</p>
        {nodes && recent.length === 0 && <p className="hint-text">Nothing here yet. Open the editor and create your first file.</p>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {recent.map((f) => (
            <li key={f.id} className="switch-row" style={{ padding: "9px 0" }}>
              <span className="trunc" title={f.name} style={{ fontFamily: "var(--font-mono)", fontSize: 13.5 }}>{f.name}</span>
              <span className="hint-text nowrap">{f.updatedAt ? new Date(f.updatedAt).toLocaleString() : ""}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/app" className="btn btn--primary">Open editor</Link>
    </div>
  );
}
