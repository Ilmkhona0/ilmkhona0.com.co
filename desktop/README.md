# ilmkhona0 — Desktop (Electron)

Native Windows / macOS / Linux wrapper for **https://ilmkhona0.com.co**.

## What it does

Opens the live site inside a real desktop window. Cookies persist so users stay logged in.
External links (Google, GitHub, mailto:, etc.) open in the user's default browser instead of inside the app.

## First-time setup

You need Node.js 18+ installed.

```bash
cd desktop
npm install
```

## Run it (development)

```bash
npm start
```

This launches Electron pointing at the live production site. You can override the URL via env var:

```bash
# Windows PowerShell
$env:ILMKHONA0_URL="http://localhost:3000"; npm start

# macOS / Linux
ILMKHONA0_URL=http://localhost:3000 npm start
```

## Build the `.exe` (Windows)

Run this on a **Windows machine** (electron-builder cross-compilation to Windows
from Linux/macOS works but is finicky — recommended to build on Windows):

```bash
# Both installer and portable .exe
npm run build:win

# Just the installer (NSIS)
npm run build:installer

# Just a portable single .exe (no install required)
npm run build:portable
```

Output appears in `desktop/dist/`:

- `ilmkhona0 Setup 1.0.0.exe` — the installer
- `ilmkhona0-1.0.0-portable.exe` — single-file portable build

## Icon

The icon source is `build/icon.svg`. A small Node script (`scripts/make-icons.js`)
**automatically** generates `build/icon.png` (1024×1024) and `build/icon.ico`
(multi-resolution: 16, 32, 48, 64, 128, 256) from that SVG before every build.

To change the icon, edit `build/icon.svg`. To regenerate manually:

```bash
npm run icons
```

The script uses `sharp` (a fast image library) and `png-to-ico` — both are
installed as devDependencies.

## How login works

The Electron window uses a persistent session partition (`persist:ilmkhona0`). The first time
the user signs in via Google/GitHub/email, NextAuth sets cookies on `ilmkhona0.com.co`, and
those cookies survive app restarts — exactly like a normal browser.

If the user clicks "Logout" on the site, it logs them out of the app too (it's the same session).

## Updating the app

Because the app is just a wrapper for the live site, **you don't need to ship a new .exe
when you update the website** — users will see the latest version on next launch.

You only need to rebuild the .exe when you change something in `main.js`, `preload.js`,
or bump dependencies.
