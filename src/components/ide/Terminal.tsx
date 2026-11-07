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
  queued: number; // lines typed while a run was going; they are sent when it finishes
  onSubmitInput: (line: string) => void;
  onCancelInput: () => void;
}

// Terminal-style panel: "Output" (stdout, stderr, exit code) and "Input"
// (text fed to the program's standard input, like Programiz's input box).
export default function Terminal({ lines, stdin, running, tab, onTab, onStdin, onClear, awaiting, queued, onSubmitInput, onCancelInput }: Props) {
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
        {queued > 0 && <span className="hint-text" style={{ marginRight: 8 }}>{queued} queued</span>}
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
            // A real <form>: Enter, the keyboard's Send/Go key and the button all
            // submit the same way. Listening for the Enter keydown alone is not
            // enough: Android keyboards often report it as "Unidentified" (229).
            <form
              className="term__form"
              onSubmit={(e) => {
                e.preventDefault();
                const line = inputRef.current?.value ?? draft; // read the field itself, not possibly stale state
                setDraft("");
                onSubmitInput(line);
              }}
            >
              <input
                ref={inputRef}
                className="term__input"
                name="program-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setDraft("");
                    onCancelInput();
                  }
                }}
                maxLength={500}
                aria-label="Program input: type a line and press Enter (Esc to stop)"
                aria-busy={running}
                enterKeyHint="send"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" className="term__send" aria-label="Send input" title="Send (Enter)">↵</button>
              <button type="button" className="term__stop" onClick={onCancelInput} aria-label="Stop waiting for input" title="Stop (Esc)">✕</button>
            </form>
          )}
        </pre>
      ) : (
        <textarea value={stdin} onChange={(e) => onStdin(e.target.value)} placeholder="Type the input your program reads (one value per line), then press Run." spellCheck={false} aria-label="Program input (stdin)" maxLength={10000} />
      )}
    </section>
  );
}
