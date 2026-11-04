// A tiny localStorage "hint" lets public pages (landing, /login, /register)
// redirect already-signed-in users to /app instantly, before Firebase has
// restored the session (a few hundred ms). It is a speed hint, NOT security:
// /app is still guarded by RequireAuth, and stale hints are cleared as soon as
// Firebase reports no session.
export const AUTH_HINT_KEY = "mcd_auth";
const NOTICE_KEY = "mcd_notice";

export function setAuthHint(loggedIn: boolean): void {
  try {
    if (loggedIn) localStorage.setItem(AUTH_HINT_KEY, "1");
    else localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function hasAuthHint(): boolean {
  try {
    return localStorage.getItem(AUTH_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

// One-shot message shown on /login after a forced sign-out
// (e.g. "Your account has been disabled.").
export function setAuthNotice(message: string): void {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    /* storage unavailable */
  }
}

export function takeAuthNotice(): string | null {
  try {
    const msg = sessionStorage.getItem(NOTICE_KEY);
    if (msg) sessionStorage.removeItem(NOTICE_KEY);
    return msg;
  } catch {
    return null;
  }
}
