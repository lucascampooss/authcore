import { AuthConfig, AuthInstance, TokenPayload } from '../types';
import { hashPassword, verifyPassword } from './password';
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from './tokens';
import { refreshTokenFlow, revokeUserTokens } from './refresh';

export function createAuth(config: AuthConfig): AuthInstance {
  if (!config.jwt.accessSecret || !config.jwt.refreshSecret) {
    throw new Error('jwt secrets are required');
  }
  
  if (!config.storage) {
    throw new Error('storage adapter is required');
  }

  const fullConfig: AuthConfig = {
    ...config,
    jwt: {
      accessExpiry: '15m',
      refreshExpiry: '7d',
      ...config.jwt,
    },
    password: {
      saltRounds: 12,
      ...config.password,
    },
  };

  return {
    hashPassword: (password: string) => 
      hashPassword(password, fullConfig.password!.saltRounds!),
    
    verifyPassword,

    generateTokens: async (payload: TokenPayload) => {
      const accessToken = generateAccessToken(payload, {
        accessSecret: fullConfig.jwt.accessSecret,
        accessExpiry: fullConfig.jwt.accessExpiry!,
      });
      const refreshToken = generateRefreshToken(payload, {
        refreshSecret: fullConfig.jwt.refreshSecret,
        refreshExpiry: fullConfig.jwt.refreshExpiry!,
      });
      
      await refreshTokenFlow.store(
        payload.userId,
        refreshToken,
        fullConfig.jwt.refreshExpiry!,
        fullConfig.storage
      );

      return { accessToken, refreshToken };
    },

    verifyAccessToken: (token: string) => 
      verifyAccessToken(token, fullConfig.jwt.accessSecret),
    
    verifyRefreshToken: (token: string) => 
      verifyRefreshToken(token, fullConfig.jwt.refreshSecret),

    refreshTokens: async (refreshToken: string) => {
      return refreshTokenFlow.refresh(refreshToken, fullConfig);
    },

    revokeTokens: async (userId: string) => {
      await revokeUserTokens(userId, fullConfig.storage);
    },

    config: fullConfig,
  };
}
