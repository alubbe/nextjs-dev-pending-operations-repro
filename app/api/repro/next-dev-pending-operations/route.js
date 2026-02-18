import { parseReproOptionsFromSearchParams, runReproScenario } from '../../../../lib/reproScenario.js';

async function handle(request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Disabled in production' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
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
