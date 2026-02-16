export default function Page() {
  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 24 }}>
      <h1>Next.js Dev pendingOperations repro</h1>
      <p>Use <code>/api/repro/next-dev-pending-operations</code>.</p>
      <p>Run <code>npm run repro:noop</code> while <code>npm run dev</code> is running.</p>
    </main>
  );
}
