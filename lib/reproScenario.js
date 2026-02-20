import { runReproBatch } from './reproRunner.js';

const DEFAULT_OPTIONS = {
  loops: 400,
  depth: 250,
  parallel: 1,
  readyMode: 'race',
  logEvery: 250,
  stepDelayMs: 0,
};

function clampInt(raw, fallback, min, max) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function getReadyMode(raw) {
  if (raw === 'none') return 'none';
  if (raw === 'event') return 'event';
  return 'race';
}

function normalizeOptions(raw) {
  return {
    loops: clampInt(raw.loops, DEFAULT_OPTIONS.loops, 1, 10000),
    depth: clampInt(raw.depth, DEFAULT_OPTIONS.depth, 1, 10000),
    parallel: clampInt(raw.parallel, DEFAULT_OPTIONS.parallel, 1, 32),
    readyMode: getReadyMode(raw.ready),
    logEvery: clampInt(raw.logEvery, DEFAULT_OPTIONS.logEvery, 1, 100000),
    stepDelayMs: clampInt(raw.stepDelayMs, DEFAULT_OPTIONS.stepDelayMs, 0, 1000),
  };
}

export function parseReproOptionsFromSearchParams(searchParams) {
  return normalizeOptions({
    loops: searchParams.get('loops'),
    depth: searchParams.get('depth'),
    parallel: searchParams.get('parallel'),
    ready: searchParams.get('ready'),
    logEvery: searchParams.get('logEvery'),
    stepDelayMs: searchParams.get('stepDelayMs'),
  });
}

export function parseReproOptionsFromFormData(formData) {
  const read = key => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : null;
  };

  return normalizeOptions({
    loops: read('loops'),
    depth: read('depth'),
    parallel: read('parallel'),
    ready: read('ready'),
    logEvery: read('logEvery'),
    stepDelayMs: read('stepDelayMs'),
  });
}

export async function runReproScenario(options) {
  for (let i = 0; i < options.loops; i++) {
    await runReproBatch({
      depth: options.depth,
      parallel: options.parallel,
      readyMode: options.readyMode,
      logEvery: options.logEvery,
      stepDelayMs: options.stepDelayMs,
    });
  }

  return {};
}
