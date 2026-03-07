/**
 * Next.js boot wrapper.
 *
 * Why this exists:
 * - On some Node.js versions (observed on Node 25.x on Windows), `globalThis.localStorage` exists but is not a
 *   functional Web Storage implementation (e.g. `localStorage.getItem` is missing).
 * - Next.js (via a compiled dependency: `next/dist/compiled/@typescript/vfs`) assumes that if `localStorage`
 *   exists then `localStorage.getItem` is callable, which can crash the dev server with:
 *     "TypeError: localStorage.getItem is not a function"
 *
 * Fix:
 * - If `localStorage` is present as a global, redefine it to `undefined` before Next.js loads.
 */

try {
  const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (desc) {
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      enumerable: desc.enumerable ?? true,
      writable: true,
    });
  }
} catch {
  // Best-effort: if we can't patch, let Next run and surface the real error.
}

const nextBin = require.resolve("next/dist/bin/next");

// Forward CLI args: `node scripts/next-safe.cjs dev ...` -> `node nextBin dev ...`
process.argv = [process.argv[0], nextBin, ...process.argv.slice(2)];

require(nextBin);

