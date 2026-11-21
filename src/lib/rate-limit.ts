// SERVER ONLY. Per-user rate limit for /api/run, stored in Firestore
// (rateLimits/{key}) so it holds across serverless instances. The collection
// is closed to clients by the catch-all rule in firestore.rules.
//
// Every run costs a call to the paid compiler API, and interactive input
// re-runs the program for each typed line, so the limits are generous for a
// person but stop a script from draining the monthly quota.

import { adminDb } from "@/lib/firebase-admin";
import { HttpError } from "@/lib/server-auth";

interface Window {
  ms: number;
  max: number;
}

const RUN_WINDOWS: Record<string, Window> = {
  minute: { ms: 60_000, max: 30 },
  day: { ms: 24 * 60 * 60_000, max: 1000 },
};

export async function enforceRunRateLimit(uid: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection("rateLimits").doc(`run_${uid}`);
  const now = Date.now();

  const blocked = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() ?? {}) as Record<string, { start?: number; count?: number }>;
    const next: Record<string, { start: number; count: number }> = {};

    for (const [name, w] of Object.entries(RUN_WINDOWS)) {
      const cur = data[name];
      const fresh = !cur || typeof cur.start !== "number" || now - cur.start >= w.ms;
      const start = fresh ? now : (cur.start as number);
      const count = fresh ? 0 : Number(cur.count) || 0;
      if (count >= w.max) return { name, retryAfter: Math.ceil((start + w.ms - now) / 1000) };
      next[name] = { start, count: count + 1 };
    }
    tx.set(ref, { ...next, updatedAt: new Date(now) });
    return null;
  });

  if (blocked) {
    const when = blocked.name === "minute" ? "a minute" : "tomorrow";
    throw new HttpError(429, `You're running code too often. Try again in ${when}.`, "rate-limited");
  }
}
