// ilmkhona0 — Electron main process.
// Loads the live site in a native window, with fixes for the most common
// "Electron wrapping a real website" pain points:
//   1. Google/GitHub OAuth pages refuse to load in embedded browsers; we
//      spoof the User-Agent so they treat us as regular Chrome.
//   2. A splash screen shows instantly so the user never sees a blank
//      window while the live site is loading.
//   3. Persistent session partition + HTTP cache so subsequent launches
//      load fast.
//   4. External links open in the user's default browser; internal links
//      stay in-window.
//   5. F12 toggles DevTools so we can debug production builds if needed.

const { app, BrowserWindow, shell, Menu, session, globalShortcut } = require("electron");
const path = require("path");

const SITE_URL = process.env.ILMKHONA0_URL || "https://ilmkhona0.com.co";

// The default Electron UA contains "Electron/33.x.x" — Google's identity
// service detects that and refuses to render the OAuth consent screen,
// with the error "This browser or app may not be secure".
// Stripping the Electron and ilmkhona0 segments makes us look like plain Chrome,
// which is what Google/GitHub/Microsoft OAuth providers expect.
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/130.0.0.0 Safari/537.36";

// Origins we consider "internal" — they open inside the app window.
// Everything else opens in the system browser.
const INTERNAL_HOSTS = new Set([
  "ilmkhona0.com.co",
  "www.ilmkhona0.com.co",
  // OAuth providers — keep them in-window so the redirect back to the site
  // can drop the auth cookie on ilmkhona0.com.co.
  "accounts.google.com",
  "oauth2.googleapis.com",
  "github.com",
  "api.github.com",
]);

function isInternal(url) {
  try {
    const u = new URL(url);
    return INTERNAL_HOSTS.has(u.host);
  } catch {
    return false;
  }
}

let mainWindow = null;
let splashWindow = null;

/* ------------------------------------------------------------------ */
/* Splash window                                                       */
/* ------------------------------------------------------------------ */
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 240,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: "#00000000",
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });

  const html = `
    <!doctype html>
    <html><head><meta charset="utf-8"/><style>
      html, body { margin: 0; padding: 0; height: 100%; overflow: hidden;
        background: transparent; font-family: "Segoe UI", system-ui, Arial, sans-serif;
        -webkit-user-select: none; user-select: none; }
      .card { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, #1d4ed8, #0d47a1); color: #fff; border-radius: 16px;
        box-shadow: 0 18px 60px rgba(0,0,0,.35); position: relative; }
      h1 { font-size: 32px; font-weight: 800; margin: 0; letter-spacing: -.02em; }
      .accent { position: absolute; top: 26px; right: 32px; width: 14px; height: 14px;
        border-radius: 999px; background: linear-gradient(135deg, #ff6b6b, #ee5a52); }
      .dots { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; }
      .dots span { width: 8px; height: 8px; border-radius: 999px; background: #ff6b6b;
        animation: pulse 1s infinite ease-in-out; opacity: .55; }
      .dots span:nth-child(2) { animation-delay: .15s; }
      .dots span:nth-child(3) { animation-delay: .30s; }
      @keyframes pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.5); opacity: 1; } }
    </style></head>
    <body><div class="card"><h1>ilmkhona0</h1><div class="accent"></div>
      <div class="dots"><span></span><span></span><span></span></div></div></body></html>`;

  splashWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  splashWindow.on("closed", () => { splashWindow = null; });
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
}

/* ------------------------------------------------------------------ */
/* Main window                                                         */
/* ------------------------------------------------------------------ */
function createWindow() {
  // Use a persistent partition so cookies, localStorage, IndexedDB, and the
  // HTTP cache all survive between app launches (i.e. user stays logged in,
  // and the site loads from cache on subsequent launches).
  const persistedSession = session.fromPartition("persist:ilmkhona0");

  // Spoof the User-Agent for all requests so OAuth providers play nice.
  persistedSession.setUserAgent(CHROME_UA);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "ilmkhona0",
    backgroundColor: "#f0f4fc",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    show: false, // don't show empty window; we'll show it once the page is ready
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "persist:ilmkhona0",
      spellcheck: true,
      backgroundThrottling: false,
    },
  });

  // Apply UA at the window level too (belt + suspenders — some requests
  // bypass the session-level UA).
  mainWindow.webContents.setUserAgent(CHROME_UA);

  Menu.setApplicationMenu(null);

  // External links open in default browser; internal stays here.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      mainWindow.loadURL(url);
      return { action: "deny" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Once the live site has actually rendered, swap the splash for the real window.
  mainWindow.webContents.once("did-finish-load", () => {
    closeSplash();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // If the load fails (no internet, server down), still show the window
  // with a friendly retry option after a few seconds.
  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription) => {
    if (errorCode === -3) return; // user-aborted (fast nav), ignore
    closeSplash();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      const html = `
        <!doctype html><html><head><meta charset="utf-8"/><style>
          body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
            font-family: "Segoe UI", system-ui, sans-serif; background: #f0f4fc; color: #0d47a1;
            text-align: center; padding: 24px; }
          .card { max-width: 480px; }
          h1 { font-size: 28px; margin: 0 0 8px; }
          p { color: #475569; margin: 0 0 20px; }
          button { background: linear-gradient(135deg, #ff6b6b, #ee5a52); color: #fff; border: none;
            padding: 12px 28px; font-size: 15px; font-weight: 700; border-radius: 999px; cursor: pointer; }
          button:hover { filter: brightness(1.05); }
          code { background: rgba(15,23,42,.06); padding: 2px 6px; border-radius: 6px; font-size: 12px; }
        </style></head><body><div class="card">
          <h1>Can't reach ilmkhona0</h1>
          <p>Check your internet connection and try again.</p>
          <p><code>${errorDescription}</code></p>
          <button onclick="location.href='${SITE_URL}'">Retry</button>
        </div></body></html>`;
      mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    }
  });

  mainWindow.loadURL(SITE_URL);

  mainWindow.on("closed", () => { mainWindow = null; });
}

/* ------------------------------------------------------------------ */
/* App lifecycle                                                       */
/* ------------------------------------------------------------------ */

// Force a single instance — opening the .exe a second time focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createSplash();
    createWindow();

    // F12 toggles DevTools so you can debug the production .exe.
    globalShortcut.register("F12", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const wc = mainWindow.webContents;
        if (wc.isDevToolsOpened()) wc.closeDevTools();
        else wc.openDevTools({ mode: "detach" });
      }
    });

    // Ctrl+R reload, Ctrl+Shift+R hard-reload.
    globalShortcut.register("CommandOrControl+R", () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    });
    globalShortcut.register("CommandOrControl+Shift+R", () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reloadIgnoringCache();
    });

    // Safety: if the page never finishes loading, force-show the window after 8s
    // so the user isn't stuck looking at a splash.
    setTimeout(() => {
      closeSplash();
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.show();
      }
    }, 8000);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
}
