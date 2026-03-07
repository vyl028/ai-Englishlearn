/**
 * Node preload patch for Next.js on Node 25.x (Windows).
 *
 * Problem:
 * - Some Node.js builds expose a non-functional `globalThis.localStorage` in server environments
 *   (e.g. `localStorage.getItem` is missing). Next.js dev tooling assumes that if `localStorage`
 *   exists, then `localStorage.getItem` is callable, which can crash with:
 *     "TypeError: localStorage.getItem is not a function"
 *
 * Fix:
 * - Force `localStorage` to be `undefined` before Next.js loads. When passed via `--require`,
 *   this runs early and also applies to worker threads (they inherit execArgv).
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
  // Best-effort only.
}

