import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { eq, lt } from 'drizzle-orm';
import { RefreshTokenStorage, StoredRefreshToken } from '../../src/types';

// drizzle schema
const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// drizzle adapter example
export class DrizzleStorage implements RefreshTokenStorage {
  constructor(private db: NodePgDatabase) {}

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.insert(refreshTokens).values({
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
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
    }));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, userId));
  }

  async deleteById(id: string): Promise<void> {
    await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.id, id));
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()));
    
    return result.rowCount || 0;
  }
}
