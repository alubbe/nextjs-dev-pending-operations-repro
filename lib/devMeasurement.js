import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { getHeapSpaceStatistics, getHeapStatistics, writeHeapSnapshot } from 'node:v8';

const DEFAULT_OPTIONS = {
  settleMs: 10000,
  gc: true,
  gcPasses: 3,
  snapshot: false,
  includeSpaces: false,
};

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

function sanitizeLabel(raw) {
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function resolveSnapshotDir(raw) {
  if (!raw) {
    return path.join(tmpdir(), 'nextjs-dev-pending-operations-repro');
  }

  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function buildSnapshotPath(snapshotDir, snapshotLabel) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = snapshotLabel ? `-${snapshotLabel}` : '';
  return path.join(snapshotDir, `${timestamp}${suffix}.heapsnapshot`);
}

function collectMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const heapStats = getHeapStatistics();

  return {
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
    },
    heap: {
      totalHeapSize: heapStats.total_heap_size,
      totalHeapSizeExecutable: heapStats.total_heap_size_executable,
      totalPhysicalSize: heapStats.total_physical_size,
      totalAvailableSize: heapStats.total_available_size,
      usedHeapSize: heapStats.used_heap_size,
      heapSizeLimit: heapStats.heap_size_limit,
      mallocedMemory: heapStats.malloced_memory,
      peakMallocedMemory: heapStats.peak_malloced_memory,
      numberOfNativeContexts: heapStats.number_of_native_contexts,
      numberOfDetachedContexts: heapStats.number_of_detached_contexts,
    },
  };
}

function collectHeapSpaces() {
  return Object.fromEntries(
    getHeapSpaceStatistics().map(space => [
      space.space_name,
      {
        size: space.space_size,
        usedSize: space.space_used_size,
        availableSize: space.space_available_size,
        physicalSize: space.physical_space_size,
      },
    ]),
  );
}

async function runGc({ settleMs, gc, gcPasses }) {
  if (settleMs > 0) {
    await sleep(settleMs);
  }

  const gcAvailable = typeof globalThis.gc === 'function';
  let gcRuns = 0;

  if (gc && gcAvailable) {
    for (let i = 0; i < gcPasses; i++) {
      globalThis.gc();
      gcRuns += 1;
      await sleep(0);
    }
  }

  return {
    gcRequested: gc,
    gcAvailable,
    gcPassesRequested: gcPasses,
    gcPassesRun: gcRuns,
    settleMs,
  };
}

export function parseMeasurementOptions(searchParams) {
  return {
    settleMs: clampInt(searchParams.get('settleMs'), DEFAULT_OPTIONS.settleMs, 0, 600000),
    gc: parseBoolean(searchParams.get('gc'), DEFAULT_OPTIONS.gc),
    gcPasses: clampInt(searchParams.get('gcPasses'), DEFAULT_OPTIONS.gcPasses, 1, 20),
    snapshot: parseBoolean(searchParams.get('snapshot') ?? searchParams.get('dump'), DEFAULT_OPTIONS.snapshot),
    snapshotDir: resolveSnapshotDir(searchParams.get('snapshotDir')),
    snapshotLabel: sanitizeLabel(searchParams.get('snapshotLabel') ?? searchParams.get('label')),
    includeSpaces: parseBoolean(searchParams.get('spaces'), DEFAULT_OPTIONS.includeSpaces),
  };
}

export async function measureProcess(options) {
  const gc = await runGc(options);
  const measurement = collectMemoryUsage();
  const snapshotPath =
    options.snapshot === true ? await writeSnapshot(options.snapshotDir, options.snapshotLabel) : null;

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime() * 1000) / 1000,
    gc,
    ...measurement,
    snapshotPath,
    ...(options.includeSpaces ? { spaces: collectHeapSpaces() } : {}),
  };
}

async function writeSnapshot(snapshotDir, snapshotLabel) {
  await mkdir(snapshotDir, { recursive: true });
  const snapshotPath = buildSnapshotPath(snapshotDir, snapshotLabel);
  return writeHeapSnapshot(snapshotPath);
}
