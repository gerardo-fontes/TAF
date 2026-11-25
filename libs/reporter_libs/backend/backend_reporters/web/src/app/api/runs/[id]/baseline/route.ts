import { NextRequest } from 'next/server';
import { z } from 'zod';
import { promoteBaseline, demoteBaseline, getRunById } from '@/lib/db/queries/runs';
import { apiSuccess, apiError } from '@/lib/api/envelope';

const BodySchema = z.object({
  comment: z.string().min(1, 'Baseline comment is required'),
  engineer: z.string().optional(),
});

function isPromotionEnabled(): boolean {
  const flag = process.env.TAF_ALLOW_BASELINE_PROMOTION;
  if (flag === '0' || flag === 'false') return false;
  // Default: enabled unless explicitly disabled.
  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return apiError('INVALID_RUN_ID', 'Run ID must be a numeric integer string', null, 400);
  }

  if (!isPromotionEnabled()) {
    return apiError('BASELINE_PROMOTION_DISABLED', 'Baseline promotion is disabled on this instance', null, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_BODY', 'Request body must be JSON', null, 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_BASELINE_PAYLOAD', 'Invalid baseline payload', parsed.error.format(), 400);
  }

  try {
    await promoteBaseline(id, parsed.data.comment);
    const run = await getRunById(id);
    if (!run) {
      return apiError('RUN_NOT_FOUND', `Test run with ID #${id} not found`, null, 404);
    }
    return apiSuccess(run);
  } catch (err: any) {
    return apiError('BASELINE_PROMOTION_FAILED', 'Failed to promote run to baseline', err?.message, 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return apiError('INVALID_RUN_ID', 'Run ID must be a numeric integer string', null, 400);
  }

  if (!isPromotionEnabled()) {
    return apiError('BASELINE_PROMOTION_DISABLED', 'Baseline demotion is disabled on this instance', null, 403);
  }

  try {
    await demoteBaseline(id);
    const run = await getRunById(id);
    if (!run) {
      return apiError('RUN_NOT_FOUND', `Test run with ID #${id} not found`, null, 404);
    }
    return apiSuccess(run);
  } catch (err: any) {
    return apiError('BASELINE_DEMOTION_FAILED', 'Failed to demote run from baseline', err?.message, 500);
  }
}