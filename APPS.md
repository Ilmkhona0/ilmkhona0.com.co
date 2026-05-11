# ilmkhona0 — Native Apps

This repo now contains three things:

```
ilmkhona0/
├── app/, public/, ...   ← the Next.js website (deployed to Vercel)
├── desktop/             ← Electron wrapper → builds .exe for Windows
└── android/             ← Capacitor wrapper → builds .apk for Android
```

Both wrappers are **thin clients** — they open the live website (`https://ilmkhona0.com.co`)
inside a native window. Same login, same files, same everything. When you update the
website, the apps see the changes on next launch — **no need to rebuild and redistribute the .exe/.apk**.

You only rebuild the apps when you change:
- The native wrapper code (`desktop/main.js`, `android/capacitor.config.ts`)
- The icon / splash screen
- Dependencies

## Quick start

### Build the Windows .exe

```bash
cd desktop
npm install
npm run build:win    # produces dist/ilmkhona0 Setup 1.0.0.exe + portable .exe
```

Full details: [`desktop/README.md`](./desktop/README.md)

### Build the Android .apk

```bash
cd android
npm install
npm run add:android         # one-time
npm run build:apk:debug     # produces android/android/app/build/outputs/apk/debug/app-debug.apk
```

Full details: [`android/README.md`](./android/README.md)

## Login & sessions

Both apps use a **persistent cookie session** pointed at `https://ilmkhona0.com.co`.
Users sign in via Google / GitHub / email through NextAuth exactly as they would on the
website, and the cookie sticks around between app launches. Logging out on the site logs
them out in the app, because it's literally the same session.

## What's deployed to Vercel

Only the Next.js website. `.vercelignore` excludes `desktop/` and `android/` so the build
isn't slowed down or broken by the wrapper code.

## Distributing the apps

- **.exe**: upload to your site (e.g. add a "Download for Windows" button on the homepage
  that points to `/uploads/ilmkhona0-1.0.0-Setup.exe` or similar). Or use GitHub Releases.
- **.apk**: same — either host on your site as a direct download, or publish on the Google
  Play Store (requires a $25 one-time developer fee + signing the APK properly).

## Detecting the desktop app from the website

The Electron preload exposes a small bridge so you can show "desktop edition" UI hints:

```ts
// In any client component
const isDesktop =
  typeof window !== "undefined" && (window as any).ilmkhona0Desktop?.isDesktop;
```
