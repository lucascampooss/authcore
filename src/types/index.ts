export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPERADMIN = 'SUPERADMIN',
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthConfig {
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiry?: string | number;
    refreshExpiry?: string | number;
  };
  password?: {
    saltRounds?: number;
  };
  storage: RefreshTokenStorage;
}

export interface RefreshTokenStorage {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByUserId(userId: string): Promise<StoredRefreshToken[]>;
  deleteByUserId(userId: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthInstance {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateTokens(payload: TokenPayload): Promise<AuthTokens>;
  verifyAccessToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): TokenPayload;
  refreshTokens(refreshToken: string): Promise<AuthTokens>;
  revokeTokens(userId: string): Promise<void>;
  config: AuthConfig;
}
export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: TokenPayload;
}

export type AuthMiddleware<TRequest = unknown, TResponse = unknown> = (
  req: TRequest,
  res: TResponse,
  next: () => void
) => void | Promise<void>;

export interface MiddlewareFactory {
  authenticate<TRequest extends AuthRequest, TResponse>(
    onError?: (error: Error, req: TRequest, res: TResponse) => void
  ): AuthMiddleware<TRequest, TResponse>;
  
  authorize<TRequest extends AuthRequest, TResponse>(
    roles: UserRole[],
    onError?: (error: Error, req: TRequest, res: TResponse) => void
  ): AuthMiddleware<TRequest, TResponse>;
}
