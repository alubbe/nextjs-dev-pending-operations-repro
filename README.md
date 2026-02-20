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

## Run benchmark

In another terminal:

```bash
pnpm run repro:server-action
# or
pnpm run repro:api
```

Both scripts run the same shared repro workload. Success is exit code `0`.

## Repro surface

- `POST /api/repro/next-dev-pending-operations`: tiny API wrapper
- `POST /repro-server-actions`: tiny Server Action wrapper

Both wrappers call `runReproScenario` in `lib/reproScenario.js`.

## Notes

- No external API calls are used.
- No production keys are required.
- The Server Action page is intended for dev-mode repro only.
