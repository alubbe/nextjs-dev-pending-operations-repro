import { measureProcess, parseMeasurementOptions } from '../../../../lib/devMeasurement.js';
import { parseReproOptionsFromSearchParams, runReproScenario } from '../../../../lib/reproScenario.js';

export const dynamic = 'force-dynamic';

function getPendingOperationsHelper(action) {
  switch (action) {
    case 'pending-ops-status':
      return globalThis.__NEXT_DEV_PENDING_OPERATIONS_STATUS__;
    case 'pending-ops-clear-last-ran-await':
      return globalThis.__NEXT_DEV_PENDING_OPERATIONS_CLEAR_LAST_RAN_AWAIT__;
    case 'pending-ops-clear-pending-operations':
      return globalThis.__NEXT_DEV_PENDING_OPERATIONS_CLEAR_PENDING_OPERATIONS__;
    case 'pending-ops-clear-resolved':
      return globalThis.__NEXT_DEV_PENDING_OPERATIONS_CLEAR_RESOLVED__;
    case 'pending-ops-clear-all':
      return globalThis.__NEXT_DEV_PENDING_OPERATIONS_CLEAR_ALL__;
    default:
      return null;
  }
}

async function handle(request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Disabled in production' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const pendingOperationsStatus = globalThis.__NEXT_DEV_PENDING_OPERATIONS_STATUS__;

  if (action === 'status' || action === 'measure') {
    const measurement = await measureProcess(parseMeasurementOptions(searchParams));
    return Response.json({
      ...measurement,
      ...(typeof pendingOperationsStatus === 'function'
        ? { asyncDebug: pendingOperationsStatus() }
        : {}),
    });
  }

  const pendingOperationsHelper = getPendingOperationsHelper(action);
  if (pendingOperationsHelper !== null) {
    if (typeof pendingOperationsHelper !== 'function') {
      return Response.json(
        { error: `Missing helper for action "${action}"` },
        { status: 500 },
      );
    }

    const asyncDebug = pendingOperationsHelper();
    const measurement = await measureProcess(parseMeasurementOptions(searchParams));
    return Response.json({ ok: true, action, asyncDebug, measurement });
  }

  const options = parseReproOptionsFromSearchParams(searchParams);
  const result = await runReproScenario(options);

  return Response.json({ ok: true, ...result });
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}
