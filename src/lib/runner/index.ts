// SERVER ONLY. Picks the execution backend from environment variables.
//
//   RUNNER_PROVIDER unset            -> no runner: Run shows "not available yet"
//   RUNNER_PROVIDER=onlinecompiler   -> ONLINECOMPILER_API_KEY
//   RUNNER_PROVIDER=piston           -> PISTON_URL (+ optional PISTON_API_KEY)
//
// To add another backend (Judge0, your own Docker service, ...): implement
// CodeRunner in a new file and add a case below. Nothing else changes.

import { OnlineCompilerRunner } from "./onlinecompiler";
import { PistonRunner } from "./piston";
import { RunnerUnavailableError, type CodeRunner } from "./types";

export function getRunner(): CodeRunner {
  const provider = (process.env.RUNNER_PROVIDER || "").trim().toLowerCase();

  if (provider === "onlinecompiler") {
    const key = process.env.ONLINECOMPILER_API_KEY;
    if (!key) throw new RunnerUnavailableError("RUNNER_PROVIDER=onlinecompiler but ONLINECOMPILER_API_KEY is not set.");
    return new OnlineCompilerRunner(key);
  }

  if (provider === "piston") {
    const url = process.env.PISTON_URL;
    if (!url) throw new RunnerUnavailableError("RUNNER_PROVIDER=piston but PISTON_URL is not set.");
    return new PistonRunner(url, process.env.PISTON_API_KEY);
  }

  throw new RunnerUnavailableError();
}
