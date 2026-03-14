#!/usr/bin/env node

import { runReproRequest } from './repro-loop.mjs';

const DEFAULTS = {
  baseUrl: 'http://localhost:8136',
  statusPath: '/api/repro/next-dev-pending-operations',
  runs: 1,
  settleMs: 10000,
  gcPasses: 3,
  measureOnly: false,
  snapshot: false,
  snapshotEvery: false,
  afterEach: false,
  labelPrefix: '',
};

const config = {
  baseUrl: (process.env.REPRO_BASE_URL || DEFAULTS.baseUrl).replace(/\/$/, ''),
  statusPath: normalizePath(process.env.REPRO_STATUS_PATH || DEFAULTS.statusPath),
  runs: clampInt(process.env.REPRO_MEASURE_RUNS, DEFAULTS.runs, 0, 1000),
  settleMs: clampInt(process.env.REPRO_MEASURE_SETTLE_MS, DEFAULTS.settleMs, 0, 600000),
  gcPasses: clampInt(process.env.REPRO_MEASURE_GC_PASSES, DEFAULTS.gcPasses, 1, 20),
  measureOnly: parseBoolean(process.env.REPRO_MEASURE_ONLY, DEFAULTS.measureOnly),
  snapshot: parseBoolean(process.env.REPRO_MEASURE_SNAPSHOT, DEFAULTS.snapshot),
  snapshotEvery: parseBoolean(process.env.REPRO_MEASURE_SNAPSHOT_EVERY, DEFAULTS.snapshotEvery),
  afterEach: parseBoolean(process.env.REPRO_MEASURE_AFTER_EACH, DEFAULTS.afterEach),
  labelPrefix: sanitizeLabel(process.env.REPRO_MEASURE_LABEL_PREFIX || DEFAULTS.labelPrefix),
};

const baseline = await takeMeasurement('baseline', { snapshot: config.snapshot });
printMeasurement(baseline);

if (!config.measureOnly) {
  for (let i = 0; i < config.runs; i++) {
    console.log(`run ${i + 1}/${config.runs}`);
    await runReproRequest();

    const shouldMeasureNow = config.afterEach || i === config.runs - 1;
    if (!shouldMeasureNow) continue;

    const label = `after-run-${i + 1}`;
    const measurement = await takeMeasurement(label, {
      snapshot: config.snapshot && (config.snapshotEvery || i === config.runs - 1),
    });
    printMeasurement(measurement, baseline);
  }
}

async function takeMeasurement(label, { snapshot }) {
  const url = new URL(`${config.baseUrl}${config.statusPath}`);
  url.searchParams.set('action', 'status');
  url.searchParams.set('gc', '1');
  url.searchParams.set('gcPasses', String(config.gcPasses));
  url.searchParams.set('settleMs', String(config.settleMs));

  if (snapshot) {
    url.searchParams.set('snapshot', '1');
  }

  const snapshotLabel = sanitizeLabel([config.labelPrefix, label].filter(Boolean).join('-'));
  if (snapshotLabel) {
    url.searchParams.set('snapshotLabel', snapshotLabel);
  }

  const response = await fetch(url.toString());
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

  return {
    label,
    ...payload,
  };
}

function printMeasurement(measurement, baseline = null) {
  const deltaHeapUsed =
    baseline && baseline.memory ? measurement.memory.heapUsed - baseline.memory.heapUsed : null;
  const deltaPhysical =
    baseline && baseline.heap ? measurement.heap.totalPhysicalSize - baseline.heap.totalPhysicalSize : null;

  console.log(
    [
      measurement.label,
      `heapUsed=${formatMiB(measurement.memory.heapUsed)}`,
      `rss=${formatMiB(measurement.memory.rss)}`,
      `totalPhysical=${formatMiB(measurement.heap.totalPhysicalSize)}`,
      deltaHeapUsed === null ? null : `deltaHeapUsed=${formatSignedMiB(deltaHeapUsed)}`,
      deltaPhysical === null ? null : `deltaPhysical=${formatSignedMiB(deltaPhysical)}`,
      `nativeContexts=${measurement.heap.numberOfNativeContexts}`,
      `detachedContexts=${measurement.heap.numberOfDetachedContexts}`,
      measurement.snapshotPath ? `snapshot=${measurement.snapshotPath}` : null,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function clampInt(raw, fallback, min, max) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function parseBoolean(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  return fallback;
}

function normalizePath(value) {
  if (!value) return DEFAULTS.statusPath;
  return value.startsWith('/') ? value : `/${value}`;
}

function sanitizeLabel(raw) {
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function formatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MiB`;
}

function formatSignedMiB(bytes) {
  const value = (bytes / (1024 * 1024)).toFixed(1);
  return `${bytes >= 0 ? '+' : ''}${value}MiB`;
}
