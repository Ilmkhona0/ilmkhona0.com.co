// One-off helper: renders the site icon to PNG files for uploads that don't
// accept SVG (Google's consent CMP, AdSense, social profiles, etc).
//
// Run once:   npm i -D sharp
//             node scripts/make-logo.mjs
//
// Output:     public/logo-256.png  and  public/logo-512.png

import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../app/icon.svg", import.meta.url));

for (const size of [256, 512]) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  const out = new URL(`../public/logo-${size}.png`, import.meta.url);
  await writeFile(out, png);
  console.log(`wrote public/logo-${size}.png  (${(png.length / 1024).toFixed(1)} KB)`);
}
