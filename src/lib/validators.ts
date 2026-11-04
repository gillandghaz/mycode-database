// Client-side validation for instant feedback. Treat it as untrusted:
// Firebase Auth and Firestore rules are the real enforcement.

export interface Validation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): Validation {
  const errors: string[] = [];
  if (!password || password.length < 8) errors.push("At least 8 characters.");
  if (!/[A-Z]/.test(password || "")) errors.push("Must contain an uppercase letter (A-Z).");
  if (!/[a-z]/.test(password || "")) errors.push("Must contain a lowercase letter (a-z).");
  return { valid: errors.length === 0, errors };
}

export function validateUsername(username: string): Validation {
  const errors: string[] = [];
  const u = (username || "").trim();
  if (u.length < 3 || u.length > 20) errors.push("Username must be 3–20 characters.");
  if (!/^[a-zA-Z0-9_]+$/.test(u)) errors.push("Only letters, numbers and underscore (_) are allowed.");
  return { valid: errors.length === 0, errors };
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}
