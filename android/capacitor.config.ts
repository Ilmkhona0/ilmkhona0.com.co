import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor config — points the Android WebView at the live website.
// This means the APK is a thin wrapper: install once, content is always live.

const config: CapacitorConfig = {
  appId: "com.ilmkhona0.app",
  appName: "ilmkhona0",
  webDir: "www",

  // Load the live production URL instead of a bundled local web build.
  // Comment out `server.url` and set `webDir` to your built Next.js export
  // if you'd rather ship the app fully offline.
  server: {
    url: "https://ilmkhona0.com.co",
    androidScheme: "https",
    // allow http resources only if absolutely necessary (e.g. dev mode):
    cleartext: false,
  },

  android: {
    // Java/Gradle build settings
    minWebViewVersion: 60,
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  // Cordova-style plugins (none needed for the basic wrapper).
  plugins: {
    // Splash screen shown on launch.
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0d47a1",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
