import { SessionMetadata } from './session';
import { StoredRefreshToken } from './session';

export interface RefreshTokenStorage {
  save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void>;
  findByUserId(userId: string): Promise<StoredRefreshToken[]>;
  findBySessionId(sessionId: string): Promise<StoredRefreshToken | null>;
  deleteByUserId(userId: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteBySessionId(sessionId: string): Promise<void>;
  deleteExpired(): Promise<number>;
  updateExpiry?(id: string, expiresAt: Date): Promise<void>; // optional, required for sliding tokens
  incrementRefreshCount?(id: string): Promise<void>; // optional, for tracking refresh count
}
