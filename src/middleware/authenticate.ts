import { AuthInstance, AuthRequest, AuthError, AuthErrorCode } from '../types';

export function createAuthenticateMiddleware<TRequest extends AuthRequest, TResponse>(
  auth: AuthInstance,
  onError?: (error: AuthError, req: TRequest, res: TResponse) => void
) {
  return async (req: TRequest, res: TResponse, next: () => void) => {
    try {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      const token =
        typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined;

      if (!token) {
        throw new AuthError(AuthErrorCode.USER_NOT_AUTHENTICATED, 'No token provided');
      }

      const payload = auth.verifyAccessToken(token);
      req.user = payload;
      next();
    } catch (error: unknown) {
      const err =
        error instanceof AuthError
          ? error
          : new AuthError(AuthErrorCode.TOKEN_INVALID, String(error));
      if (onError) {
        onError(err, req, res);
      } else {
        throw err;
      }
    }
  };
}
