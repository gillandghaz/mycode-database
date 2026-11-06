// Multi-file Java (OOP across files).
//
// The compiler service runs ONE file with Java's source launcher
// ("java Main.java"): no separate compile step, and the class may have any
// name. In that mode several top-level classes (even public ones) can live in
// one file, and the launcher runs the first class. So to run a file that uses
// classes from other files we
//   1. find the files it refers to (client side, collectDependencies),
//   2. merge them into one source with the running file FIRST (server side,
//      bundleJava), and
//   3. translate line numbers in compiler errors and stack traces back to the
//      original files (remapDiagnostics).
//
// Pure functions, no Firebase or Node imports: used by both the browser and
// the /api/run route.

export interface SourceFile {
  /** Name only, e.g. "Dog.java". */
  name: string;
  /** Folders from the project root, e.g. ["models"]. */
  dir: string[];
  code: string;
}

export interface Segment {
  file: string; // shown in diagnostics
  start: number; // first merged line (1-based)
  end: number; // last merged line
}

export interface BundleResult {
  code: string;
  segments: Segment[];
  included: string[]; // names of the extra files that were merged in
}

export const MAX_BUNDLE_FILES = 30;
export const MAX_BUNDLE_CHARS = 500_000;

// ---- scanning -----------------------------------------------------------------

// Same length as the input: comments, strings, char literals and text blocks
// become spaces (newlines stay), so a regex can't be fooled by "class X" in a
// string or an import inside a comment, and positions still line up.
export function maskNonCode(src: string): string {
  const out = src.split("");
  const n = src.length;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      let j = i;
      while (j < n && src[j] !== "\n") j++;
      blank(i, j);
      i = j;
    } else if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      const j = end < 0 ? n : end + 2;
      blank(i, j);
      i = j;
    } else if (c === '"' && src.startsWith('"""', i)) {
      let j = i + 3;
      while (j < n && !(src.startsWith('"""', j) && src[j - 1] !== "\\")) j++;
      j = Math.min(n, j + 3);
      blank(i, j);
      i = j;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") {
        if (src[j] === "\\") j++;
        j++;
      }
      j = Math.min(n, j + 1);
      blank(i, j);
      i = j;
    } else {
      i++;
    }
  }
  return out.join("");
}

function depthMap(masked: string): Int32Array {
  const depth = new Int32Array(masked.length + 1);
  let d = 0;
  for (let i = 0; i < masked.length; i++) {
    depth[i] = d;
    if (masked[i] === "{") d++;
    else if (masked[i] === "}") d = Math.max(0, d - 1);
  }
  depth[masked.length] = d;
  return depth;
}

const PACKAGE_RE = /^[ \t]*package\s+([\w.]+)\s*;/m;
const IMPORT_RE = /^[ \t]*import\s+(static\s+)?([\w.]+(?:\.\*)?)\s*;/gm;
const TYPE_RE = /\b(class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/g;
const IDENT_RE = /[A-Za-z_$][\w$]*/g;

interface ImportInfo {
  start: number;
  end: number;
  isStatic: boolean;
  name: string; // "a.b.C", "a.b.*", or for static "a.b.C.member"
}

interface Scan {
  masked: string;
  pkg: string;
  imports: ImportInfo[];
  types: Array<{ name: string; index: number }>;
  depth: Int32Array;
}

function scan(code: string): Scan {
  const masked = maskNonCode(code);
  const depth = depthMap(masked);
  const pkg = PACKAGE_RE.exec(masked)?.[1] ?? "";
  const imports: ImportInfo[] = [];
  for (const m of masked.matchAll(IMPORT_RE)) {
    imports.push({ start: m.index!, end: m.index! + m[0].length, isStatic: !!m[1], name: m[2] });
  }
  const types: Array<{ name: string; index: number }> = [];
  for (const m of masked.matchAll(TYPE_RE)) {
    if (depth[m.index!] === 0) types.push({ name: m[2], index: m.index! });
  }
  return { masked, pkg, imports, types, depth };
}

export function identifiersOf(code: string): Set<string> {
  return new Set(maskNonCode(code).match(IDENT_RE) ?? []);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- bundling -------------------------------------------------------------------

export function bundleJava(entry: { name: string; code: string }, others: Array<{ name: string; code: string }>): BundleResult {
  const files = [entry, ...others];
  const scans = files.map((f) => scan(f.code));

  // Packages the project itself defines, and which package each class is in.
  const projectPkgs = new Set<string>();
  const typePkg = new Map<string, string>();
  scans.forEach((s) => {
    if (s.pkg) projectPkgs.add(s.pkg);
    s.types.forEach((t) => {
      if (!typePkg.has(t.name)) typePkg.set(t.name, s.pkg);
    });
  });

  const headerImports: string[] = [];
  const seenImports = new Set<string>();
  const bodies: string[] = [];

  files.forEach((f, idx) => {
    const s = scans[idx];
    const edits: Array<{ start: number; end: number; text: string }> = [];
    const blank = (start: number, end: number) => edits.push({ start, end, text: f.code.slice(start, end).replace(/[^\r\n]/g, " ") });

    // "package x;" is meaningless once everything is in one file.
    const pm = PACKAGE_RE.exec(s.masked);
    if (pm) blank(pm.index, pm.index + pm[0].length);

    // Imports must come first in a file: collect them into a shared header,
    // dropping the ones that point at the project's own packages.
    for (const imp of s.imports) {
      blank(imp.start, imp.end);
      const parts = imp.name.split(".");
      let internal: boolean;
      if (imp.isStatic) {
        // a.b.C.member -> the class is a.b.C, the package a.b
        internal = projectPkgs.has(parts.slice(0, -2).join("."));
      } else if (parts[parts.length - 1] === "*") {
        internal = projectPkgs.has(parts.slice(0, -1).join("."));
      } else {
        internal = projectPkgs.has(parts.slice(0, -1).join(".")) && typePkg.get(parts[parts.length - 1]) === parts.slice(0, -1).join(".");
      }
      if (internal) continue;
      const line = `import ${imp.isStatic ? "static " : ""}${imp.name};`;
      if (!seenImports.has(line)) {
        seenImports.add(line);
        headerImports.push(line);
      }
    }

    // "public" on a top-level type is dropped: harmless in one package, and
    // it can't trip a file-name check on any launcher.
    const publicRe = /\bpublic\s+(?=(?:(?:abstract|final|sealed|non-sealed|strictfp)\s+)*(?:@interface|class|interface|enum|record)\b)/g;
    for (const m of s.masked.matchAll(publicRe)) {
      if (s.depth[m.index!] === 0) blank(m.index!, m.index! + "public".length);
    }

    // "models.Dog" -> "Dog" wherever the code uses a project class by its full name.
    for (const [name, pkg] of typePkg) {
      if (!pkg) continue;
      const re = new RegExp(`(?<![\\w$.])${esc(pkg)}\\.${esc(name)}(?![\\w$])`, "g");
      for (const m of s.masked.matchAll(re)) {
        const inImport = s.imports.some((i) => m.index! >= i.start && m.index! < i.end);
        if (!inImport) edits.push({ start: m.index!, end: m.index! + m[0].length, text: name + " ".repeat(m[0].length - name.length) });
      }
    }

    // Apply from the end so earlier offsets stay valid; same lengths keep columns.
    let code = f.code;
    edits.sort((a, b) => b.start - a.start);
    let lastStart = Infinity;
    for (const e of edits) {
      if (e.end > lastStart) continue; // overlapping edit: skip
      code = code.slice(0, e.start) + e.text + code.slice(e.end);
      lastStart = e.start;
    }
    bodies.push(code.endsWith("\n") ? code : code + "\n");
  });

  const header = headerImports.length ? headerImports.join("\n") + "\n\n" : "";
  let line = header ? headerImports.length + 2 : 1;
  const segments: Segment[] = [];
  const parts: string[] = [];
  bodies.forEach((body, idx) => {
    const count = body.split("\n").length - 1;
    segments.push({ file: files[idx].name, start: line, end: line + count - 1 });
    parts.push(body);
    line += count + 1; // + the blank separator line below
  });

  return {
    code: header + parts.join("\n"),
    segments,
    included: others.map((o) => o.name),
  };
}

// Compiler errors and stack traces name the merged file ("Main.java:42"). Turn
// each into the original file and line ("Dog.java:7").
export function remapDiagnostics(text: string, segments: Segment[]): string {
  if (!text || segments.length < 2) return text;
  return text.replace(/\b([A-Za-z0-9_$]+\.java):(\d+)\b/g, (whole, _file: string, num: string) => {
    const n = Number(num);
    const seg = segments.find((s) => n >= s.start && n <= s.end);
    return seg ? `${seg.file}:${n - seg.start + 1}` : whole;
  });
}

// ---- finding the files a program needs ---------------------------------------------

export interface Candidate {
  id: string;
  name: string;
  dir: string[];
}

export interface Loaded extends Candidate {
  code: string;
}

// Starting from the running file, follow every class name that matches the
// name of another file (Dog.java declares Dog), and the names those files use,
// and so on. Only files that are actually referenced are returned, so unrelated
// files (other "Main" classes, files with errors) are never pulled in.
export async function collectDependencies(opts: {
  entry: Loaded;
  candidates: Candidate[]; // every .java file in scope except the entry
  getCode: (id: string) => Promise<string>;
  limit?: number;
}): Promise<{ files: Loaded[]; truncated: boolean }> {
  const limit = opts.limit ?? MAX_BUNDLE_FILES;
  const byBase = new Map<string, Candidate[]>();
  for (const c of opts.candidates) {
    const base = c.name.replace(/\.java$/i, "");
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base)!.push(c);
  }

  const taken = new Set<string>([opts.entry.id]);
  // Classes the files already in the bundle declare themselves: a name that
  // is one of those (e.g. "Main" inside Main.java) is not a reference to some
  // other file with the same name.
  const declared = new Set<string>(scan(opts.entry.code).types.map((t) => t.name));
  const out: Loaded[] = [];
  const queue: Loaded[] = [opts.entry];
  let truncated = false;
  let total = opts.entry.code.length;

  while (queue.length) {
    const cur = queue.shift()!;
    const sc = scan(cur.code);

    // Where the imports in this file point, to choose between same-named classes.
    const explicit = new Map<string, string>(); // Dog -> models
    const wildcard: string[] = []; // models
    for (const imp of sc.imports) {
      if (imp.isStatic) continue;
      const parts = imp.name.split(".");
      if (parts[parts.length - 1] === "*") wildcard.push(parts.slice(0, -1).join("/"));
      else explicit.set(parts[parts.length - 1], parts.slice(0, -1).join("/"));
    }
    const curDir = cur.dir.join("/");

    for (const ident of new Set(sc.masked.match(IDENT_RE) ?? [])) {
      if (declared.has(ident)) continue;
      const options = byBase.get(ident)?.filter((c) => !taken.has(c.id));
      if (!options || options.length === 0) continue;

      const pref = [explicit.get(ident), ...wildcard].filter((p): p is string => !!p);
      const dirOf = (c: Candidate) => c.dir.join("/");
      const pick =
        options.find((c) => pref.some((p) => p === "" || dirOf(c) === p || dirOf(c).endsWith("/" + p))) ??
        options.find((c) => dirOf(c) === curDir) ??
        [...options].sort((a, b) => a.dir.length - b.dir.length || dirOf(a).localeCompare(dirOf(b)))[0];

      if (out.length >= limit) {
        truncated = true;
        continue;
      }
      taken.add(pick.id);
      // A same-named class elsewhere is shadowed by the one chosen.
      options.forEach((o) => o.id !== pick.id && taken.add(o.id));
      const code = await opts.getCode(pick.id);
      total += code.length;
      if (total > MAX_BUNDLE_CHARS) {
        truncated = true;
        continue;
      }
      const loaded: Loaded = { ...pick, code };
      scan(code).types.forEach((t) => declared.add(t.name));
      out.push(loaded);
      queue.push(loaded);
    }
  }
  return { files: out, truncated };
}
