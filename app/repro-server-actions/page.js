import { redirect } from 'next/navigation';
import { parseReproOptionsFromFormData, runReproScenario } from '../../lib/reproScenario.js';

export const dynamic = 'force-dynamic';

const PAGE_PATH = '/repro-server-actions';

export default async function ReproServerActionsPage() {
  async function runReproServerAction(formData) {
    'use server';

    if (process.env.NODE_ENV === 'production') {
      redirect(PAGE_PATH);
    }

    const options = parseReproOptionsFromFormData(formData);
    await runReproScenario(options);
    redirect(PAGE_PATH);
  }

  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 24 }}>
      <h1>Next.js Dev Server Actions repro</h1>
      <p>This page runs the shared console-heavy repro via a Server Action.</p>
      <form id="repro-action-form" action={runReproServerAction}>
        <button type="submit">Run Repro</button>
      </form>
      <pre id="repro-result">{JSON.stringify({ ok: true })}</pre>
    </main>
  );
}
