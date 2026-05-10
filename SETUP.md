# ilmkhona0 — auth + AI upgrade setup

## What changed

- **Auth** — Replaced the custom login/register endpoints with NextAuth (Auth.js v5). The `/auth` page now offers Google, GitHub, and email/password (auto-registers on first use).
- **AI Instructor** — A new `/api/ai/chat` route proxies to xAI's Grok API.
- **UI** — One floating button (bottom-right). Tap it and a panel opens with two tabs: **Comments** and **AI Chat**.
- **Admin** — Still works with the same hard-coded credentials (`ilmkhona0` / `MySecret123`).

## Files added or modified

```
+ auth.ts                                   (NextAuth v5 config, project root)
+ app/api/auth/[...nextauth]/route.ts       (NextAuth catch-all handler)
+ app/api/ai/chat/route.ts                  (xAI Grok proxy)
+ app/components/Providers.tsx              (SessionProvider wrapper)
~ app/layout.tsx                            (wraps children in <Providers>)
~ app/auth/page.tsx                         (login-only, social buttons + email)
~ app/page.tsx                              (uses useSession; tabbed FAB panel)
~ app/globals.css                           (appended ~230 lines of new styles)
~ package.json                              (already updated — deps installed)
- app/api/auth/login/route.ts               (DELETED, NextAuth owns /api/auth/*)
- app/api/auth/register/route.ts            (DELETED, see above)
```

## Step-by-step: what you need to do

### 1. Install deps (if not already)

Your `package.json` already lists `next-auth`, `@auth/mongodb-adapter`, and `bcryptjs`, so this should be a no-op. If `node_modules` is stale:

```bash
npm install
```

### 2. Fill in `.env.local`

Open `.env.local` in the project root. Your `MONGODB_URI` is already there. The new keys are placeholders:

```
AUTH_SECRET=...
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
XAI_API_KEY=
XAI_MODEL=grok-2-latest
```

### 3. Generate `AUTH_SECRET`

```bash
npx auth secret
```

(or `openssl rand -base64 32`) — paste the output as the value of `AUTH_SECRET`.

### 4. Create the Google OAuth app

1. https://console.cloud.google.com → pick or create a project.
2. **APIs & Services → OAuth consent screen** → **External**, app name `ilmkhona0`, support email = your email. Save.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → **Web application**.
4. **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - `https://ilmkhona0.com.co` (your production domain)
5. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://ilmkhona0.com.co/api/auth/callback/google`
6. Save → copy Client ID / Client secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

### 5. Create the GitHub OAuth app

1. https://github.com/settings/developers → **OAuth Apps → New OAuth App**.
2. Application name: `ilmkhona0`.
3. Homepage URL: `https://ilmkhona0.com.co`.
4. Authorization callback URL: `https://ilmkhona0.com.co/api/auth/callback/github`.
5. Register the app, then **Generate a new client secret**.
6. Paste them into `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
7. (Optional) For local dev, register a second OAuth App with `http://localhost:3000/api/auth/callback/github` so you can test locally without breaking production.

### 6. Get an xAI API key

1. https://console.x.ai (sign in with your X / xAI account).
2. **API Keys → Create new key**.
3. Paste it into `XAI_API_KEY`.

### 7. Run locally

```bash
npm run dev
# open http://localhost:3000/auth
```

Try each path:
- **Google** — click *Continue with Google* → OAuth consent → back to home, signed in.
- **GitHub** — same flow.
- **New email** — type any new email + a password (>=6 chars). Account auto-created in MongoDB `users` collection.
- **Floating button** (bottom-right) — open it and switch between **Comments** and **AI Chat** tabs.

### 8. Push to Vercel

After committing, on Vercel → Project → **Settings → Environment Variables**, add the same keys you put in `.env.local`:

```
AUTH_SECRET, AUTH_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET,
AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, XAI_API_KEY, XAI_MODEL
```

Set `AUTH_URL` to your production URL (e.g. `https://ilmkhona0.com.co`). Then redeploy.

## Notes / gotchas

- **Old plaintext passwords** in `users` will keep working — the first successful login rehashes them with bcrypt automatically.
- **Admin** login is hard-coded inside `auth.ts` (username `ilmkhona0` or email `ilmkhona@gmail.com`, password `MySecret123`). Change it there if you want.
- **AI history** is currently client-side (cleared when the panel closes). To persist per-user, add a MongoDB collection `ai_messages` and load/save from `app/api/ai/chat/route.ts`.
- **AI is gated** to logged-in users (returns 401 otherwise). Remove the `auth()` check in `app/api/ai/chat/route.ts` to make it public.
- The `[...nextauth]` folder name uses square brackets — make sure your filesystem preserved them when copying.
