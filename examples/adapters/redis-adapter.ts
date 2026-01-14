import type { RedisClientType } from 'redis';
import { RefreshTokenStorage, StoredRefreshToken } from '../../src/types';

// redis adapter example - uses redis sets for user tokens
export class RedisStorage implements RefreshTokenStorage {
  private client: RedisClientType;

  constructor(client: RedisClientType) {
    this.client = client;
  }

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const id = crypto.randomUUID();
    const token: StoredRefreshToken = {
      id,
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    };

    const key = `refresh_token:${id}`;
    const userKey = `user_tokens:${userId}`;
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    // store token with expiry
    await this.client.setEx(key, ttl, JSON.stringify(token));
    
    // add to user's token set
    await this.client.sAdd(userKey, id);
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
        tokens.push(token);
      } else {
        // token expired, remove from set
        await this.client.sRem(userKey, id);
      }
    }
    
    return tokens;
  }

  async deleteByUserId(userId: string): Promise<void> {
    const userKey = `user_tokens:${userId}`;
    const tokenIds = await this.client.sMembers(userKey);
    
    for (const id of tokenIds) {
      await this.client.del(`refresh_token:${id}`);
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
    }
    
    await this.client.del(key);
  }

  async deleteExpired(): Promise<number> {
    // redis handles expiry automatically with TTL
    // this method is a no-op for redis
    return 0;
  }
}
