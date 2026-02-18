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
  pagePathArg = '/repro-server-actions',
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
const pagePath = normalizePagePath(pagePathArg);

const descriptor = await discoverActionDescriptor(baseUrl, pagePath);

await invokeServerAction(baseUrl, descriptor, {
  action: 'reset',
  gc: '1',
  gcPasses,
});

const baseline = await fetchReproState(baseUrl, pagePath);
const baselineHeap = readHeapUsed(baseline);
console.log(`heapUsedStart ${baselineHeap}`);

for (let i = 1; i <= loops; i++) {
  await invokeServerAction(baseUrl, descriptor, {
    action: 'request',
    mode,
    ready,
    depth,
    parallel,
    logEvery,
    stepDelayMs,
  });
}

await invokeServerAction(baseUrl, descriptor, {
  action: 'status',
  gc: '1',
  gcPasses,
});

const finalStatus = await fetchReproState(baseUrl, pagePath);
const finalHeap = readHeapUsed(finalStatus);
console.log(`heapUsedEnd ${finalHeap}`);

function normalizePagePath(value) {
  if (!value) return '/repro-server-actions';
  return value.startsWith('/') ? value : `/${value}`;
}

function asInt(raw, fallback, min, max) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readHeapUsed(snapshot) {
  const fromLastResult = snapshot?.lastResult?.memory?.heapUsed;
  if (typeof fromLastResult === 'number') {
    return numberOrZero(fromLastResult);
  }

  return numberOrZero(snapshot?.memory?.heapUsed);
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  if (!match) return null;
  return decodeHtml(match[1] ?? match[2] ?? '');
}

function decodeHtml(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function discoverActionDescriptor(baseUrlValue, actionPagePath) {
  const html = await fetchText(`${baseUrlValue}${actionPagePath}`);
  const formMatch = html.match(/<form[^>]*id=(["'])repro-action-form\1[^>]*>([\s\S]*?)<\/form>/i);

  if (!formMatch) {
    throw new Error(`Could not find #repro-action-form at ${actionPagePath}`);
  }

  const formHtml = formMatch[2];
  const hiddenInputs = [...formHtml.matchAll(/<input\b[^>]*>/gi)].filter(match => {
    const type = getAttribute(match[0], 'type');
    return type === 'hidden';
  });

  for (const input of hiddenInputs) {
    const name = getAttribute(input[0], 'name');
    if (!name || !name.startsWith('$ACTION_')) {
      continue;
    }

    return {
      tokenName: name,
      tokenValue: getAttribute(input[0], 'value') ?? '',
      pagePath: actionPagePath,
    };
  }

  throw new Error(`Could not find server action hidden token in #repro-action-form at ${actionPagePath}`);
}

async function invokeServerAction(baseUrlValue, descriptor, payload) {
  const body = new URLSearchParams();
  body.set(descriptor.tokenName, descriptor.tokenValue);

  for (const [key, value] of Object.entries(payload)) {
    body.set(key, String(value));
  }

  const response = await fetch(`${baseUrlValue}${descriptor.pagePath}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: baseUrlValue,
    },
    redirect: 'manual',
    body: body.toString(),
  });

  if (response.ok || response.status === 303) {
    return;
  }

  const text = await response.text();
  throw new Error(`HTTP ${response.status} while invoking server action\n${text}`);
}

async function fetchReproState(baseUrlValue, actionPagePath) {
  const html = await fetchText(`${baseUrlValue}${actionPagePath}`);
  const match = html.match(/<pre[^>]*id=(["'])repro-state\1[^>]*>([\s\S]*?)<\/pre>/i);
  if (!match) {
    throw new Error(`Could not find #repro-state at ${actionPagePath}`);
  }

  const payload = decodeHtml(match[2]);
  try {
    return payload ? JSON.parse(payload) : {};
  } catch (error) {
    throw new Error(`Invalid JSON in #repro-state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}\n${text}`);
  }

  return text;
}
