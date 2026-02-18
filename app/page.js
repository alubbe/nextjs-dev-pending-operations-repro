export default function Page() {
  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 24 }}>
      <h1>Next.js Dev pendingOperations repro</h1>
      <p>Use <code>/repro-server-actions</code> for the Server Action repro surface.</p>
      <p>Run <code>npm run repro:noop</code> while <code>npm run dev</code> is running.</p>
    </main>
  );
}
