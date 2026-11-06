import { NextResponse } from "next/server";
import { requireUser, readJson, errorResponse, canUserRun, HttpError } from "@/lib/server-auth";
import { getRunner } from "@/lib/runner";
import { RunnerError, RunnerUnavailableError, type RunRequest } from "@/lib/runner/types";
import { bundleJava, remapDiagnostics, MAX_BUNDLE_CHARS, MAX_BUNDLE_FILES } from "@/lib/java-bundle";

export const maxDuration = 30;

const MAX_CODE = 200_000;
const MAX_STDIN = 10_000;
const FILE_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}\.java$/;

// Compile + run endpoint. Today no runner is configured, so this answers 503
// "runner-unavailable" and the UI shows the "not available yet" popup. Setting
// RUNNER_PROVIDER (see lib/runner/index.ts) switches it on without UI changes.
export async function POST(request: Request) {
  try {
    const decoded = await requireUser(request);

    // Admin switch "Allow everyone to run code" (+ per-user exceptions).
    if (!(await canUserRun(decoded.uid))) {
      throw new HttpError(403, "Running code is turned off for your account right now.", "run-disabled");
    }

    const body = await readJson(request, 1024 * 1024);
    const language = body.language;
    const fileName = body.fileName;
    const code = body.code;
    const stdin = typeof body.stdin === "string" ? body.stdin : "";

    if (language !== "java") throw new HttpError(400, "Only Java is supported right now.", "bad-language");
    if (typeof fileName !== "string" || !FILE_RE.test(fileName)) throw new HttpError(400, "Invalid file name.");
    if (typeof code !== "string" || code.length > MAX_CODE) throw new HttpError(400, "Code is missing or too large.");
    if (stdin.length > MAX_STDIN) throw new HttpError(400, "Input is too large.");

    // Other files the running file uses (OOP across files). They are merged into
    // one source, running file first, because the compiler service runs a single
    // file. Nothing here is trusted: names, counts and sizes are checked again.
    let finalCode = code;
    let segments: ReturnType<typeof bundleJava>["segments"] | null = null;
    let bundled: string[] = [];
    if (body.files !== undefined) {
      if (!Array.isArray(body.files) || body.files.length > MAX_BUNDLE_FILES) throw new HttpError(400, `You can include up to ${MAX_BUNDLE_FILES} other files.`);
      const extra = body.files.map((f: unknown) => {
        const r = f as { name?: unknown; code?: unknown };
        if (typeof r?.name !== "string" || !FILE_RE.test(r.name)) throw new HttpError(400, "Invalid file name in files.");
        if (typeof r.code !== "string" || r.code.length > MAX_CODE) throw new HttpError(400, `${r.name} is missing or too large.`);
        return { name: r.name, code: r.code };
      });
      if (extra.length > 0) {
        const b = bundleJava({ name: fileName, code }, extra);
        if (b.code.length > MAX_BUNDLE_CHARS) throw new HttpError(400, "The files together are too large to run.");
        finalCode = b.code;
        segments = b.segments;
        bundled = b.included;
      }
    }

    let runner;
    try {
      runner = getRunner();
    } catch (e) {
      if (e instanceof RunnerUnavailableError) throw new HttpError(503, e.message, "runner-unavailable");
      throw e;
    }

    const req: RunRequest = { language, fileName, code: finalCode, stdin };
    try {
      const result = await runner.run(req, AbortSignal.timeout(25_000));
      if (!segments) return NextResponse.json(result);
      // Errors and stack traces name lines of the merged source: point them
      // back at the real files.
      return NextResponse.json({
        ...result,
        // Only stderr: whatever the program prints itself is never rewritten.
        stderr: remapDiagnostics(result.stderr, segments),
        bundled,
      });
    } catch (e) {
      if (e instanceof RunnerError) throw new HttpError(e.status, e.message, "runner-error");
      if ((e as Error)?.name === "TimeoutError") throw new HttpError(504, "The compiler took too long to answer.", "runner-timeout");
      throw new HttpError(502, "Couldn't reach the compiler service.", "runner-error");
    }
  } catch (err) {
    return errorResponse(err, "run");
  }
}
