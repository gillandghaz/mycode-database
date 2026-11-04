// Contract between the UI, /api/run and any execution backend.
// Adding a language later = add it to Language + register a provider mapping.

export type Language = "java";

export interface RunRequest {
  language: Language;
  fileName: string; // e.g. "Main.java"
  code: string;
  stdin: string;
}

export interface RunResult {
  // "compile": compilation failed; "run": program ran (check exitCode)
  phase: "compile" | "run";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

export interface CodeRunner {
  readonly name: string;
  run(req: RunRequest, signal?: AbortSignal): Promise<RunResult>;
}

// Thrown when no execution backend is configured. /api/run maps it to a
// 503 with code "runner-unavailable"; the UI shows the "not available yet" popup.
export class RunnerUnavailableError extends Error {
  constructor(message = "Code runner is not available yet.") {
    super(message);
  }
}

// The backend answered, but with an error (bad key, quota, busy, ...).
// /api/run turns it into a readable message for the terminal panel.
export class RunnerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
