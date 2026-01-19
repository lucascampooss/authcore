import type { RedisClientType } from 'redis';
import { randomUUID } from 'crypto';
import { RefreshTokenStorage, StoredRefreshToken, SessionMetadata } from '../../src/types';

export class RedisStorage implements RefreshTokenStorage {
  private client: RedisClientType;

  constructor(client: RedisClientType) {
    this.client = client;
  }

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    const id = randomUUID();
    const token: StoredRefreshToken = {
      id,
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      sessionId: metadata?.sessionId,
      userAgent: metadata?.userAgent,
      ip: metadata?.ip,
      deviceId: metadata?.deviceId,
      lastUsedAt: new Date(),
    };

    const key = `refresh_token:${id}`;
    const userKey = `user_tokens:${userId}`;
    const sessionKey = metadata?.sessionId ? `session_token:${metadata.sessionId}` : null;
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    await this.client.setEx(key, ttl, JSON.stringify(token));
    await this.client.sAdd(userKey, id);

    if (sessionKey) {
      await this.client.setEx(sessionKey, ttl, id);
    }
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const userKey = `user_tokens:${userId}`;
    const tokenIds = await this.client.sMembers(userKey);

    const tokens: StoredRefreshToken[] = [];
    for (const id of tokenIds) {
      const key = `refresh_token:${id}`;
      const data = await this.client.get(key);

      if (data) {
        const token = JSON.parse(data);
        token.expiresAt = new Date(token.expiresAt);
        token.createdAt = new Date(token.createdAt);
        if (token.lastUsedAt) token.lastUsedAt = new Date(token.lastUsedAt);
        tokens.push(token);
      } else {
        await this.client.sRem(userKey, id);
      }
    }

    return tokens;
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    const sessionKey = `session_token:${sessionId}`;
    const id = await this.client.get(sessionKey);

    if (!id) return null;

    const key = `refresh_token:${id}`;
    const data = await this.client.get(key);

    if (!data) return null;

    const token = JSON.parse(data);
    token.expiresAt = new Date(token.expiresAt);
    token.createdAt = new Date(token.createdAt);
    if (token.lastUsedAt) token.lastUsedAt = new Date(token.lastUsedAt);

    return token;
  }

  async deleteByUserId(userId: string): Promise<void> {
    const userKey = `user_tokens:${userId}`;
    const tokenIds = await this.client.sMembers(userKey);

    for (const id of tokenIds) {
      await this.client.del(`refresh_token:${id}`);

      const data = await this.client.get(`refresh_token:${id}`);
      if (data) {
        const token = JSON.parse(data);
        if (token.sessionId) {
          await this.client.del(`session_token:${token.sessionId}`);
        }
      }
    }

    await this.client.del(userKey);
  }

  async deleteById(id: string): Promise<void> {
    const key = `refresh_token:${id}`;
    const data = await this.client.get(key);

    if (data) {
      const token = JSON.parse(data);
      const userKey = `user_tokens:${token.userId}`;
      await this.client.sRem(userKey, id);

      if (token.sessionId) {
        await this.client.del(`session_token:${token.sessionId}`);
      }
    }

    await this.client.del(key);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    const sessionKey = `session_token:${sessionId}`;
    const id = await this.client.get(sessionKey);

    if (id) {
      await this.deleteById(id);
    }
  }

  async deleteExpired(): Promise<number> {
    return 0;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    const key = `refresh_token:${id}`;
    const data = await this.client.get(key);

    if (data) {
      const token = JSON.parse(data);
      token.expiresAt = expiresAt;
      token.lastUsedAt = new Date();

      const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      await this.client.setEx(key, ttl, JSON.stringify(token));

      if (token.sessionId) {
        const sessionKey = `session_token:${token.sessionId}`;
        await this.client.setEx(sessionKey, ttl, id);
      }
    }
  }
}
