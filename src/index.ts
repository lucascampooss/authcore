export { createAuth } from './core/auth';
export { hashPassword, verifyPassword } from './core/password';
export { createAuthMiddleware } from './middleware';

export type {
  AuthConfig,
  AuthInstance,
  TokenPayload,
  AuthTokens,
  RefreshTokenStorage,
  AuthMiddleware,
  AuthRequest,
  SessionMetadata,
  SessionInfo,
  StoredRefreshToken,
  AuthHooks,
} from './types';

export { UserRole, AuthErrorCode, AuthError } from './types';
export { checkPermission, hasRole } from './rbac';

export { MemoryStorage } from './adapters/memory';

export { authSchemas } from './validation/schemas';
