export default function Page() {
  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 24 }}>
      <h1>Next.js Dev pendingOperations repro</h1>
      <p>Use <code>/repro-server-actions</code> (Server Action) or <code>/api/repro/next-dev-pending-operations</code> (API).</p>
      <p>
        Run <code>pnpm run repro:server-action</code> or <code>pnpm run repro:api</code> while <code>pnpm run dev</code>{' '}
        is running.
      </p>
    </main>
  );
}
