import { runReproBatch } from './reproRunner.js';

const DEFAULT_OPTIONS = {
  loops: 400,
  depth: 250,
  parallel: 1,
  readyMode: 'race',
  logEvery: 250,
  stepDelayMs: 0,
};

const clampInt = (raw, fallback, min, max) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
};

const readyModeOrDefault = raw => (raw === 'none' || raw === 'event' ? raw : 'race');

function parseReproOptions(read) {
  return {
    loops: clampInt(read('loops'), DEFAULT_OPTIONS.loops, 1, 10000),
    depth: clampInt(read('depth'), DEFAULT_OPTIONS.depth, 1, 10000),
    parallel: clampInt(read('parallel'), DEFAULT_OPTIONS.parallel, 1, 32),
    readyMode: readyModeOrDefault(read('ready')),
    logEvery: clampInt(read('logEvery'), DEFAULT_OPTIONS.logEvery, 1, 100000),
    stepDelayMs: clampInt(read('stepDelayMs'), DEFAULT_OPTIONS.stepDelayMs, 0, 1000),
  };
}

export function parseReproOptionsFromSearchParams(searchParams) {
  return parseReproOptions(key => searchParams.get(key));
}

export function parseReproOptionsFromFormData(formData) {
  return parseReproOptions(key => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : null;
  });
}

export async function runReproScenario(options) {
  const { loops, ...batchOptions } = options;
  for (let i = 0; i < loops; i++) await runReproBatch(batchOptions);
}
