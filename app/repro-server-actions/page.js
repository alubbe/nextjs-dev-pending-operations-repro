import { redirect } from 'next/navigation';
import { runReproBatch } from '../../lib/reproRunner.js';

export const dynamic = 'force-dynamic';

const STATE_KEY = Symbol.for('nextjs-repro.server-actions.state');
const PAGE_PATH = '/repro-server-actions';
const DEFAULT_GC_PASSES = 3;

function getState() {
  const existing = globalThis[STATE_KEY];
  if (existing && typeof existing.requests === 'number') {
    return existing;
  }

  const state = { requests: 0, lastRequestAt: null, lastResult: null };
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
  if (raw === null || raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function getBool(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
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

function noGcResult() {
  return { requested: false, available: false, passes: 0 };
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

function getStateSnapshot(state) {
  return {
    requests: state.requests,
    lastRequestAt: state.lastRequestAt,
    lastResult: state.lastResult,
    memory: getMemorySnapshot(),
  };
}

export default function ReproServerActionsPage() {
  async function runReproServerAction(formData) {
    'use server';

    if (process.env.NODE_ENV === 'production') {
      redirect(PAGE_PATH);
    }

    const state = getState();
    const action = String(formData.get('action') ?? 'request');
    const gcPasses = clampInt(formData.get('gcPasses'), DEFAULT_GC_PASSES, 1, 100);
    const shouldRunGc = getBool(formData.get('gc'), action !== 'request');

    if (action === 'reset') {
      state.requests = 0;
      state.lastRequestAt = null;
      const gc = shouldRunGc ? await runForcedGcCycle(gcPasses) : noGcResult();

      state.lastResult = {
        ok: true,
        action,
        gc,
        state: { requests: state.requests, lastRequestAt: state.lastRequestAt },
        memory: getMemorySnapshot(),
      };

      redirect(PAGE_PATH);
    }

    if (action === 'status') {
      const gc = shouldRunGc ? await runForcedGcCycle(gcPasses) : noGcResult();

      state.lastResult = {
        ok: true,
        action,
        gc,
        state: { requests: state.requests, lastRequestAt: state.lastRequestAt },
        memory: getMemorySnapshot(),
      };

      redirect(PAGE_PATH);
    }

    const options = {
      depth: clampInt(formData.get('depth'), 250, 1, 10000),
      parallel: clampInt(formData.get('parallel'), 1, 1, 16),
      logEvery: clampInt(formData.get('logEvery'), 1, 1, 10000),
      stepDelayMs: clampInt(formData.get('stepDelayMs'), 0, 0, 1000),
      readyMode: getReadyMode(formData.get('ready')),
      mode: getMode(formData.get('mode')),
    };

    const before = getMemorySnapshot();
    const startedAt = Date.now();
    await runReproBatch(options);
    const after = getMemorySnapshot();
    const gc = shouldRunGc ? await runForcedGcCycle(gcPasses) : noGcResult();
    const postGc = getMemorySnapshot();

    state.requests += 1;
    state.lastRequestAt = new Date().toISOString();
    state.lastResult = {
      ok: true,
      action: 'request',
      options,
      durationMs: Date.now() - startedAt,
      gc,
      state: { requests: state.requests, lastRequestAt: state.lastRequestAt },
      memory: {
        before,
        after,
        postGc,
        delta: getDelta(before, after),
        postGcDelta: getDelta(before, postGc),
      },
    };

    redirect(PAGE_PATH);
  }

  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 24 }}>
      <h1>Next.js Dev Server Actions repro</h1>
      <p>Workload runs via a real form-bound Server Action on this page.</p>
      <form id="repro-action-form" action={runReproServerAction}>
        <button type="submit">Invoke repro action</button>
      </form>
      <pre id="repro-state">{JSON.stringify(getStateSnapshot(getState()))}</pre>
    </main>
  );
}
