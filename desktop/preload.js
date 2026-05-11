// Preload — exposes a tiny bridge so the website can detect it's running inside the desktop app.
// Optional: gives you a way to show "Open in browser" / "Desktop edition" hints on the site.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("ilmkhona0Desktop", {
  isDesktop: true,
  platform: process.platform, // "win32" | "darwin" | "linux"
  version: "1.0.0",
});
