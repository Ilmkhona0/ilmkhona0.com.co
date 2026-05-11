// ilmkhona0 — Electron main process.
// Loads the live site in a native window and keeps a persistent login session.

const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");

const SITE_URL = process.env.ILMKHONA0_URL || "https://ilmkhona0.com.co";

// Treat these origins as "internal" — they open in the same window.
// Anything else opens in the user's default browser.
const INTERNAL_HOSTS = new Set([
  "ilmkhona0.com.co",
  "www.ilmkhona0.com.co",
  // OAuth providers used during sign-in (so Google/GitHub login flow stays in-window).
  "accounts.google.com",
  "github.com",
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "ilmkhona0",
    backgroundColor: "#f0f4fc",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The default Electron session persists cookies on disk, so the website's
      // NextAuth cookie survives app restarts — meaning the user stays logged in.
      partition: "persist:ilmkhona0",
      spellcheck: true,
    },
  });

  // Strip the menu bar entirely (Alt still pops it; remove if you want a fully chromeless feel).
  Menu.setApplicationMenu(null);

  // External links → open in default browser; internal links → stay in window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      mainWindow.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Show a friendly dialog if the site can't be reached.
  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // user-aborted (e.g. fast navigation), ignore
    dialog.showErrorBox(
      "Can't reach ilmkhona0",
      `Failed to load ${validatedURL}\n\nError: ${errorDescription} (code ${errorCode})\n\n` +
        "Check your internet connection and try again."
    );
  });

  mainWindow.loadURL(SITE_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Enforce single instance — clicking the icon a second time focuses the existing window.
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

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
