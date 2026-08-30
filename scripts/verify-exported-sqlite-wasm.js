const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || 'dist/web');
const wasmDir = path.join(root, 'wasm', 'expo-sqlite');

if (!fs.existsSync(wasmDir)) {
  throw new Error(`Expo SQLite WASM directory was not exported at ${wasmDir}`);
}

const wasmFiles = fs.readdirSync(wasmDir).filter((name) => name.endsWith('.wasm'));
if (wasmFiles.length === 0) {
  throw new Error(`No Expo SQLite .wasm file was exported at ${wasmDir}`);
}

for (const name of wasmFiles) {
  const filePath = path.join(wasmDir, name);
  const fd = fs.openSync(filePath, 'r');
  try {
    const magic = Buffer.alloc(4);
    fs.readSync(fd, magic, 0, 4, 0);
    const expected = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
    if (!magic.equals(expected)) {
      throw new Error(`${filePath} does not start with the WebAssembly magic bytes`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

const badPaths = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') badPaths.push(fullPath);
      walk(fullPath);
    }
  }
}
walk(root);

if (badPaths.length) {
  console.warn(`Export still contains ${badPaths.length} node_modules path(s); Cloudflare may exclude them. Expo SQLite WASM itself is verified under /wasm/expo-sqlite.`);
}

console.log(`Verified ${wasmFiles.length} Expo SQLite WASM asset(s) at /wasm/expo-sqlite with valid WebAssembly magic bytes.`);
