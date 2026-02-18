#!/usr/bin/env node

const [
  baseUrlArg = 'http://localhost:8136',
  loopsArg = '400',
  depthArg = '250',
  parallelArg = '1',
  modeArg = 'noop',
  readyArg = 'race',
  logEveryArg = '1',
  stepDelayMsArg = '0',
  gcPassesArg = '3',
] = process.argv.slice(2);

const baseUrl = baseUrlArg.replace(/\/$/, '');
const loops = asInt(loopsArg, 400, 1, 5000);
const depth = asInt(depthArg, 250, 1, 10000);
const parallel = asInt(parallelArg, 1, 1, 32);
const logEvery = asInt(logEveryArg, 1, 1, 100000);
const stepDelayMs = asInt(stepDelayMsArg, 0, 0, 1000);
const gcPasses = asInt(gcPassesArg, 3, 1, 100);
const mode = modeArg === 'console' ? 'console' : 'noop';
const ready = readyArg === 'event' || readyArg === 'none' ? readyArg : 'race';

await fetchJson(`${baseUrl}/api/repro/next-dev-pending-operations?action=reset&gc=1&gcPasses=${gcPasses}`, {
  method: 'POST',
});

const baseline = await fetchJson(
  `${baseUrl}/api/repro/next-dev-pending-operations?action=status&gc=1&gcPasses=${gcPasses}`,
);
const baselineHeap = numberOrZero(baseline?.memory?.heapUsed);
console.log(`heapUsedStart ${baselineHeap}`);

for (let i = 1; i <= loops; i++) {
  await fetchJson(
    `${baseUrl}/api/repro/next-dev-pending-operations?action=request` +
      `&mode=${encodeURIComponent(mode)}` +
      `&ready=${encodeURIComponent(ready)}` +
      `&depth=${depth}` +
      `&parallel=${parallel}` +
      `&logEvery=${logEvery}` +
      `&stepDelayMs=${stepDelayMs}`,
    { method: 'POST' },
  );
}

const finalStatus = await fetchJson(
  `${baseUrl}/api/repro/next-dev-pending-operations?action=status&gc=1&gcPasses=${gcPasses}`,
);
const finalHeap = numberOrZero(finalStatus?.memory?.heapUsed);
console.log(`heapUsedEnd ${finalHeap}`);

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
