# Next.js dev pendingOperations repro

Minimal reproducible example for suspected dev-mode memory retention in Next.js/React Server Actions async tracking (`pendingOperations`).

## Versions

- `next@16.1.6`
- `react@19.2.4`
- `react-dom@19.2.4`

## Run

```bash
pnpm install
pnpm run dev
```

This starts Next dev on `http://localhost:8136` with inspect + GC enabled.

## Reproduce drift

In another terminal:

```bash
pnpm run repro:server-action
# or
pnpm run repro:api
```

The script prints:

- `heapUsedStart`: heap after a reset + 3 forced GCs
- `heapUsedEnd`: heap after all repro requests + 3 forced GCs

Both values are taken from the Next dev process and can be compared directly.

## Repro surface

- `GET/POST /api/repro/next-dev-pending-operations`: API-driven repro path
- `GET /repro-server-actions`: page with a form-bound Server Action
- `POST /repro-server-actions`: form submission path used to invoke the Server Action

Both paths execute the same console-heavy async batch (`runReproBatch`).

The runner submits:

- `action`: `request`, `status`, `reset`
- `ready`: `race`, `event`, `none`
- `depth`, `parallel`, `logEvery`, `stepDelayMs`
- `gc`, `gcPasses`

## Notes

- No external API calls are used.
- No production keys are required.
- The Server Action page is intended for dev-mode repro only.
