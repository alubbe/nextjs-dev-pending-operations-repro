#!/usr/bin/env node

const baseUrl = (process.env.REPRO_BASE_URL || 'http://localhost:8136').replace(/\/$/, '');
const pagePath = normalizePath(process.env.REPRO_PAGE_PATH || '/repro-server-actions');
const runs = clampInt(process.env.REPRO_RUNS, 1, 1, 1000);

const descriptor = await discoverActionDescriptor();

for (let i = 1; i <= runs; i++) {
  const response = await invokeServerAction(descriptor);
  const location = response.headers.get('location');

  console.log(
    [
      `run ${i}/${runs}`,
      `status=${response.status}`,
      location ? `location=${location}` : null,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

async function discoverActionDescriptor() {
  const html = await fetchText(`${baseUrl}${pagePath}`);
  const formMatch = html.match(/<form[^>]*id=(["'])repro-action-form\1[^>]*>([\s\S]*?)<\/form>/i);

  if (!formMatch) {
    throw new Error(`Could not find #repro-action-form at ${pagePath}`);
  }

  for (const match of formMatch[2].matchAll(/<input\b[^>]*>/gi)) {
    const type = getAttribute(match[0], 'type');
    const name = getAttribute(match[0], 'name');

    if (type !== 'hidden' || !name || !name.startsWith('$ACTION_')) {
      continue;
    }

    return {
      tokenName: name,
      tokenValue: getAttribute(match[0], 'value') ?? '',
    };
  }

  throw new Error(`Could not find a server action token in #repro-action-form at ${pagePath}`);
}

async function invokeServerAction(descriptor) {
  const body = new FormData();
  body.set(descriptor.tokenName, descriptor.tokenValue);

  const response = await fetch(`${baseUrl}${pagePath}`, {
    method: 'POST',
    headers: {
      accept: 'text/html',
      origin: baseUrl,
      referer: `${baseUrl}${pagePath}`,
    },
    redirect: 'manual',
    body,
  });

  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  const text = await response.text();
  throw new Error(`Expected a redirect from ${pagePath}, got HTTP ${response.status}\n${text}`);
}

async function fetchText(url) {
  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}\n${text}`);
  }

  return text;
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

function normalizePath(value) {
  return value.startsWith('/') ? value : `/${value}`;
}

function clampInt(raw, fallback, min, max) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
