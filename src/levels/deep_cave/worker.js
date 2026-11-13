/**
 * Web Worker entrypoint for non-blocking `deep_cave` procedural generation.
 */

import { generateDeepCavePuzzle } from './generator.js';

self.onmessage = (event) => {
  const { requestId, seed = null, settings = null } = event?.data || {};
  try {
    const puzzle = generateDeepCavePuzzle(null, settings, null, seed);
    self.postMessage({ requestId, ok: true, puzzle });
  } catch (err) {
    self.postMessage({
      requestId,
      ok: false,
      error: err?.message || String(err)
    });
  }
};
