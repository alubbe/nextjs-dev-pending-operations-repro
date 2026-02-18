import { runReproBatch } from '../../../../lib/reproRunner.js';

const STATE_KEY = Symbol.for('nextjs-repro.pending-operations.state');
const DEFAULT_GC_PASSES = 3;

function getState() {
  const existing = globalThis[STATE_KEY];
  if (existing && typeof existing.requests === 'number') {
    return existing;
  }

  const state = { requests: 0, lastRequestAt: null };
  globalThis[STATE_KEY] = state;
  return state;
}

function getMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
  };
}

function getDelta(before, after) {
  return {
    rss: after.rss - before.rss,
    heapUsed: after.heapUsed - before.heapUsed,
    heapTotal: after.heapTotal - before.heapTotal,
    external: after.external - before.external,
  };
}

function clampInt(raw, fallback, min, max) {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function getBool(raw, fallback) {
  if (raw === null) return fallback;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

function getReadyMode(raw) {
  if (raw === 'none') return 'none';
  if (raw === 'event') return 'event';
  return 'race';
}

function getMode(raw) {
  return raw === 'console' ? 'console' : 'noop';
}

async function runForcedGcCycle(passes) {
  const gcFn = globalThis.gc;
  if (typeof gcFn !== 'function') {
    return { requested: true, available: false, passes: 0 };
  }

  let performed = 0;
  for (let i = 0; i < passes; i++) {
    gcFn();
    performed++;
    await new Promise(resolve => setImmediate(resolve));
  }

  return { requested: true, available: true, passes: performed };
}

async function handle(request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Disabled in production' }, { status: 404 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? 'request';
  const gcPasses = clampInt(url.searchParams.get('gcPasses'), DEFAULT_GC_PASSES, 1, 100);
  const shouldRunGc = getBool(url.searchParams.get('gc'), action !== 'request');
  const state = getState();

  if (action === 'reset') {
    state.requests = 0;
    state.lastRequestAt = null;
    const gc = shouldRunGc ? await runForcedGcCycle(gcPasses) : { requested: false, available: false, passes: 0 };
    return Response.json({ ok: true, action, gc, memory: getMemorySnapshot() });
  }

  if (action === 'status') {
    const gc = shouldRunGc ? await runForcedGcCycle(gcPasses) : { requested: false, available: false, passes: 0 };
    return Response.json({ ok: true, action, gc, state: { ...state }, memory: getMemorySnapshot() });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Use POST for action=request' }, { status: 405 });
  }

  const options = {
    depth: clampInt(url.searchParams.get('depth'), 250, 1, 10000),
    parallel: clampInt(url.searchParams.get('parallel'), 1, 1, 16),
    logEvery: clampInt(url.searchParams.get('logEvery'), 1, 1, 10000),
    stepDelayMs: clampInt(url.searchParams.get('stepDelayMs'), 0, 0, 1000),
    readyMode: getReadyMode(url.searchParams.get('ready')),
    mode: getMode(url.searchParams.get('mode')),
  };

  const before = getMemorySnapshot();
  const startedAt = Date.now();
  await runReproBatch(options);
  const after = getMemorySnapshot();
  const gc = shouldRunGc ? await runForcedGcCycle(gcPasses) : { requested: false, available: false, passes: 0 };
  const postGc = getMemorySnapshot();

  state.requests += 1;
  state.lastRequestAt = new Date().toISOString();

  return Response.json({
    ok: true,
    action: 'request',
    options,
    durationMs: Date.now() - startedAt,
    gc,
    state: { ...state },
    memory: {
      before,
      after,
      postGc,
      delta: getDelta(before, after),
      postGcDelta: getDelta(before, postGc),
    },
  });
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}
