import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PAGE_PATH = '/repro-server-actions';
const BATCHES = 400;
const DEPTH = 250;
const LOG_EVERY = 250;

async function runAsyncWork() {
  for (let batch = 0; batch < BATCHES; batch++) {
    for (let step = 1; step <= DEPTH; step++) {
      await Promise.resolve();
      await new Promise((resolve) => setImmediate(resolve));

      if (step % LOG_EVERY === 0) {
        console.debug('[redirect-repro] batch=%d step=%d', batch + 1, step);
      }
    }
  }
}

export default function ReproServerActionsPage() {
  async function runReproServerAction() {
    'use server';

    await runAsyncWork();
    redirect(PAGE_PATH);
  }

  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 24 }}>
      <h1>Next.js dev redirect leak repro</h1>
      <p>
        This page has one non-fetch Server Action. The action creates a large async chain and then
        redirects back to this page.
      </p>
      <p>
        Use <code>pnpm run repro</code> to do one warm GET and then repeated POST-only action
        invocations without following the redirect.
      </p>
      <form id="repro-action-form" action={runReproServerAction}>
        <button type="submit">Run Repro</button>
      </form>
    </main>
  );
}
