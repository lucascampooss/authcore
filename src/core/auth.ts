import { randomUUID } from 'crypto';
import { AuthConfig, AuthInstance, TokenPayload, SessionMetadata } from '../types';
import { hashPassword, verifyPassword } from './password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './tokens';
import { refreshTokenFlow, revokeUserTokens, revokeSession } from './refresh';
import { listSessions } from '../session';
import { validateSecret, validateExpiry } from './validation';

export function createAuth(config: AuthConfig): AuthInstance {
  // validate jwt secrets strength
  validateSecret(config.jwt.accessSecret, 'jwt access secret');
  validateSecret(config.jwt.refreshSecret, 'jwt refresh secret');

  // ensure secrets are different
  if (config.jwt.accessSecret === config.jwt.refreshSecret) {
    throw new Error('access secret and refresh secret must be different');
  }

  if (!config.storage) {
    throw new Error('storage adapter is required');
  }

  const fullConfig: AuthConfig = {
    ...config,
    jwt: {
      accessExpiry: '15m',
      refreshExpiry: '7d',
      clockTolerance: 0,
      ...config.jwt,
    },
    password: {
      saltRounds: 12,
      ...config.password,
    },
    session: {
      sliding: false,
      ...config.session,
    },
  };

  // validate expiry formats
  validateExpiry(fullConfig.jwt.accessExpiry!, 'access token expiry');
  validateExpiry(fullConfig.jwt.refreshExpiry!, 'refresh token expiry');

  // validate bcrypt rounds
  if (fullConfig.password!.saltRounds! < 10 || fullConfig.password!.saltRounds! > 20) {
    throw new Error('password salt rounds must be between 10 and 20');
  }

  return {
    hashPassword: (password: string) => hashPassword(password, fullConfig.password!.saltRounds!),

    verifyPassword,

    generateTokens: async (payload: TokenPayload, metadata?: SessionMetadata) => {
      const sessionId = metadata?.sessionId || randomUUID();

      const payloadWithSession = {
        ...payload,
        sessionId,
      };

      const accessToken = generateAccessToken(payloadWithSession, {
        accessSecret: fullConfig.jwt.accessSecret,
        accessExpiry: fullConfig.jwt.accessExpiry!,
      });
      const refreshToken = generateRefreshToken(payloadWithSession, {
        refreshSecret: fullConfig.jwt.refreshSecret,
        refreshExpiry: fullConfig.jwt.refreshExpiry!,
      });

      await refreshTokenFlow.store(
        payload.userId,
        refreshToken,
        fullConfig.jwt.refreshExpiry!,
        fullConfig.storage,
        {
          sessionId,
          userAgent: metadata?.userAgent,
          ip: metadata?.ip,
          deviceId: metadata?.deviceId,
        }
      );

      if (fullConfig.hooks?.onLogin) {
        await fullConfig.hooks.onLogin(payloadWithSession, metadata);
      }

      return { accessToken, refreshToken, sessionId };
    },

    verifyAccessToken: (token: string) =>
      verifyAccessToken(token, fullConfig.jwt.accessSecret, fullConfig.jwt.clockTolerance),

    verifyRefreshToken: (token: string) =>
      verifyRefreshToken(token, fullConfig.jwt.refreshSecret, fullConfig.jwt.clockTolerance),

    refreshTokens: async (refreshToken: string, metadata?: SessionMetadata) => {
      return refreshTokenFlow.refresh(refreshToken, fullConfig, metadata);
    },

    revokeTokens: async (userId: string) => {
      await revokeUserTokens(userId, fullConfig.storage, fullConfig.hooks);
    },

    revokeSession: async (sessionId: string) => {
      await revokeSession(sessionId, fullConfig.storage, fullConfig.hooks);
    },

    listSessions: async (userId: string) => {
      return listSessions(userId, fullConfig.storage);
    },

    config: {
      ...fullConfig,
      jwt: {
        ...fullConfig.jwt,
        accessSecret: '[REDACTED]',
        refreshSecret: '[REDACTED]',
      },
    },
  };
}
