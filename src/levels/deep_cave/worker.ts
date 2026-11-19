import { generateDeepCavePuzzle } from './generator.ts';
import type { DeepCaveWorkerRequest, DeepCaveWorkerResponse } from '../../types/index.ts';

/**
 * Web Worker entrypoint for non-blocking `deep_cave` procedural generation.
 */

self.onmessage = (event: MessageEvent<DeepCaveWorkerRequest>) => {
  const { requestId, seed = null, settings = null } = event?.data || ({} as DeepCaveWorkerRequest);
  try {
    const puzzle = generateDeepCavePuzzle(null, settings, null, seed);
    const okMsg: DeepCaveWorkerResponse = { requestId, ok: true, puzzle };
    self.postMessage(okMsg);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const errMsg: DeepCaveWorkerResponse = {
      requestId,
      ok: false,
      error: message
    };
    self.postMessage(errMsg);
  }
};
