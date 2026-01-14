export { createAuth } from './core/auth';
export { hashPassword, verifyPassword } from './core/password';
export { createAuthMiddleware } from './middleware/factories';

export type {
  AuthConfig,
  AuthInstance,
  TokenPayload,
  AuthTokens,
  RefreshTokenStorage,
  AuthMiddleware,
  AuthRequest,
} from './types';

export { UserRole } from './rbac/roles';
export { checkPermission, hasRole } from './rbac/permissions';

export { MemoryStorage } from './adapters/memory';

export { authSchemas } from './validation/schemas';
