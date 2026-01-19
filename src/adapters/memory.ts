import { randomUUID } from 'crypto';
import { RefreshTokenStorage, StoredRefreshToken, SessionMetadata } from '../types';

// in-memory storage for development/testing only
// do not use in production
export class MemoryStorage implements RefreshTokenStorage {
  private tokens: Map<string, StoredRefreshToken> = new Map();

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    const token: StoredRefreshToken = {
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      sessionId: metadata?.sessionId,
      userAgent: metadata?.userAgent,
      ip: metadata?.ip,
      deviceId: metadata?.deviceId,
      lastUsedAt: new Date(),
      refreshCount: 0,
    };
    this.tokens.set(token.id, token);
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    return Array.from(this.tokens.values()).filter(t => t.userId === userId);
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    for (const token of this.tokens.values()) {
      if (token.sessionId === sessionId) {
        return token;
      }
    }
    return null;
  }

  async deleteByUserId(userId: string): Promise<void> {
    for (const [id, token] of this.tokens.entries()) {
      if (token.userId === userId) {
        this.tokens.delete(id);
      }
    }
  }

  async deleteById(id: string): Promise<void> {
    this.tokens.delete(id);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    for (const [id, token] of this.tokens.entries()) {
      if (token.sessionId === sessionId) {
        this.tokens.delete(id);
      }
    }
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [id, token] of this.tokens.entries()) {
      if (token.expiresAt < now) {
        this.tokens.delete(id);
        count++;
      }
    }

    return count;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    const token = this.tokens.get(id);
    if (token) {
      token.expiresAt = expiresAt;
      token.lastUsedAt = new Date();
      token.refreshCount = (token.refreshCount || 0) + 1;
      this.tokens.set(id, token);
    }
  }

  async incrementRefreshCount(id: string): Promise<void> {
    const token = this.tokens.get(id);
    if (token) {
      token.refreshCount = (token.refreshCount || 0) + 1;
      this.tokens.set(id, token);
    }
  }

  clear(): void {
    this.tokens.clear();
  }
}
