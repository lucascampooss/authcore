import { RefreshTokenStorage, AuthHooks } from '../../types';

export async function revokeUserTokens(
  userId: string,
  storage: RefreshTokenStorage,
  hooks?: AuthHooks
): Promise<void> {
  await storage.deleteByUserId(userId);

  if (hooks?.onLogout) {
    await hooks.onLogout(userId);
  }
}

export async function revokeSession(
  sessionId: string,
  storage: RefreshTokenStorage,
  hooks?: AuthHooks
): Promise<void> {
  await storage.deleteBySessionId(sessionId);

  if (hooks?.onTokenRevoked) {
    await hooks.onTokenRevoked('', sessionId);
  }
}
