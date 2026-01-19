import { TokenPayload } from './auth';
import { UserRole } from './roles';
import { AuthError } from './errors';

export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: TokenPayload;
}

export type AuthMiddleware<TRequest = unknown, TResponse = unknown> = (
  req: TRequest,
  res: TResponse,
  next: () => void
) => void | Promise<void>;

export interface MiddlewareFactory {
  authenticate<TRequest extends AuthRequest, TResponse>(
    onError?: (error: AuthError, req: TRequest, res: TResponse) => void
  ): AuthMiddleware<TRequest, TResponse>;

  authorize<TRequest extends AuthRequest, TResponse>(
    roles: UserRole[],
    onError?: (error: AuthError, req: TRequest, res: TResponse) => void
  ): AuthMiddleware<TRequest, TResponse>;
}
