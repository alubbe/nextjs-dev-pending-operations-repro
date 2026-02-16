#!/usr/bin/env node

const [
  baseUrlArg = 'http://localhost:8136',
  loopsArg = '40',
  depthArg = '250',
  parallelArg = '1',
  modeArg = 'noop',
  readyArg = 'race',
  logEveryArg = '1',
  stepDelayMsArg = '0',
  gcPassesArg = '10',
] = process.argv.slice(2);

const baseUrl = baseUrlArg.replace(/\/$/, '');
const loops = asInt(loopsArg, 40, 1, 5000);
const depth = asInt(depthArg, 250, 1, 10000);
const parallel = asInt(parallelArg, 1, 1, 32);
const logEvery = asInt(logEveryArg, 1, 1, 100000);
const stepDelayMs = asInt(stepDelayMsArg, 0, 0, 1000);
const gcPasses = asInt(gcPassesArg, 10, 1, 100);
const mode = modeArg === 'console' ? 'console' : 'noop';
const ready = readyArg === 'event' || readyArg === 'none' ? readyArg : 'race';

await fetchJson(`${baseUrl}/api/repro/next-dev-pending-operations?action=reset&gc=1&gcPasses=${gcPasses}`, {
  method: 'POST',
});

const baseline = await fetchJson(
  `${baseUrl}/api/repro/next-dev-pending-operations?action=status&gc=1&gcPasses=${gcPasses}`,
);
const baselineHeap = numberOrZero(baseline?.memory?.heapUsed);
let previousHeap = baselineHeap;

console.log('loop durationMs routeHeapDelta postGcHeapDelta postGcHeap baselineDelta');

for (let i = 1; i <= loops; i++) {
  const startedAt = Date.now();
  const request = await fetchJson(
    `${baseUrl}/api/repro/next-dev-pending-operations?action=request` +
      `&mode=${encodeURIComponent(mode)}` +
      `&ready=${encodeURIComponent(ready)}` +
      `&depth=${depth}` +
      `&parallel=${parallel}` +
      `&logEvery=${logEvery}` +
      `&stepDelayMs=${stepDelayMs}`,
    { method: 'POST' },
  );

  const elapsedMs = Date.now() - startedAt;
  const status = await fetchJson(
    `${baseUrl}/api/repro/next-dev-pending-operations?action=status&gc=1&gcPasses=${gcPasses}`,
  );

  const postGcHeap = numberOrZero(status?.memory?.heapUsed);
  const routeHeapDelta = numberOrZero(request?.memory?.delta?.heapUsed);
  const postGcHeapDelta = postGcHeap - previousHeap;
  const baselineDelta = postGcHeap - baselineHeap;

  console.log(`${i} ${elapsedMs} ${routeHeapDelta} ${postGcHeapDelta} ${postGcHeap} ${baselineDelta}`);
  previousHeap = postGcHeap;
}

function asInt(raw, fallback, min, max) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
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

  return payload;
}
