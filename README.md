# Next.js dev redirect leak repro

This repo isolates one case:

- a non-fetch Server Action in dev mode
- the action creates a large async chain
- the action ends with `redirect('/repro-server-actions')`

There is no API route, no custom measurement endpoint, and no patching of Next or React.

## Versions

- `next@16.1.6`
- `react@19.2.4`
- `react-dom@19.2.4`

## Run

```bash
pnpm install
pnpm run dev
```

This starts Next dev on `http://localhost:8136` with the Node inspector on `127.0.0.1:9229`.

In another terminal:

```bash
pnpm run repro
REPRO_RUNS=3 pnpm run repro
```

The driver does:

1. one initial `GET /repro-server-actions` to discover the hidden action token
2. repeated `POST /repro-server-actions` calls with `redirect: 'manual'`

That avoids the unrelated dev-only memory growth caused by re-rendering the page after every
redirect.

## Manual repro flow

1. Start `pnpm run dev`.
2. Connect Chrome DevTools to the Node process on port `9229`.
3. Run `pnpm run repro`.
4. Wait about 10 seconds for async follow-up work to settle.
5. Force GC a few times and take a heap snapshot.
6. Run `REPRO_RUNS=3 pnpm run repro`.
7. Wait about 10 seconds again, force GC a few times, and take another heap snapshot.

The leak should show up after the redirected action runs, without needing to reload the page in a
browser after each redirect.
