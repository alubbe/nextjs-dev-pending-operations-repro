#!/usr/bin/env node

import { normalizeReproOptions } from '../lib/reproScenario.js';

const DEFAULT_CONFIG = {
  baseUrl: 'http://localhost:8136',
  driver: 'server-action',
  apiPath: '/api/repro/next-dev-pending-operations',
  serverActionPath: '/repro-server-actions',
};

const driver = process.env.REPRO_DRIVER === 'api' ? 'api' : DEFAULT_CONFIG.driver;
const baseUrl = (process.env.REPRO_BASE_URL || DEFAULT_CONFIG.baseUrl).replace(/\/$/, '');
const targetPath = normalizePath(
  process.env.REPRO_TARGET_PATH ||
    (driver === 'api'
      ? process.env.REPRO_API_PATH || DEFAULT_CONFIG.apiPath
      : process.env.REPRO_SERVER_ACTION_PATH || DEFAULT_CONFIG.serverActionPath),
);
const options = normalizeReproOptions({
  loops: process.env.REPRO_LOOPS,
  depth: process.env.REPRO_DEPTH,
  parallel: process.env.REPRO_PARALLEL,
  ready: process.env.REPRO_READY,
  logEvery: process.env.REPRO_LOG_EVERY,
  stepDelayMs: process.env.REPRO_STEP_DELAY_MS,
});
const requestPayload = {
  loops: options.loops,
  depth: options.depth,
  parallel: options.parallel,
  ready: options.readyMode,
  logEvery: options.logEvery,
  stepDelayMs: options.stepDelayMs,
};

const result = driver === 'api' ? await runViaApi() : await runViaServerAction();
console.log(`heapUsedStart ${numberOrZero(result.heapUsedStart)}`);
console.log(`heapUsedEnd ${numberOrZero(result.heapUsedEnd)}`);

async function runViaApi() {
  const url = new URL(`${baseUrl}${targetPath}`);
  for (const [key, value] of Object.entries(requestPayload)) {
    url.searchParams.set(key, String(value));
  }

  return fetchJson(url.toString(), { method: 'POST' });
}

async function runViaServerAction() {
  const descriptor = await discoverActionDescriptor(baseUrl, targetPath);
  const perActionPayload = { ...requestPayload, loops: 1 };
  let heapUsedStart = null;
  let heapUsedEnd = null;

  for (let i = 0; i < options.loops; i++) {
    const snapshot = await invokeAndReadSnapshot(descriptor, perActionPayload);
    if (heapUsedStart === null) {
      heapUsedStart = snapshot.heapUsedStart;
    }
    heapUsedEnd = snapshot.heapUsedEnd;
  }

  return {
    heapUsedStart: heapUsedStart ?? 0,
    heapUsedEnd: heapUsedEnd ?? 0,
  };
}

function normalizePath(value) {
  if (!value) return DEFAULT_CONFIG.serverActionPath;
  return value.startsWith('/') ? value : `/${value}`;
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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
    if (!name || !name.startsWith('$ACTION_')) continue;

    return {
      tokenName: name,
      tokenValue: getAttribute(input[0], 'value') ?? '',
      pagePath: actionPagePath,
    };
  }

  throw new Error(`Could not find server action hidden token in #repro-action-form at ${actionPagePath}`);
}

async function invokeServerAction(baseUrlValue, descriptor, payload) {
  const body = new FormData();
  body.set(descriptor.tokenName, descriptor.tokenValue);

  for (const [key, value] of Object.entries(payload)) {
    body.set(key, String(value));
  }

  const response = await fetch(`${baseUrlValue}${descriptor.pagePath}`, {
    method: 'POST',
    headers: {
      accept: 'text/html',
      origin: baseUrlValue,
      referer: `${baseUrlValue}${descriptor.pagePath}`,
    },
    redirect: 'manual',
    body,
  });

  if (response.status >= 300 && response.status < 400) {
    return {
      redirectLocation: response.headers.get('location'),
      html: '',
    };
  }

  if (response.ok) {
    return {
      redirectLocation: '',
      html: await response.text(),
    };
  }

  const text = await response.text();
  throw new Error(`HTTP ${response.status} while invoking server action\n${text}`);
}

async function invokeAndReadSnapshot(descriptor, payload) {
  const { redirectLocation, html } = await invokeServerAction(baseUrl, descriptor, payload);
  let snapshot = parseReproResultFromLocation(redirectLocation);
  if (!snapshot && html) {
    snapshot = parseReproResultFromHtml(html);
  }
  if (!snapshot) {
    const fallbackPath = redirectLocation
      ? `${new URL(redirectLocation, baseUrl).pathname}${new URL(redirectLocation, baseUrl).search}`
      : targetPath;
    snapshot = await fetchReproResult(baseUrl, fallbackPath);
  }
  if (typeof snapshot.heapUsedStart !== 'number' || typeof snapshot.heapUsedEnd !== 'number') {
    throw new Error(`Server Action did not produce a repro result at ${targetPath}`);
  }

  return snapshot;
}

async function fetchReproResult(baseUrlValue, actionPagePath) {
  const html = await fetchText(`${baseUrlValue}${actionPagePath}`);
  const result = parseReproResultFromHtml(html);
  if (!result) {
    throw new Error(`Could not find #repro-result at ${actionPagePath}`);
  }

  return result;
}

function parseReproResultFromHtml(html) {
  const match = html.match(/<pre[^>]*id=(["'])repro-result\1[^>]*>([\s\S]*?)<\/pre>/i);
  if (!match) {
    return null;
  }

  const payload = decodeHtml(match[2]);
  try {
    return payload ? JSON.parse(payload) : {};
  } catch (error) {
    throw new Error(`Invalid JSON in #repro-result: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseReproResultFromLocation(location) {
  if (!location) return null;

  const url = new URL(location, baseUrl);
  const heapUsedStart = Number(url.searchParams.get('heapUsedStart'));
  const heapUsedEnd = Number(url.searchParams.get('heapUsedEnd'));

  if (!Number.isFinite(heapUsedStart) || !Number.isFinite(heapUsedEnd)) {
    return null;
  }

  return { heapUsedStart, heapUsedEnd };
}

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}\n${text}`);
  }

  return text;
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
