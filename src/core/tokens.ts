import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types';

export function generateAccessToken(
  payload: TokenPayload,
  config: { accessSecret: string; accessExpiry: string | number }
): string {
  return jwt.sign(payload, config.accessSecret, {
    expiresIn: config.accessExpiry as any,
  });
}

export function generateRefreshToken(
  payload: TokenPayload,
  config: { refreshSecret: string; refreshExpiry: string | number }
): string {
  return jwt.sign(payload, config.refreshSecret, {
    expiresIn: config.refreshExpiry as any,
  });
}

export function verifyAccessToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}

export function verifyRefreshToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}
