// Picks a FontAwesome icon + brand color for a file from its name (and the
// folder it lives in, so executables in the Games section show a controller).
//
// Note: a website cannot read the icon embedded inside a .exe (that lives in
// the binary), so we show a clear representative icon instead.

export function fileGlyph(name: string, folder?: string): { icon: string; color: string } {
  const n = name.toLowerCase();
  if (/\.(mp3|wav|m4a|flac|aac|ogg)$/.test(n)) return { icon: "fas fa-music", color: "#8b5cf6" };
  if (/\.pdf$/.test(n)) return { icon: "fas fa-file-pdf", color: "#dc2626" };
  if (/\.pptx?$/.test(n)) return { icon: "fas fa-file-powerpoint", color: "#d24726" };
  if (/\.(xlsx?|csv)$/.test(n)) return { icon: "fas fa-file-excel", color: "#1d6f42" };
  if (/\.docx?$/.test(n)) return { icon: "fas fa-file-word", color: "#2b579a" };
  if (/\.apk$/.test(n)) return { icon: "fab fa-android", color: "#3ddc84" };
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return { icon: "fas fa-file-zipper", color: "#b45309" };
  if (/\.(exe|msi|app|dmg|appimage|deb|rpm|jar|love|nes|gb|gba|nds|swf)$/.test(n)) {
    return folder === "games"
      ? { icon: "fas fa-gamepad", color: "#a855f7" }
      : { icon: "fas fa-window-maximize", color: "#0ea5e9" };
  }
  if (/\.(py|pyw|rb|php|java|kt|scala|c|h|cc|cpp|cxx|hpp|cs|vb|fs|go|rs|swift|dart|lua|pl|r|jl|js|mjs|cjs|ts|tsx|jsx|vue|svelte|sh|bash|ps1|bat|cmd|sql|graphql|sol|asm|nim|zig|hs|clj|ex|erl|elm|ml|coffee)$/.test(n)) {
    return { icon: "fas fa-file-code", color: "#0d9488" };
  }
  if (/\.(txt|md|json|xml|ya?ml|toml|ini|html?|log)$/.test(n)) {
    return { icon: "fas fa-file-lines", color: "#64748b" };
  }
  return { icon: "fas fa-file", color: "#64748b" };
}

export function FileGlyph({
  name,
  folder,
  className,
}: {
  name: string;
  folder?: string;
  className?: string;
}) {
  const g = fileGlyph(name, folder);
  return <i className={`${g.icon}${className ? " " + className : ""}`} style={{ color: g.color }} aria-hidden="true" />;
}
