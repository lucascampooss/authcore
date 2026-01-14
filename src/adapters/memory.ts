import { randomUUID } from 'crypto';
import { RefreshTokenStorage, StoredRefreshToken } from './storage';

// in-memory storage for development/testing only
// do not use in production
export class MemoryStorage implements RefreshTokenStorage {
  private tokens: Map<string, StoredRefreshToken> = new Map();

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const token: StoredRefreshToken = {
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    };
    this.tokens.set(token.id, token);
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    return Array.from(this.tokens.values()).filter(t => t.userId === userId);
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

  clear(): void {
    this.tokens.clear();
  }
}
