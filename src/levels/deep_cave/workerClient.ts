/**
 * Async Web Worker client for `deep_cave` procedural generation with
 * 3,000 ms timeout cap and verified CI seed-bank fallback.
 */

import { generateDeepCavePuzzle } from './generator.ts';
import { detectDeepCavePresetId, normalizeDeepCaveSettings } from './presets.ts';
import { getFallbackDeepCavePuzzle } from './seedBank.ts';
import type {
  DeepCaveAsyncOptions,
  DeepCaveAsyncResult,
  DeepCaveWorkerRequest,
  DeepCaveWorkerResponse
} from '../../types/index.ts';

export const DEEP_CAVE_WORKER_TIMEOUT_MS = 3000;

let nextRequestId = 1;

interface WorkerTaggedError extends Error {
  code?: string;
  isCancelled?: boolean;
  isCustomTimeout?: boolean;
}

function makeCancelledError(): WorkerTaggedError {
  const err: WorkerTaggedError = new Error('Deep Cave generation cancelled');
  err.code = 'DEEP_CAVE_CANCELLED';
  err.isCancelled = true;
  return err;
}

function makeCustomTimeoutError(timeoutMs: number): WorkerTaggedError {
  const err: WorkerTaggedError = new Error(`Deep Cave custom generation timed out after ${timeoutMs}ms`);
  err.code = 'DEEP_CAVE_CUSTOM_TIMEOUT';
  err.isCustomTimeout = true;
  return err;
}

/**
 * Generates a `deep_cave` puzzle asynchronously in a Web Worker when available,
 * enforcing a timeout cap and falling back to the verified CI seed bank for
 * standard presets (`easy`, `normal`, `hard`, `expert`).
 */
export function generateDeepCaveAsync(
  settingsInput: any = null,
  options: DeepCaveAsyncOptions = {}
): Promise<DeepCaveAsyncResult> {
  const {
    seed = null,
    timeoutMs = DEEP_CAVE_WORKER_TIMEOUT_MS,
    signal = null,
    WorkerClass = typeof Worker !== 'undefined' ? Worker : null
  } = options;

  const settings = normalizeDeepCaveSettings(settingsInput);
  const presetId = detectDeepCavePresetId(settings);
  const resolvedSeed = seed != null
    ? String(seed)
    : `dc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const startTime = performance.now();

  if (signal?.aborted) {
    return Promise.reject(makeCancelledError());
  }

  // Synchronous microtask fallback in Node/Vitest or environments without Web Workers
  if (!WorkerClass) {
    return Promise.resolve().then(() => {
      if (signal?.aborted) throw makeCancelledError();
      const puzzle = generateDeepCavePuzzle(null, settings, null, resolvedSeed);
      return {
        puzzle,
        usedFallback: false,
        timedOut: false,
        presetId,
        durationMs: performance.now() - startTime
      };
    });
  }

  return new Promise<DeepCaveAsyncResult>((resolve, reject) => {
    const requestId = nextRequestId++;
    let settled = false;
    let worker: any = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        try {
          worker.terminate();
        } catch {
          // Ignore termination errors in mocked workers
        }
        worker = null;
      }
    };

    const resolveFallbackOrReject = ({
      timedOut,
      errToThrow
    }: {
      timedOut: boolean;
      errToThrow: Error;
    }) => {
      if (settled) return;
      settled = true;
      cleanup();

      const fallbackPuzzle = presetId !== 'custom'
        ? getFallbackDeepCavePuzzle(presetId, resolvedSeed)
        : null;

      if (fallbackPuzzle) {
        resolve({
          puzzle: fallbackPuzzle,
          usedFallback: true,
          timedOut,
          presetId,
          durationMs: performance.now() - startTime
        });
        return;
      }

      reject(errToThrow);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(makeCancelledError());
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      // Call literal `new Worker(new URL(...), { type: 'module' })` when using the native
      // global Worker so Vite bundles `worker.ts` and its imports into a standalone worker chunk.
      const nativeWorkerCtor = typeof Worker !== 'undefined' ? Worker : null;
      worker = WorkerClass === nativeWorkerCtor && nativeWorkerCtor
        ? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
        : new WorkerClass(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch (spawnErr) {
      settled = true;
      cleanup();
      // Worker construction blocked (e.g. bundled CSP): run directly
      try {
        const puzzle = generateDeepCavePuzzle(null, settings, null, resolvedSeed);
        resolve({
          puzzle,
          usedFallback: false,
          timedOut: false,
          presetId,
          durationMs: performance.now() - startTime
        });
      } catch (genErr) {
        reject(genErr || spawnErr);
      }
      return;
    }

    timerId = setTimeout(() => {
      resolveFallbackOrReject({
        timedOut: true,
        errToThrow: makeCustomTimeoutError(timeoutMs)
      });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<DeepCaveWorkerResponse>) => {
      const data = event?.data;
      if (!data || (data.requestId != null && data.requestId !== requestId)) return;
      if (settled) return;

      if (data.ok && data.puzzle) {
        settled = true;
        cleanup();
        resolve({
          puzzle: data.puzzle,
          usedFallback: false,
          timedOut: false,
          presetId,
          durationMs: performance.now() - startTime
        });
      } else {
        const errMsg = !data.ok && data.error ? data.error : 'Deep Cave generation failed';
        resolveFallbackOrReject({
          timedOut: false,
          errToThrow: new Error(errMsg)
        });
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      if (settled) return;
      // If standard preset, resolve immediately from verified CI Seed Bank
      if (presetId !== 'custom') {
        resolveFallbackOrReject({
          timedOut: false,
          errToThrow: new Error(event?.message || 'Deep Cave worker error')
        });
        return;
      }
      // For custom settings, retry once synchronously before reporting failure
      settled = true;
      cleanup();
      try {
        const puzzle = generateDeepCavePuzzle(null, settings, null, resolvedSeed);
        resolve({
          puzzle,
          usedFallback: false,
          timedOut: false,
          presetId,
          durationMs: performance.now() - startTime
        });
      } catch (err) {
        reject(err);
      }
    };

    const reqPayload: DeepCaveWorkerRequest = { requestId, seed: resolvedSeed, settings };
    worker.postMessage(reqPayload);
  });
}
