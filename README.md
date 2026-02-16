# Next.js dev pendingOperations repro

Minimal reproducible example for suspected dev-mode memory retention in Next.js/React Server Components async tracking (`pendingOperations`).

## Versions

- `next@16.1.6`
- `react@19.2.4`
- `react-dom@19.2.4`

## Run

```bash
npm install
npm run dev
```

This starts Next dev on `http://localhost:8136` with `--expose-gc`.

## Reproduce drift

In another terminal:

```bash
npm run repro:noop
```

The script prints:

- `routeHeapDelta`: per-request heap delta from the route response
- `postGcHeap`: heap after forced GC status check
- `baselineDelta`: current post-GC heap minus initial post-GC baseline

If the issue reproduces, `baselineDelta` trends upward over loops.

## API endpoint

- `GET/POST /api/repro/next-dev-pending-operations`

Query params:

- `action`: `request` (default), `status`, `reset`
- `mode`: `noop` or `console`
- `ready`: `race`, `event`, `none`
- `depth`: async steps per sequence (default `250`)
- `parallel`: number of concurrent sequences (default `1`)
- `logEvery`: console frequency in `console` mode
- `stepDelayMs`: optional delay per step (default `0`)
- `gc=1&gcPasses=N`: force GC on `status/reset`

## Notes

- No external API calls are used.
- No production keys are required.
- The route is disabled in production (`404`).
