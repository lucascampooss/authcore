import { AuthInstance } from '../types';
import { createAuthenticateMiddleware } from './authenticate';
import { createAuthorizeMiddleware } from './authorize';

export function createAuthMiddleware(auth: AuthInstance) {
  return {
    authenticate: createAuthenticateMiddleware.bind(null, auth),
    authorize: createAuthorizeMiddleware,
  };
}
