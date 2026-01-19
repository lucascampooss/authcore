import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { eq, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { RefreshTokenStorage, StoredRefreshToken, SessionMetadata } from '../../src/types';

const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  sessionId: text('session_id'),
  userAgent: text('user_agent'),
  ip: text('ip'),
  deviceId: text('device_id'),
  lastUsedAt: timestamp('last_used_at'),
});

export class DrizzleStorage implements RefreshTokenStorage {
  constructor(private db: NodePgDatabase) {}

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    await this.db.insert(refreshTokens).values({
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      sessionId: metadata?.sessionId || null,
      userAgent: metadata?.userAgent || null,
      ip: metadata?.ip || null,
      deviceId: metadata?.deviceId || null,
      lastUsedAt: new Date(),
    });
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const tokens = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, userId));

    return tokens.map(token => ({
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      sessionId: token.sessionId || undefined,
      userAgent: token.userAgent || undefined,
      ip: token.ip || undefined,
      deviceId: token.deviceId || undefined,
      lastUsedAt: token.lastUsedAt || undefined,
    }));
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    const tokens = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.sessionId, sessionId))
      .limit(1);

    if (tokens.length === 0) return null;

    const token = tokens[0]!;
    return {
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      sessionId: token.sessionId || undefined,
      userAgent: token.userAgent || undefined,
      ip: token.ip || undefined,
      deviceId: token.deviceId || undefined,
      lastUsedAt: token.lastUsedAt || undefined,
    };
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.id, id));
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.sessionId, sessionId));
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()));

    return result.rowCount || 0;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ expiresAt, lastUsedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }
}
