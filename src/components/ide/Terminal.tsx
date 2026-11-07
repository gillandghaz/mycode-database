"use client";

import { useEffect, useRef, useState } from "react";

export interface TermLine {
  kind: "cmd" | "out" | "err" | "dim" | "good" | "stdin";
  text: string;
  // true: don't start a new line after this text (a prompt the user answers right after it)
  inline?: boolean;
}

interface Props {
  lines: TermLine[];
  stdin: string;
  running: boolean;
  tab: "output" | "input";
  onTab: (t: "output" | "input") => void;
  onStdin: (v: string) => void;
  onClear: () => void;
  // the program is waiting for a line of input (see lib/interactive-input.ts)
  awaiting: boolean;
  onSubmitInput: (line: string) => void;
  onCancelInput: () => void;
}

// Terminal-style panel: "Output" (stdout, stderr, exit code) and "Input"
// (text fed to the program's standard input, like Programiz's input box).
export default function Terminal({ lines, stdin, running, tab, onTab, onStdin, onClear, awaiting, onSubmitInput, onCancelInput }: Props) {
  const bodyRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, tab, awaiting]);

  // Keep the cursor in the input line so typing never needs another tap.
  useEffect(() => {
    if (awaiting && tab === "output") inputRef.current?.focus({ preventScroll: true });
  }, [awaiting, tab, lines.length]);

  return (
    <section className="term" aria-label="Terminal">
      <div className="term__head">
        <button className={"term__tab" + (tab === "output" ? " is-active" : "")} onClick={() => onTab("output")}>Output</button>
        <button className={"term__tab" + (tab === "input" ? " is-active" : "")} onClick={() => onTab("input")}>Input</button>
        <span className="grow" />
        {running && <span className="hint-text" style={{ marginRight: 8 }}>running…</span>}
        {awaiting && !running && <span className="hint-text" style={{ marginRight: 8 }}>waiting for input…</span>}
        <button className="btn btn--ghost btn--sm" onClick={onClear} disabled={lines.length === 0 && !awaiting}>Clear</button>
      </div>
      {tab === "output" ? (
        <pre className="term__body" ref={bodyRef} aria-live="polite">
          {lines.length === 0 ? (
            <span className="dim">{"// Program output and compiler errors will appear here.\n// Press Run (or Ctrl+Enter) to start."}</span>
          ) : (
            lines.map((l, i) => (
              <span key={i} className={l.kind === "out" ? undefined : l.kind}>
                {l.text}
                {l.inline || l.text.endsWith("\n") ? "" : "\n"}
              </span>
            ))
          )}
          {awaiting && (
            <input
              ref={inputRef}
              className="term__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              // readOnly (not disabled) while the next run is going, so the keyboard stays open
              readOnly={running}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (running) return;
                  const line = draft;
                  setDraft("");
                  onSubmitInput(line);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setDraft("");
                  onCancelInput();
                }
              }}
              maxLength={500}
              aria-label="Program input: type a line and press Enter (Esc to stop)"
              enterKeyHint="send"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
        </pre>
      ) : (
        <textarea value={stdin} onChange={(e) => onStdin(e.target.value)} placeholder="Type the input your program reads (one value per line), then press Run." spellCheck={false} aria-label="Program input (stdin)" maxLength={10000} />
      )}
    </section>
  );
}
