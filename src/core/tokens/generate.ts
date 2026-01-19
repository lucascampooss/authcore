import jwt from 'jsonwebtoken';
import { TokenPayload } from '../../types';

const MAX_PAYLOAD_SIZE = 4096; // 4KB limit to prevent DoS

function validatePayloadSize(payload: TokenPayload): void {
  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    throw new Error(
      `Token payload too large (${payloadSize} bytes). Maximum allowed: ${MAX_PAYLOAD_SIZE} bytes`
    );
  }
}

export function generateAccessToken(
  payload: TokenPayload,
  config: { accessSecret: string; accessExpiry: string | number }
): string {
  validatePayloadSize(payload);

  return jwt.sign(payload, config.accessSecret, {
    expiresIn: config.accessExpiry as any,
    algorithm: 'HS256',
  });
}

export function generateRefreshToken(
  payload: TokenPayload,
  config: { refreshSecret: string; refreshExpiry: string | number }
): string {
  validatePayloadSize(payload);

  return jwt.sign(payload, config.refreshSecret, {
    expiresIn: config.refreshExpiry as any,
    algorithm: 'HS256',
  });
}
