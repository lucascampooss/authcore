import bcrypt from 'bcrypt';
import { AuthConfig, AuthTokens, RefreshTokenStorage, TokenPayload } from '../types';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './tokens';

// use lower rounds for token hashing (faster, still secure for short-lived tokens)
async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

async function compareToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

// parse expiry strings like '7d', '24h', '60m' or milliseconds
function calculateExpiry(expiry: string | number): Date {
  const expiresAt = new Date();
  
  if (typeof expiry === 'number') {
    expiresAt.setTime(expiresAt.getTime() + expiry);
  } else {
    const match = expiry.match(/^(\d+)([dhms])$/);
    if (!match) {
      throw new Error(`invalid expiry format: ${expiry}`);
    }
    
    const value = match[1];
    const unit = match[2];
    
    if (!value || !unit) {
      throw new Error(`invalid expiry format: ${expiry}`);
    }
    
    const num = parseInt(value, 10);
    
    switch (unit) {
      case 'd': expiresAt.setDate(expiresAt.getDate() + num); break;
      case 'h': expiresAt.setHours(expiresAt.getHours() + num); break;
      case 'm': expiresAt.setMinutes(expiresAt.getMinutes() + num); break;
      case 's': expiresAt.setSeconds(expiresAt.getSeconds() + num); break;
    }
  }
  
  return expiresAt;
}

export const refreshTokenFlow = {
  async store(
    userId: string,
    refreshToken: string,
    expiry: string | number,
    storage: RefreshTokenStorage
  ): Promise<void> {
    const tokenHash = await hashToken(refreshToken);
    const expiresAt = calculateExpiry(expiry);
    await storage.save(userId, tokenHash, expiresAt);
  },

  async refresh(refreshToken: string, config: AuthConfig): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken, config.jwt.refreshSecret);
    } catch (error: unknown) {
      throw new Error('invalid or expired refresh token');
    }

    // find matching token in storage
    const storedTokens = await config.storage.findByUserId(payload.userId);
    
    let validTokenId: string | null = null;
    for (const stored of storedTokens) {
      const isMatch = await compareToken(refreshToken, stored.tokenHash);
      if (isMatch && stored.expiresAt > new Date()) {
        validTokenId = stored.id;
        break;
      }
    }

    if (!validTokenId) {
      throw new Error('refresh token not found or expired');
    }

    // token rotation: delete old token before issuing new one
    await config.storage.deleteById(validTokenId);

    const newAccessToken = generateAccessToken(payload, {
      accessSecret: config.jwt.accessSecret,
      accessExpiry: config.jwt.accessExpiry!,
    });
    const newRefreshToken = generateRefreshToken(payload, {
      refreshSecret: config.jwt.refreshSecret,
      refreshExpiry: config.jwt.refreshExpiry!,
    });

    await this.store(
      payload.userId,
      newRefreshToken,
      config.jwt.refreshExpiry!,
      config.storage
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },
};

export async function revokeUserTokens(
  userId: string,
  storage: RefreshTokenStorage
): Promise<void> {
  await storage.deleteByUserId(userId);
}
