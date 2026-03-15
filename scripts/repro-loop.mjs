#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_CONFIG = {
  baseUrl: 'http://localhost:8136',
  driver: 'server-action',
  apiPath: '/api/repro/next-dev-pending-operations',
  serverActionPath: '/repro-server-actions',
};

const driver = process.env.REPRO_DRIVER === 'api' ? 'api' : DEFAULT_CONFIG.driver;
export const baseUrl = (process.env.REPRO_BASE_URL || DEFAULT_CONFIG.baseUrl).replace(/\/$/, '');
export const targetPath = normalizePath(
  process.env.REPRO_TARGET_PATH ||
    (driver === 'api'
      ? process.env.REPRO_API_PATH || DEFAULT_CONFIG.apiPath
      : process.env.REPRO_SERVER_ACTION_PATH || DEFAULT_CONFIG.serverActionPath),
);
export const options = Object.fromEntries(
  [
    ['loops', process.env.REPRO_LOOPS],
    ['depth', process.env.REPRO_DEPTH],
    ['parallel', process.env.REPRO_PARALLEL],
    ['ready', process.env.REPRO_READY],
    ['logEvery', process.env.REPRO_LOG_EVERY],
    ['stepDelayMs', process.env.REPRO_STEP_DELAY_MS],
  ].filter(([, value]) => value !== undefined && value !== null && value !== ''),
);

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = await runReproRequest();
  console.log(`ok ${result.ok === true ? 'true' : 'false'}`);
}

export async function runReproRequest() {
  return driver === 'api' ? runViaApi() : runViaServerAction();
}

async function runViaApi() {
  const url = new URL(`${baseUrl}${targetPath}`);
  for (const [key, value] of Object.entries(options)) {
    url.searchParams.set(key, String(value));
  }

  const payload = await fetchJson(url.toString(), { method: 'POST' });
  if (payload.ok !== true) {
    throw new Error(`API did not return ok=true for ${url}`);
  }

  return { ok: true };
}

async function runViaServerAction() {
  const descriptor = await discoverActionDescriptor(baseUrl, targetPath);
  await invokeServerAction(baseUrl, descriptor, options);
  return { ok: true };
}

export function normalizePath(value) {
  if (!value) return DEFAULT_CONFIG.serverActionPath;
  return value.startsWith('/') ? value : `/${value}`;
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

export async function discoverActionDescriptor(baseUrlValue, actionPagePath) {
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

export async function invokeServerAction(baseUrlValue, descriptor, payload) {
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
    return;
  }

  if (response.ok) {
    return;
  }

  const text = await response.text();
  throw new Error(`HTTP ${response.status} while invoking server action\n${text}`);
}

export async function fetchText(url, init) {
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
