// Generate the PNG and ICO icons that electron-builder needs from the single
// source file `build/icon.svg`. Runs automatically before each build (see
// the "prebuild" / "prebuild:win" scripts in package.json).
//
// Requires sharp (added as a devDependency).

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

const buildDir = path.join(__dirname, "..", "build");
const svgPath = path.join(buildDir, "icon.svg");
const pngPath = path.join(buildDir, "icon.png");
const icoPath = path.join(buildDir, "icon.ico");

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error(`ERROR: ${svgPath} not found.`);
    process.exit(1);
  }
  const svg = fs.readFileSync(svgPath);

  // 1) Render a high-res PNG that electron-builder can consume directly.
  console.log("Rendering 1024x1024 PNG from SVG...");
  await sharp(svg)
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(pngPath);

  // 2) Render the sizes needed inside a multi-resolution Windows .ico, then
  //    bundle them into a single icon.ico file.
  console.log("Rendering ICO source sizes...");
  const sizes = [256, 128, 64, 48, 32, 16];
  const buffers = await Promise.all(
    sizes.map((size) =>
      sharp(svg)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  console.log("Packing ICO file...");
  const icoBuffer = await pngToIco(buffers);
  fs.writeFileSync(icoPath, icoBuffer);

  console.log("Icons generated:");
  console.log("  -", pngPath);
  console.log("  -", icoPath);
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
