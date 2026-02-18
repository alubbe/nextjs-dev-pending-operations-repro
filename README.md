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
pnpm run repro:noop
```

The script prints:

- `heapUsedStart`: heap after a reset + 3 forced GCs
- `heapUsedEnd`: heap after all repro requests + 3 forced GCs

Both values are taken from the Next dev process and can be compared directly.

## Repro surface

- `GET /repro-server-actions`: page with a form-bound Server Action
- `POST /repro-server-actions`: form submission path used to invoke the Server Action

The runner script discovers the hidden action token from the page, then submits:

- `action`: `request`, `status`, `reset`
- `mode`: `noop` or `console`
- `ready`: `race`, `event`, `none`
- `depth`, `parallel`, `logEvery`, `stepDelayMs`
- `gc`, `gcPasses`

## Notes

- No external API calls are used.
- No production keys are required.
- The Server Action page is intended for dev-mode repro only.
