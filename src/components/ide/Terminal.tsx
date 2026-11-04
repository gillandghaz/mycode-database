"use client";

import { useEffect, useRef } from "react";

export interface TermLine {
  kind: "cmd" | "out" | "err" | "dim" | "good";
  text: string;
}

interface Props {
  lines: TermLine[];
  stdin: string;
  running: boolean;
  tab: "output" | "input";
  onTab: (t: "output" | "input") => void;
  onStdin: (v: string) => void;
  onClear: () => void;
}

// Terminal-style panel: "Output" (stdout, stderr, exit code) and "Input"
// (text fed to the program's standard input, like Programiz's input box).
export default function Terminal({ lines, stdin, running, tab, onTab, onStdin, onClear }: Props) {
  const bodyRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, tab]);

  return (
    <section className="term" aria-label="Terminal">
      <div className="term__head">
        <button className={"term__tab" + (tab === "output" ? " is-active" : "")} onClick={() => onTab("output")}>Output</button>
        <button className={"term__tab" + (tab === "input" ? " is-active" : "")} onClick={() => onTab("input")}>Input</button>
        <span className="grow" />
        {running && <span className="hint-text" style={{ marginRight: 8 }}>running…</span>}
        <button className="btn btn--ghost btn--sm" onClick={onClear} disabled={lines.length === 0}>Clear</button>
      </div>
      {tab === "output" ? (
        <pre className="term__body" ref={bodyRef} aria-live="polite">
          {lines.length === 0 ? (
            <span className="dim">{"// Program output and compiler errors will appear here.\n// Press Run (or Ctrl+Enter) to start."}</span>
          ) : (
            lines.map((l, i) => (
              <span key={i} className={l.kind === "out" ? undefined : l.kind}>
                {l.text}
                {l.text.endsWith("\n") ? "" : "\n"}
              </span>
            ))
          )}
        </pre>
      ) : (
        <textarea value={stdin} onChange={(e) => onStdin(e.target.value)} placeholder="Type the input your program reads (one value per line), then press Run." spellCheck={false} aria-label="Program input (stdin)" maxLength={10000} />
      )}
    </section>
  );
}
