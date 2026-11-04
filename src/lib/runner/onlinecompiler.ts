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
// Override without a code change via ONLINECOMPILER_JAVA_COMPILER (Vercel env
// var) if the id below is ever renamed or retired by the provider.
const COMPILERS: Record<Language, string> = {
  java: (process.env.ONLINECOMPILER_JAVA_COMPILER || "").trim() || "openjdk-25",
};

// Upstream error bodies can be a string, or an object such as
// { compiler: ["Invalid compiler"] }. Turn either into readable text.
function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value).slice(0, 300);
  } catch {
    return "";
  }
}

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
      headers: { "Content-Type": "application/json", Authorization: this.apiKey.trim() },
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
      // Shows up in Vercel > Logs, so a failure is diagnosable. Never log the key.
      console.error(`onlinecompiler HTTP ${res.status} (compiler=${COMPILERS[req.language]}):`, JSON.stringify(data).slice(0, 500));
      if (res.status === 401 || res.status === 403) throw new RunnerError(502, "The compiler service rejected the API key. Check ONLINECOMPILER_API_KEY.");
      if (res.status === 429) throw new RunnerError(429, "The compiler is busy or the monthly limit was reached. Try again shortly.");
      const detail = describe(data.message) || describe(data.detail) || describe(data.error);
      throw new RunnerError(502, detail ? `Compiler service error (HTTP ${res.status}): ${detail}` : `Compiler service error (HTTP ${res.status}).`);
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
