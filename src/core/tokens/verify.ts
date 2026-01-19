import jwt from 'jsonwebtoken';
import { TokenPayload, AuthError, AuthErrorCode } from '../../types';

export function verifyAccessToken(
  token: string,
  secret: string,
  clockTolerance?: number
): TokenPayload {
  try {
    return jwt.verify(token, secret, {
      clockTolerance: clockTolerance || 0,
      algorithms: ['HS256'], // prevent algorithm confusion attacks
    }) as TokenPayload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthError(AuthErrorCode.TOKEN_EXPIRED, 'Access token expired');
    }
    throw new AuthError(AuthErrorCode.TOKEN_INVALID, 'Invalid access token');
  }
}

export function verifyRefreshToken(
  token: string,
  secret: string,
  clockTolerance?: number
): TokenPayload {
  try {
    return jwt.verify(token, secret, {
      clockTolerance: clockTolerance || 0,
      algorithms: ['HS256'], // prevent algorithm confusion attacks
    }) as TokenPayload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthError(AuthErrorCode.TOKEN_EXPIRED, 'Refresh token expired');
    }
    throw new AuthError(AuthErrorCode.TOKEN_INVALID, 'Invalid refresh token');
  }
}
