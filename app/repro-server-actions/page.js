import { redirect } from 'next/navigation';
import { parseReproOptionsFromFormData, runReproScenario } from '../../lib/reproScenario.js';

export const dynamic = 'force-dynamic';

const PAGE_PATH = '/repro-server-actions';

function readNumericQuery(searchParams, key) {
  const value = searchParams?.[key];
  const scalar = Array.isArray(value) ? value[0] : value;
  const parsed = Number(scalar);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function ReproServerActionsPage({ searchParams }) {
  async function runReproServerAction(formData) {
    'use server';

    if (process.env.NODE_ENV === 'production') {
      redirect(PAGE_PATH);
    }

    const options = parseReproOptionsFromFormData(formData);
    const result = await runReproScenario(options);
    const query = new URLSearchParams({
      heapUsedStart: String(result.heapUsedStart),
      heapUsedEnd: String(result.heapUsedEnd),
    });
    redirect(`${PAGE_PATH}?${query.toString()}`);
  }

  const resolvedSearchParams =
    searchParams && typeof searchParams.then === 'function'
      ? await searchParams
      : (searchParams ?? {});

  const heapUsedStart = readNumericQuery(resolvedSearchParams, 'heapUsedStart');
  const heapUsedEnd = readNumericQuery(resolvedSearchParams, 'heapUsedEnd');
  const lastResult =
    heapUsedStart === null || heapUsedEnd === null
      ? {}
      : { heapUsedStart, heapUsedEnd };

  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 24 }}>
      <h1>Next.js Dev Server Actions repro</h1>
      <p>This page runs the shared console-heavy repro via a Server Action.</p>
      <form id="repro-action-form" action={runReproServerAction}>
        <button type="submit">Run Repro</button>
      </form>
      <pre id="repro-result">{JSON.stringify(lastResult ?? {})}</pre>
    </main>
  );
}
