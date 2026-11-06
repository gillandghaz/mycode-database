import type { Metadata } from "next";
import Link from "next/link";
import Logo, { BrandWord } from "@/components/Logo";
import AuthRedirect from "@/components/landing/AuthRedirect";
import Nav from "@/components/landing/Nav";
import EditorMock from "@/components/landing/EditorMock";
import "./landing.css";

const DESC = "Keep every program you write in one tidy place: folders, a code editor, a built-in Java compiler, and easy import and export.";

export const metadata: Metadata = {
  title: "mycode-database — your code, organised",
  description: DESC,
  openGraph: { title: "mycode-database — your code, organised", description: DESC, type: "website", locale: "en_US" },
};

const FEATURES: [string, string][] = [
  ["Folders that make sense", "Create, name and nest folders like in a desktop IDE. Rename anything, any time."],
  ["Move things easily", "Drag a file into a folder, or use “Move to…” on a phone."],
  ["A real code editor", "Syntax highlighting, line numbers and autosave, right in your browser. Ctrl+S saves instantly."],
  ["Run Java online", "Press Run (or Ctrl+Enter) to compile and run the open file together with the classes it uses from other files. Output and errors appear in a terminal-style panel."],
  ["Keyboard input", "Programs that read with Scanner get their input from the Input tab next to the output."],
  ["Starter examples", "Empty class, Hello World, variables, loops, Scanner input — pick a template when you create a file."],
  ["Import & export", "Upload .java files or a whole .zip into any folder, and download a folder as .zip or a single file."],
  ["Your editor, your way", "Choose the font size, turn word wrap on, or reduce motion in Settings."],
  ["Your own account", "Sign in with email or Google. Your folders and files live in your account, ready on any device."],
];

const STEPS: [string, string][] = [
  ["Create an account", "Email or Google. Choose a username and you're in."],
  ["Organise your code", "Make folders for each course, week or project, or import files you already have."],
  ["Write and run", "Edit with autosave, press Run, and see the output right below the editor."],
];

const FAQ: [string, string][] = [
  ["Can I run my code?", "Yes. Press Run to compile and run the file you have open and see the output in the panel below. Classes your program uses from other files in the same folder (or its sub-folders) are picked up automatically, so you can practise object-oriented code across files. Programs that run for too long are stopped."],
  ["Which languages are supported?", "Java at the moment. The runner is built so more languages can be added later."],
  ["Can I bring my files in and take them out?", "Yes. Use the three-dot menu on a folder to import .java files or a .zip, or to export the folder as a .zip. Single files can be downloaded from their own menu."],
  ["Are there any limits?", "A file can hold up to 200,000 characters, and one import accepts up to 300 files. Names should use letters, digits and underscores, like Main.java."],
  ["Who can see my code?", "Your code is stored in your own account, and you sign in to open it. Other users can't browse your folders."],
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
              <p className="lp-lead">Keep every program in tidy folders, edit it in the browser, and compile and run it without installing anything.</p>
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
