import { z } from 'zod';

/**
 * Every error the API can return to a client. Codes are stable identifiers;
 * `message` is human copy and may change.
 */
export const API_ERROR_CODES = [
  'validation_failed',
  'not_authenticated',
  'forbidden',
  'not_found',
  'invite_not_found',
  'party_closed',
  'party_full',
  'name_taken',
  'host_cannot_leave',
  'limit_reached',
  'rate_limited',
  'internal',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const HTTP_STATUS_FOR_ERROR: Record<ApiErrorCode, number> = {
  validation_failed: 400,
  not_authenticated: 401,
  forbidden: 403,
  not_found: 404,
  invite_not_found: 404,
  party_closed: 409,
  party_full: 409,
  name_taken: 409,
  host_cannot_leave: 409,
  limit_reached: 409,
  rate_limited: 429,
  internal: 500,
};
