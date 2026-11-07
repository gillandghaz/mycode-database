// Typing input while a program "runs".
//
// The compiler service takes all of stdin together with the run and cannot
// wait for more, so a program can't really pause for the keyboard there. We
// get the same experience by replaying: when a program stops only because
// Scanner ran out of input, the terminal shows the output so far plus an input
// line; when you press Enter the program runs again from the start with every
// line typed so far, and only the new output is added. Each typed line costs
// one more run, which is exact for programs that behave the same every time.

export const MAX_INTERACTIVE_INPUTS = 50;

// Java's message when Scanner is asked for input that isn't there. Only Scanner
// can be recognised: BufferedReader just returns null, which shows up as an
// ordinary NullPointerException.
export function needsMoreInput(r: { exitCode: number | null; stderr: string }): boolean {
  if (r.exitCode === 0 || r.exitCode === null) return false;
  return /java\.util\.NoSuchElementException/.test(r.stderr) && /java\.util\.Scanner\./.test(r.stderr);
}

// When we are about to ask for input, the exception itself is not an error to
// show. Anything the program wrote to stderr before it is kept.
export function withoutInputError(stderr: string): string {
  return stderr.replace(/Exception in thread "[^"]*" java\.util\.NoSuchElementException[\s\S]*$/, "").trimEnd();
}

// The Input tab text first, then each typed line, always newline-terminated.
export function composeStdin(base: string, typed: string[]): string {
  const head = base === "" ? "" : base.endsWith("\n") ? base : base + "\n";
  return head + typed.map((l) => l + "\n").join("");
}
