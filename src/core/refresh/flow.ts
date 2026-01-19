import { randomUUID } from 'crypto';
import {
  AuthConfig,
  AuthTokens,
  RefreshTokenStorage,
  TokenPayload,
  SessionMetadata,
  AuthError,
  AuthErrorCode,
} from '../../types';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../tokens';
import { hashToken, compareToken } from './hash';
import { calculateExpiry, calculateSlidingExpiry } from './expiry';
import { validateTokenBinding } from './binding';

export const refreshTokenFlow = {
  async store(
    userId: string,
    refreshToken: string,
    expiry: string | number,
    storage: RefreshTokenStorage,
    metadata?: SessionMetadata
  ): Promise<string> {
    const tokenHash = await hashToken(refreshToken);
    const expiresAt = calculateExpiry(expiry);
    const sessionId = metadata?.sessionId || randomUUID();

    await storage.save(userId, tokenHash, expiresAt, {
      sessionId,
      userAgent: metadata?.userAgent,
      ip: metadata?.ip,
      deviceId: metadata?.deviceId,
    });

    return sessionId;
  },

  async refresh(
    refreshToken: string,
    config: AuthConfig,
    metadata?: SessionMetadata
  ): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(
        refreshToken,
        config.jwt.refreshSecret,
        config.jwt.clockTolerance
      );
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(AuthErrorCode.TOKEN_INVALID, 'Invalid or expired refresh token');
    }

    const storedTokens = await config.storage.findByUserId(payload.userId);

    // constant-time token comparison to prevent timing attacks
    let validToken: (typeof storedTokens)[0] | null = null;
    const now = new Date();

    for (const stored of storedTokens) {
      const isMatch = await compareToken(refreshToken, stored.tokenHash);
      const isNotExpired = stored.expiresAt > now;

      // always check all tokens, don't break early
      if (isMatch && isNotExpired && !validToken) {
        validToken = stored;
      }
    }

    if (!validToken) {
      throw new AuthError(AuthErrorCode.TOKEN_REVOKED, 'Refresh token not found or expired');
    }

    validateTokenBinding(validToken, metadata, config);

    // sliding tokens: update expiry instead of rotating
    if (config.session?.sliding && config.storage.updateExpiry) {
      // check refresh count limit
      const maxRefreshes = config.session.maxRefreshes || 100;
      const currentRefreshCount = validToken.refreshCount || 0;

      if (currentRefreshCount >= maxRefreshes) {
        throw new AuthError(
          AuthErrorCode.TOKEN_REVOKED,
          `Maximum refresh limit reached (${maxRefreshes}). Please login again.`
        );
      }

      const newExpiry = calculateSlidingExpiry(
        validToken.expiresAt,
        validToken.createdAt,
        config.jwt.refreshExpiry!,
        config.session.maxAge
      );

      await config.storage.updateExpiry(validToken.id, newExpiry);

      if (config.hooks?.onRefresh) {
        await config.hooks.onRefresh(payload, metadata);
      }

      const newAccessToken = generateAccessToken(payload, {
        accessSecret: config.jwt.accessSecret,
        accessExpiry: config.jwt.accessExpiry!,
      });

      return {
        accessToken: newAccessToken,
        refreshToken,
        sessionId: validToken.sessionId,
      };
    }

    // token rotation: store new token first to prevent race condition
    const newAccessToken = generateAccessToken(payload, {
      accessSecret: config.jwt.accessSecret,
      accessExpiry: config.jwt.accessExpiry!,
    });
    const newRefreshToken = generateRefreshToken(payload, {
      refreshSecret: config.jwt.refreshSecret,
      refreshExpiry: config.jwt.refreshExpiry!,
    });

    // store new token before deleting old one
    const sessionId = await this.store(
      payload.userId,
      newRefreshToken,
      config.jwt.refreshExpiry!,
      config.storage,
      {
        sessionId: validToken.sessionId,
        userAgent: metadata?.userAgent || validToken.userAgent,
        ip: metadata?.ip || validToken.ip,
        deviceId: metadata?.deviceId || validToken.deviceId,
      }
    );

    // only delete old token after new one is safely stored
    await config.storage.deleteById(validToken.id);

    if (config.hooks?.onRefresh) {
      await config.hooks.onRefresh(payload, metadata);
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId,
    };
  },
};
