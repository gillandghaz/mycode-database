// SERVER ONLY. One place for: token verification, admin checks, safe JSON
// parsing and uniform error responses, so no route can forget a check.

import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

interface RequireUserOptions {
  checkRevoked?: boolean;
  requireProfile?: boolean;
}

// checkRevoked: disabled accounts / revoked tokens are rejected immediately
// instead of waiting for the token to expire (up to 1 hour).
// requireProfile: a Firebase Auth account without a users/{uid} profile is
// refused everywhere (Auth lets anyone create empty accounts via its public API).
export async function requireUser(
  request: Request,
  { checkRevoked = true, requireProfile = true }: RequireUserOptions = {}
): Promise<DecodedIdToken> {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, "Missing token.", "no-token");

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth().verifyIdToken(token, checkRevoked);
  } catch (err) {
    const e = err as { message?: string; code?: string };
    if (e?.message?.includes("not configured")) throw err;
    if (e?.code === "auth/user-disabled" || e?.code === "auth/id-token-revoked") {
      throw new HttpError(401, "Account disabled or session revoked.", "session-revoked");
    }
    throw new HttpError(401, "Invalid session. Please sign in again.", "invalid-session");
  }

  if (requireProfile) {
    const snap = await adminDb().collection("users").doc(decoded.uid).get();
    if (!snap.exists) throw new HttpError(403, "Account is not registered.", "no-profile");
  }
  return decoded;
}

// Admin status is always re-read from Firestore on the server; never trust
// claims coming from the browser.
export async function requireAdmin(request: Request): Promise<{ decoded: DecodedIdToken; safeMode: boolean }> {
  const decoded = await requireUser(request, { checkRevoked: true, requireProfile: false });
  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  const data = snap.data();
  if (!snap.exists || data?.role !== "admin") throw new HttpError(403, "Admins only.", "not-admin");
  // Safe mode is ON unless explicitly set to false.
  return { decoded, safeMode: data?.adminSafeMode !== false };
}

// Whether new accounts may be created. Read on the server (Admin SDK), never
// from a browser claim. Open by default when never set.
export async function isRegistrationOpenServer(): Promise<boolean> {
  const snap = await adminDb().collection("settings").doc("app").get();
  return !snap.exists || snap.data()?.registrationOpen !== false;
}

// "Who may run code". settings/run.allowAll === false means only users with
// runAllowed === true may run. Open by default when never set, so existing
// installs keep working. Read on the server, never trusted from the browser.
export async function canUserRun(uid: string): Promise<boolean> {
  const db = adminDb();
  const [runSnap, userSnap] = await Promise.all([db.collection("settings").doc("run").get(), db.collection("users").doc(uid).get()]);
  if (!runSnap.exists || runSnap.data()?.allowAll !== false) return true;
  return userSnap.data()?.runAllowed === true;
}

// JSON body with a size cap (default 64 KB).
export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "Request too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large.");
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}

export function errorResponse(err: unknown, label = "api") {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error(`${label} error:`, err);
  const e = err as { message?: string; code?: unknown };
  const message = e?.message?.includes("not configured") ? e.message : "Server error.";
  const code = typeof e?.code === "string" || typeof e?.code === "number" ? String(e.code).slice(0, 60) : undefined;
  return NextResponse.json({ error: message, code }, { status: 500 });
}

// Firestore auto-IDs are 20 alphanumeric chars. Validate strictly whenever a
// client-supplied id is used in a path.
export const DOC_ID_RE = /^[A-Za-z0-9]{1,40}$/;
