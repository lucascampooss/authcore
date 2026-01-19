import { UserRole } from './roles';
import { RefreshTokenStorage } from './storage';
import { AuthHooks } from './hooks';
import { SessionMetadata, SessionInfo } from './session';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId?: string;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
}

export interface AuthConfig {
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiry?: string | number;
    refreshExpiry?: string | number;
    clockTolerance?: number; // tolerance for clock skew in distributed systems (seconds)
  };
  password?: {
    saltRounds?: number;
  };
  storage: RefreshTokenStorage;
  hooks?: AuthHooks;
  session?: {
    sliding?: boolean; // extends token expiry on each refresh
    maxAge?: string | number; // maximum session lifetime for sliding tokens
    maxRefreshes?: number; // maximum number of refreshes allowed (default: 100)
    binding?: {
      userAgent?: boolean; // bind tokens to user agent
      ip?: boolean; // bind tokens to ip address
      deviceId?: boolean; // bind tokens to device id
    };
  };
}

export interface AuthInstance {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateTokens(payload: TokenPayload, metadata?: SessionMetadata): Promise<AuthTokens>;
  verifyAccessToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): TokenPayload;
  refreshTokens(refreshToken: string, metadata?: SessionMetadata): Promise<AuthTokens>;
  revokeTokens(userId: string): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
  listSessions(userId: string): Promise<SessionInfo[]>;
  config: AuthConfig;
}
