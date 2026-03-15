#!/usr/bin/env node

import {
  baseUrl,
  discoverActionDescriptor,
  fetchText,
  invokeServerAction,
  options,
  targetPath,
} from './repro-loop.mjs';

const DEFAULTS = {
  phase: 'get-only',
  runs: 5,
  settleMs: 10000,
  gcPasses: 3,
  statusPath: '/api/repro/next-dev-pending-operations',
};

const phase = getPhase(process.env.REPRO_SERVER_ACTION_PHASE || DEFAULTS.phase);
const runs = clampInt(process.env.REPRO_PHASE_RUNS, DEFAULTS.runs, 1, 1000);
const settleMs = clampInt(
  process.env.REPRO_MEASURE_SETTLE_MS,
  DEFAULTS.settleMs,
  0,
  600000,
);
const gcPasses = clampInt(
  process.env.REPRO_MEASURE_GC_PASSES,
  DEFAULTS.gcPasses,
  1,
  20,
);
const statusPath = normalizeStatusPath(
  process.env.REPRO_STATUS_PATH || DEFAULTS.statusPath,
);

const warmedState = await warmPhase();
const baseline = await takeMeasurement(`baseline-${phase}`);
printMeasurement(baseline);

for (let i = 1; i <= runs; i++) {
  await runPhaseIteration(warmedState);
  const measurement = await takeMeasurement(`after-${phase}-${i}`);
  printMeasurement(measurement, baseline);
}

async function warmPhase() {
  if (phase === 'get-only') {
    await fetchText(`${baseUrl}${targetPath}`);
    return null;
  }

  return discoverActionDescriptor(baseUrl, targetPath);
}

async function runPhaseIteration(warmedState) {
  if (phase === 'get-only') {
    await fetchText(`${baseUrl}${targetPath}`);
    return;
  }

  await invokeServerAction(baseUrl, warmedState, options);
}

async function takeMeasurement(label) {
  const url = new URL(`${baseUrl}${statusPath}`);
  url.searchParams.set('action', 'status');
  url.searchParams.set('gc', '1');
  url.searchParams.set('gcPasses', String(gcPasses));
  url.searchParams.set('settleMs', String(settleMs));

  const response = await fetch(url);
  const text = await response.text();

  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}\n${text}`);
  }

  return { label, ...payload };
}

function printMeasurement(measurement, baseline = null) {
  const deltaHeapUsed =
    baseline && baseline.memory
      ? measurement.memory.heapUsed - baseline.memory.heapUsed
      : null;

  console.log(
    [
      measurement.label,
      `heapUsed=${formatMiB(measurement.memory.heapUsed)}`,
      `rss=${formatMiB(measurement.memory.rss)}`,
      deltaHeapUsed === null
        ? null
        : `deltaHeapUsed=${formatSignedMiB(deltaHeapUsed)}`,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function getPhase(value) {
  return value === 'post-only' ? 'post-only' : 'get-only';
}

function clampInt(raw, fallback, min, max) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function normalizeStatusPath(value) {
  if (!value) return DEFAULTS.statusPath;
  return value.startsWith('/') ? value : `/${value}`;
}

function formatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MiB`;
}

function formatSignedMiB(bytes) {
  const value = (bytes / (1024 * 1024)).toFixed(1);
  return `${bytes >= 0 ? '+' : ''}${value}MiB`;
}
