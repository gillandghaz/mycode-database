import { NextResponse } from "next/server";
import { requireUser, readJson, errorResponse, HttpError } from "@/lib/server-auth";
import { getRunner } from "@/lib/runner";
import { RunnerUnavailableError, type RunRequest } from "@/lib/runner/types";

export const maxDuration = 30;

const MAX_CODE = 200_000;
const MAX_STDIN = 10_000;
const FILE_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}\.java$/;

// Compile + run endpoint. Today no runner is configured, so this answers 503
// "runner-unavailable" and the UI shows the "not available yet" popup. Setting
// RUNNER_PROVIDER (see lib/runner/index.ts) switches it on without UI changes.
export async function POST(request: Request) {
  try {
    await requireUser(request);

    const body = await readJson(request, 256 * 1024);
    const language = body.language;
    const fileName = body.fileName;
    const code = body.code;
    const stdin = typeof body.stdin === "string" ? body.stdin : "";

    if (language !== "java") throw new HttpError(400, "Only Java is supported right now.", "bad-language");
    if (typeof fileName !== "string" || !FILE_RE.test(fileName)) throw new HttpError(400, "Invalid file name.");
    if (typeof code !== "string" || code.length > MAX_CODE) throw new HttpError(400, "Code is missing or too large.");
    if (stdin.length > MAX_STDIN) throw new HttpError(400, "Input is too large.");

    let runner;
    try {
      runner = getRunner();
    } catch (e) {
      if (e instanceof RunnerUnavailableError) throw new HttpError(503, e.message, "runner-unavailable");
      throw e;
    }

    const req: RunRequest = { language, fileName, code, stdin };
    const result = await runner.run(req, AbortSignal.timeout(25_000));
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "run");
  }
}
