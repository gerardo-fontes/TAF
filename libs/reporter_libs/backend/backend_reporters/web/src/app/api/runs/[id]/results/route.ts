import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRunMetricMatrix, getRawResults } from '@/lib/db/queries/results';
import { apiSuccess, apiError } from '@/lib/api/envelope';

const QuerySchema = z.object({
  metric: z.string().optional(),
  threads: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 100)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
  raw: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return apiError('INVALID_RUN_ID', 'Run ID must be a numeric integer string', null, 400);
  }

  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return apiError('INVALID_QUERY_PARAMS', 'Invalid query parameters', parsed.error.format(), 400);
  }

  try {
    const matrix = await getRunMetricMatrix(id);
    const raw = parsed.data.raw
      ? await getRawResults(id, {
          metricName: parsed.data.metric,
          threads: parsed.data.threads,
          limit: parsed.data.limit,
          offset: parsed.data.offset,
        })
      : [];

    return apiSuccess({ matrix, raw });
  } catch (err: any) {
    return apiError('QUERY_FAILED', 'Failed to retrieve run results', err?.message, 500);
  }
}