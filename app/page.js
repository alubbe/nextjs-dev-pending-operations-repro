import Link from 'next/link';

export default function Page() {
  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 24 }}>
      <h1>Next.js dev redirect leak repro</h1>
      <p>
        Start <code>pnpm run dev</code>, connect Node DevTools on port <code>9229</code>, then run{' '}
        <code>pnpm run repro</code>.
      </p>
      <p>
        The driver does one initial page GET to discover the action token, then repeated POST-only
        Server Action calls with <code>redirect: &apos;manual&apos;</code>.
      </p>
      <p>
        <Link href="/repro-server-actions">Open the repro page</Link>
      </p>
    </main>
  );
}
