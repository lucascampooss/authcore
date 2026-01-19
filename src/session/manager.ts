import { RefreshTokenStorage, SessionInfo } from '../types';

export async function listSessions(
  userId: string,
  storage: RefreshTokenStorage
): Promise<SessionInfo[]> {
  const tokens = await storage.findByUserId(userId);
  const now = new Date();

  return tokens
    .filter(t => t.expiresAt > now)
    .map(t => ({
      sessionId: t.sessionId || t.id,
      userId: t.userId,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
      userAgent: t.userAgent,
      ip: t.ip,
      deviceId: t.deviceId,
    }));
}
