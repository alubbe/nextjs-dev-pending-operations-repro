# Next.js dev pendingOperations repro

Minimal repro focused on one console-heavy async workload, exposed through:

- an API route wrapper
- a Server Action wrapper

## Versions

- `next@16.1.6`
- `react@19.2.4`
- `react-dom@19.2.4`

## Run

```bash
pnpm install
pnpm run dev
```

This starts Next dev on `http://localhost:8136` with `--expose-gc`.

## Reproduce drift

In another terminal:

```bash
pnpm run repro:server-action
# or
pnpm run repro:api
```

Both scripts print:

- `ok true`

The status output comes from the same shared repro execution path.

## Forced GC measurement

To measure the leaking dev process itself, the API wrapper now exposes a dev-only status action that can:

- wait for async follow-up work to settle
- force GC a configurable number of times
- report heap stats
- optionally write a `.heapsnapshot` file

The defaults match the current workflow: `settleMs=10000` and `gcPasses=3`.

Examples:

```bash
pnpm run repro:measure:status
REPRO_MEASURE_RUNS=3 pnpm run repro:server-action:measure
REPRO_MEASURE_RUNS=3 REPRO_MEASURE_SNAPSHOT=1 pnpm run repro:server-action:measure
```

Snapshots are written under the OS temp dir in `nextjs-dev-pending-operations-repro/`.

## Repro surface

- `POST /api/repro/next-dev-pending-operations`: tiny API wrapper
- `GET /api/repro/next-dev-pending-operations?action=status`: dev-only settle + GC + measure endpoint
- `POST /repro-server-actions`: tiny Server Action wrapper

Both wrappers call `runReproScenario` in `lib/reproScenario.js`.

## Notes

- No external API calls are used.
- No production keys are required.
- The Server Action page is intended for dev-mode repro only.
