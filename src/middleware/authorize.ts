import { AuthRequest, UserRole, AuthError, AuthErrorCode } from '../types';

export function createAuthorizeMiddleware<TRequest extends AuthRequest, TResponse>(
  roles: UserRole[],
  onError?: (error: AuthError, req: TRequest, res: TResponse) => void
) {
  return (req: TRequest, res: TResponse, next: () => void) => {
    try {
      if (!req.user) {
        throw new AuthError(AuthErrorCode.USER_NOT_AUTHENTICATED, 'User not authenticated');
      }

      if (!roles.includes(req.user.role)) {
        throw new AuthError(AuthErrorCode.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions', {
          required: roles,
          current: req.user.role,
        });
      }

      next();
    } catch (error: unknown) {
      const err =
        error instanceof AuthError
          ? error
          : new AuthError(AuthErrorCode.INSUFFICIENT_PERMISSIONS, String(error));
      if (onError) {
        onError(err, req, res);
      } else {
        throw err;
      }
    }
  };
}
