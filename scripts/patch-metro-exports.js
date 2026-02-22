/**
 * Patches all metro-* packages for Node v24 compatibility.
 *
 * Node v24 strictly enforces "exports" in package.json, breaking deep
 * imports used by @expo/cli and @expo/metro-config.
 *
 * Fix:
 * 1. Remove "exports" from all metro-* packages so Node falls back to
 *    "main" field resolution (allows all deep requires).
 * 2. Create "private" -> "src" symlinks in all metro-* packages that
 *    have a "src" directory (the private/ convention was an exports alias).
 *
 * Handles nested node_modules (e.g. metro-config/node_modules/metro-cache).
 */
const fs = require('fs');
const path = require('path');

const rootNodeModules = path.join(__dirname, '..', 'node_modules');

function patchMetroDir(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (!entry.startsWith('metro')) continue;
    const pkgDir = path.join(dir, entry);

    const stat = fs.lstatSync(pkgDir);
    if (!stat.isDirectory()) continue;

    // Strip exports
    const pkgPath = path.join(pkgDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.exports) {
        delete pkg.exports;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`Stripped exports: ${path.relative(rootNodeModules, pkgDir)}`);
      }
    }

    // Create private -> src symlink
    const srcPath = path.join(pkgDir, 'src');
    const privatePath = path.join(pkgDir, 'private');
    if (fs.existsSync(srcPath) && !fs.existsSync(privatePath)) {
      fs.symlinkSync('src', privatePath, 'dir');
      console.log(`Symlinked: ${path.relative(rootNodeModules, privatePath)} -> src`);
    }

    // Recurse into nested node_modules
    const nestedNm = path.join(pkgDir, 'node_modules');
    if (fs.existsSync(nestedNm)) {
      patchMetroDir(nestedNm);
    }
  }
}

patchMetroDir(rootNodeModules);
console.log('Metro patches complete.');
