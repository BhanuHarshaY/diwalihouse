import { HTTP_STATUS_FOR_ERROR, type ApiError, type ApiErrorCode } from '@diwali/contracts';

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  validation_failed: 'Some details need another look.',
  not_authenticated: 'You are not a member of this party.',
  forbidden: 'Only the host can do that.',
  not_found: 'We could not find that.',
  invite_not_found: 'That invitation has expired or does not exist.',
  party_closed: 'This party is no longer taking guests.',
  party_full: 'This party is full.',
  name_taken: 'Someone in the party already goes by that name.',
  host_cannot_leave: 'Hosts cannot leave their own party yet.',
  limit_reached: 'That would go past the limit.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  internal: 'Something went wrong on our side.',
};

/** An expected, user-facing failure. Anything else is a bug and maps to `internal`. */
export class DomainError extends Error {
  readonly code: ApiErrorCode;
  readonly fields: Record<string, string[]> | undefined;

  constructor(code: ApiErrorCode, message?: string, fields?: Record<string, string[]>) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'DomainError';
    this.code = code;
    this.fields = fields;
  }

  get status(): number {
    return HTTP_STATUS_FOR_ERROR[this.code];
  }

  toJSON(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** Postgres unique violation, optionally on a specific constraint or index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const pgError = error as { code?: unknown; constraint_name?: unknown };
  return pgError.code === '23505' && (!constraint || pgError.constraint_name === constraint);
}
