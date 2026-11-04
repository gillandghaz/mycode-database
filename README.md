# mycode-database

Online home for your code: folders, an editor, autosave, and a terminal-style output panel.
Next.js (App Router) + TypeScript, Firebase (Auth + Firestore), deployed on Vercel from GitHub.

| Route | What |
|---|---|
| `/` | Landing page (signed-in users are redirected to `/app`) |
| `/login`, `/register` | Email/password and Google |
| `/app` | The editor (file explorer, tabs, editor, output) |
| `/dashboard` | Overview, Account, Settings, Admin (admins only) |
| `/app?user=<uid>` | Admin viewing another user's workspace |

## 1. Firebase

1. Create a project named **mycode-database**.
2. Build → Authentication → enable **Email/Password** and **Google**.
3. Build → Firestore Database → create it (production mode).
4. Project settings → add a **Web app**, copy the config values into `.env.local` (`NEXT_PUBLIC_*`).
5. Project settings → Service accounts → **Generate new private key** → put the three `FIREBASE_ADMIN_*` values in `.env.local`.
6. Publish the rules: paste `firestore.rules` into Firestore → Rules → Publish
   (or `npx firebase-tools deploy --only firestore:rules`).
7. Authentication → Settings → Authorized domains: add `mycode-database.vercel.app` (and `localhost`).

## 2. First admin

Sign up normally, then in Firebase Console → Firestore → `users/<your uid>` change `role` from `user` to `admin`.
Admins start in **safe mode ON**: they can view other users' code but not change or delete it.
Turn it off in Dashboard → Admin (a confirmation is required).

## 3. Run locally

```bash
cp .env.local.example .env.local   # fill it in
npm install
npm run dev
```

## 4. Deploy

Push to GitHub (repo `mycode-database`), import it in Vercel (project `mycode-database`), add the same
environment variables, deploy. `FIREBASE_ADMIN_PRIVATE_KEY`: keep the `\n` sequences, wrapped in quotes.

## Data model

- `users/{uid}`: email, username, displayName, role, settings, adminSafeMode
- `usernames/{username}`: uniqueness guard
- `nodes/{id}`: folders and files (ownerUid, parentId, type, name, size, …)
- `fileContents/{id}`: the code text (≤ 200,000 chars)

## Compiler (not connected yet)

Run always works up to the server: `POST /api/run` authenticates the user, validates the request and asks
`getRunner()` (`src/lib/runner/index.ts`). With no `RUNNER_PROVIDER` it answers `503 runner-unavailable`
and the UI shows the "Not available yet" popup.

To switch it on later, implement `CodeRunner` (`src/lib/runner/types.ts`) for your backend, add it to
`getRunner()` and set the env vars. A Piston provider is included but untested. Vercel itself has no JDK,
so execution must live on a separate service. Before enabling it, add rate limiting and run code only in a sandbox.

## Not included / known limits

- Firestore rules and the Piston provider have not been tested against live Firebase (no emulator was available while building).
- No per-user quota on number of files; no rate limiting on `/api/run`.
- No "delete my own account" and no email verification.
