import { measureProcess, parseMeasurementOptions } from '../../../../lib/devMeasurement.js';
import { parseReproOptionsFromSearchParams, runReproScenario } from '../../../../lib/reproScenario.js';

export const dynamic = 'force-dynamic';

async function handle(request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Disabled in production' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'status' || action === 'measure') {
    const measurement = await measureProcess(parseMeasurementOptions(searchParams));
    return Response.json(measurement);
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
