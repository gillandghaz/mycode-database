import type { Metadata } from "next";
import Link from "next/link";
import Logo, { BrandWord } from "@/components/Logo";
import AuthRedirect from "@/components/landing/AuthRedirect";
import Nav from "@/components/landing/Nav";
import EditorMock from "@/components/landing/EditorMock";
import "./landing.css";

const DESC = "Keep every program you write in one tidy place: folders, an editor, and a built-in Java compiler for learning (coming soon).";

export const metadata: Metadata = {
  title: "mycode-database — your code, organised",
  description: DESC,
  openGraph: { title: "mycode-database — your code, organised", description: DESC, type: "website", locale: "en_US" },
};

const FEATURES: [string, string][] = [
  ["Folders that make sense", "Create, name and nest folders like in a desktop IDE. Rename anything, any time."],
  ["Move things easily", "Drag a file into a folder, or use “Move to…” on a phone."],
  ["A real code editor", "Syntax highlighting, line numbers and autosave, right in your browser."],
  ["Run & output panel", "Output and errors in a terminal-style panel, plus an input box for programs that read from the keyboard."],
  ["Starter examples", "Hello World, loops, Scanner input — pick a template when you create a file."],
  ["Private by default", "Only you can see your code. Admins view it read-only unless safe mode is deliberately switched off."],
];

const STEPS: [string, string][] = [
  ["Create an account", "Email or Google. Choose a username and you're in."],
  ["Organise your code", "Make folders for each course, week or project and drop your files in."],
  ["Write and run", "Edit with autosave. The Java compiler is coming soon — the panel is already waiting."],
];

const FAQ: [string, string][] = [
  ["Can I run my code today?", "Not yet. The Run button and output panel are in place, but the Java compiler isn't connected, so Run shows a “not available yet” notice."],
  ["Which languages are supported?", "Java first. The runner is built so more languages can be added later."],
  ["Who can see my code?", "You. Administrators can open accounts to help with support, but they are in read-only safe mode by default and can't change your code."],
];

function Cta({ className = "" }: { className?: string }) {
  return (
    <div className={"lp-cta " + className}>
      <Link href="/register" className="btn btn--primary lp-lg">Start for free</Link>
      <Link href="/login" className="btn btn--ghost lp-lg">Sign in</Link>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      {/* Instant redirect for returning users, before React hydrates. */}
      <script dangerouslySetInnerHTML={{ __html: 'try{if(localStorage.getItem("mcd_auth")==="1")location.replace("/app")}catch(e){}' }} />
      <AuthRedirect cover />
      <Nav />
      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero__grid">
            <div>
              <p className="lp-eyebrow">// code storage for learners</p>
              <h1>Your code, <span>organised</span>.</h1>
              <p className="lp-lead">Keep every program in tidy folders, edit it in the browser, and (soon) compile it without installing anything.</p>
              <Cta />
            </div>
            <EditorMock />
          </div>
        </section>

        <section id="features" className="lp-sec">
          <div className="lp-wrap">
            <h2>Features</h2>
            <ul className="lp-feat">
              {FEATURES.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}
            </ul>
          </div>
        </section>

        <section id="how" className="lp-sec lp-sec--alt">
          <div className="lp-wrap">
            <h2>How it works</h2>
            <ol className="lp-steps">
              {STEPS.map(([t, d], i) => <li key={t}><span>{String(i + 1).padStart(2, "0")}</span><h3>{t}</h3><p>{d}</p></li>)}
            </ol>
          </div>
        </section>

        <section id="faq" className="lp-sec">
          <div className="lp-wrap lp-narrow">
            <h2>FAQ</h2>
            <div className="lp-faq">
              {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <h2>Give your code a home.</h2>
            <Cta className="lp-cta--c" />
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot__in">
          <span className="brand"><Logo size={20} /><BrandWord /></span>
          <span>© {new Date().getFullYear()} mycode-database</span>
        </div>
      </footer>
    </div>
  );
}
