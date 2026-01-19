export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  USER_NOT_AUTHENTICATED = 'USER_NOT_AUTHENTICATED',
  TOKEN_BINDING_MISMATCH = 'TOKEN_BINDING_MISMATCH',
}

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
