# ilmkhona0 — Android (Capacitor)

Native Android app wrapper for **https://ilmkhona0.com.co**.

## What it does

The APK is a thin native Android app whose WebView is pointed at the live site.
Install once, content always updates with the website. Cookies persist across
launches, so users stay logged in.

## Prerequisites

To build the APK you need:

1. **Node.js 18+**
2. **Android Studio** (which installs the Android SDK, build tools, and JDK 17)
   — https://developer.android.com/studio
3. After installing Android Studio, set the env var `ANDROID_HOME` to your SDK path
   (Android Studio shows the path under **Settings → Android SDK**).

> 💡 If you want to skip installing Android Studio, you can build via GitHub Actions instead.
> See the `Build via GitHub Actions` section below.

## First-time setup (one-time)

From this `android/` folder:

```bash
npm install

# Adds the native Android project under android/android/
# (Capacitor calls it `android` — yes, that's a folder inside this folder.)
npm run add:android
```

After this you'll have an `android/android/` directory — that's a real Android Studio
project you can open.

## Run on a device / emulator

```bash
# Plug in a USB device (with USB debugging enabled) or start an emulator first.
npm run run:android
```

Or open it in Android Studio:

```bash
npm run open:android
# then press the Run button
```

## Build an installable `.apk`

### Debug APK (unsigned, fine for testing)

```bash
npm run build:apk:debug
```

Output: `android/android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK (signed, for distribution)

1. Create a signing keystore (you only do this once — **save the password and file securely**,
   you'll need both forever to publish updates):

   ```bash
   keytool -genkey -v -keystore ilmkhona0.keystore \
     -alias ilmkhona0 -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `android/android/keystore.properties`:

   ```
   storeFile=../../ilmkhona0.keystore
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyAlias=ilmkhona0
   keyPassword=YOUR_KEY_PASSWORD
   ```

3. Edit `android/android/app/build.gradle` to read those properties (Android Studio
   has a wizard for this: **Build → Generate Signed Bundle / APK → APK**).

4. Build:

   ```bash
   npm run build:apk
   ```

   Output: `android/android/app/build/outputs/apk/release/app-release.apk`

## Build via GitHub Actions (no local Android setup)

Create `.github/workflows/android.yml` in the repo root:

```yaml
name: Android APK
on:
  workflow_dispatch:
  push:
    paths: ["android/**"]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - name: Install deps
        working-directory: android
        run: npm ci
      - name: Add Android platform
        working-directory: android
        run: npx cap add android
      - name: Build debug APK
        working-directory: android
        run: npm run build:apk:debug
      - uses: actions/upload-artifact@v4
        with:
          name: ilmkhona0-debug-apk
          path: android/android/app/build/outputs/apk/debug/*.apk
```

Trigger from the **Actions** tab → "Android APK" → "Run workflow".
Download the APK artifact when it finishes.

## App icons & splash screen

After `npm run add:android`, replace these files inside `android/android/app/src/main/res/`:

- `mipmap-*/ic_launcher.png` (various sizes — Android Studio's **Asset Studio** generates them)
- `drawable/splash.png` (matches the splash screen referenced in capacitor.config.ts)

Or use the Capacitor assets generator:

```bash
npm install --save-dev @capacitor/assets
npx @capacitor/assets generate --android
```

(Place a single 1024×1024 `assets/icon.png` and `assets/splash.png` first.)

## How login works

The Android WebView keeps cookies on device storage. Once a user logs in via Google/GitHub/
email through NextAuth, the session cookie persists across app launches — so the user
stays signed in just like on the website. Logging out on the site logs them out here too.
