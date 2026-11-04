// Provider for https://onlinecompiler.io (REST API, synchronous endpoint).
// Contract taken from its docs (onlinecompiler.io/docs/run-code and /docs/compilers):
//   POST https://api.onlinecompiler.io/api/run-code-sync/
//   Authorization: <API key>        (the raw key, no "Bearer")
//   body: { compiler, code, input?, time_limit? }
//   200 : { output, error, status, exit_code, signal, truncated, time, total, memory }
// Java is compiled and run in one step (single-file source mode), so compile
// errors arrive in `error` with a non-zero exit code; there is no separate
// "compile" phase to report.

import { RunnerError, type CodeRunner, type Language, type RunRequest, type RunResult } from "./types";

const ENDPOINT = "https://api.onlinecompiler.io/api/run-code-sync/";

// Compiler ids from GET https://api.onlinecompiler.io/api/compilers/
const COMPILERS: Record<Language, string> = {
  java: "openjdk-25",
};

interface ApiResponse {
  output?: string;
  error?: string;
  status?: string;
  exit_code?: number | null;
  total?: string;
  time?: string;
  message?: string;
  detail?: string;
  [key: string]: unknown;
}

export class OnlineCompilerRunner implements CodeRunner {
  readonly name = "onlinecompiler";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async run(req: RunRequest, signal?: AbortSignal): Promise<RunResult> {
    const started = Date.now();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: this.apiKey },
      body: JSON.stringify({
        compiler: COMPILERS[req.language],
        code: req.code,
        input: req.stdin,
        time_limit: 10, // seconds the program itself may run (compiling is not counted)
      }),
      signal,
    });

    const data = (await res.json().catch(() => ({}))) as ApiResponse;

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new RunnerError(502, "The compiler service rejected the API key.");
      if (res.status === 429) throw new RunnerError(429, "The compiler is busy or the monthly limit was reached. Try again shortly.");
      throw new RunnerError(502, String(data.message || data.detail || data.error || `Compiler service error (HTTP ${res.status}).`));
    }

    const exitCode = typeof data.exit_code === "number" ? data.exit_code : null;
    let stderr = data.error ?? "";
    if (exitCode === 124) stderr += (stderr ? "\n" : "") + "Time limit exceeded.";

    const seconds = parseFloat(data.total ?? data.time ?? "");
    return {
      phase: "run",
      stdout: data.output ?? "",
      stderr,
      exitCode,
      durationMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : Date.now() - started,
    };
  }
}
