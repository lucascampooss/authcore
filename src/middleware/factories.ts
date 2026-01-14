import { AuthInstance, AuthRequest, UserRole } from '../types';

export function createAuthMiddleware(auth: AuthInstance) {
  return {
    // extracts and validates bearer token, attaches user to request
    authenticate<TRequest extends AuthRequest, TResponse>(
      onError?: (error: Error, req: TRequest, res: TResponse) => void
    ) {
      return async (req: TRequest, res: TResponse, next: () => void) => {
        try {
          const authHeader = req.headers['authorization'] || req.headers['Authorization'];
          const token = typeof authHeader === 'string' 
            ? authHeader.replace(/^Bearer\s+/i, '')
            : undefined;

          if (!token) {
            throw new Error('no token provided');
          }

          const payload = auth.verifyAccessToken(token);
          req.user = payload;
          next();
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (onError) {
            onError(err, req, res);
          } else {
            throw err;
          }
        }
      };
    },

    // checks if authenticated user has required role
    // must be used after authenticate()
    authorize<TRequest extends AuthRequest, TResponse>(
      roles: UserRole[],
      onError?: (error: Error, req: TRequest, res: TResponse) => void
    ) {
      return (req: TRequest, res: TResponse, next: () => void) => {
        try {
          if (!req.user) {
            throw new Error('user not authenticated');
          }

          if (!roles.includes(req.user.role)) {
            throw new Error('insufficient permissions');
          }

          next();
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (onError) {
            onError(err, req, res);
          } else {
            throw err;
          }
        }
      };
    },
  };
}
