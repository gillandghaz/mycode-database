// OPTIONAL provider for a self-hosted Piston server (https://github.com/engineer-man/piston).
// NOT enabled by default and NOT tested against a live server: written from
// Piston's documented POST /api/v2/execute contract (language, version, files, stdin).
// The public emkc.org instance now requires an authorisation token, so a
// self-hosted instance is the realistic option.

import type { CodeRunner, RunRequest, RunResult } from "./types";

interface PistonStage {
  stdout?: string;
  stderr?: string;
  code?: number | null;
}

interface PistonResponse {
  compile?: PistonStage;
  run?: PistonStage;
  message?: string;
}

export class PistonRunner implements CodeRunner {
  readonly name = "piston";
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey || undefined;
  }

  async run(req: RunRequest, signal?: AbortSignal): Promise<RunResult> {
    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/api/v2/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: this.apiKey } : {}),
      },
      body: JSON.stringify({
        language: req.language,
        version: "*",
        files: [{ name: req.fileName, content: req.code }],
        stdin: req.stdin,
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
      signal,
    });

    const data = (await res.json().catch(() => ({}))) as PistonResponse;
    if (!res.ok) throw new Error(data.message || `Runner responded with HTTP ${res.status}`);

    const compile = data.compile;
    if (compile && compile.code !== 0 && compile.code != null) {
      return {
        phase: "compile",
        stdout: compile.stdout ?? "",
        stderr: compile.stderr ?? "",
        exitCode: compile.code ?? null,
        durationMs: Date.now() - started,
      };
    }
    return {
      phase: "run",
      stdout: data.run?.stdout ?? "",
      stderr: data.run?.stderr ?? "",
      exitCode: data.run?.code ?? null,
      durationMs: Date.now() - started,
    };
  }
}
