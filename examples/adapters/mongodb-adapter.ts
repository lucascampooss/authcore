import type { MongoClient, Db, Collection } from 'mongodb';
import { randomUUID } from 'crypto';
import { RefreshTokenStorage, StoredRefreshToken, SessionMetadata } from '../../src/types';

export class MongoDBStorage implements RefreshTokenStorage {
  private db!: Db;
  private collection!: Collection;

  constructor(
    private uri: string,
    private dbName: string
  ) {
    this.connect();
  }

  private async connect() {
    const client = new MongoClient(this.uri);
    await client.connect();
    this.db = client.db(this.dbName);
    this.collection = this.db.collection('refresh_tokens');

    await this.collection.createIndex({ user_id: 1 });
    await this.collection.createIndex({ session_id: 1 });
    await this.collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  }

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    await this.collection.insertOne({
      _id: randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date(),
      session_id: metadata?.sessionId || null,
      user_agent: metadata?.userAgent || null,
      ip: metadata?.ip || null,
      device_id: metadata?.deviceId || null,
      last_used_at: new Date(),
    });
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const docs = await this.collection
      .find({ user_id: userId, expires_at: { $gt: new Date() } })
      .toArray();

    return docs.map(doc => ({
      id: doc._id,
      userId: doc.user_id,
      tokenHash: doc.token_hash,
      expiresAt: new Date(doc.expires_at),
      createdAt: new Date(doc.created_at),
      sessionId: doc.session_id || undefined,
      userAgent: doc.user_agent || undefined,
      ip: doc.ip || undefined,
      deviceId: doc.device_id || undefined,
      lastUsedAt: doc.last_used_at ? new Date(doc.last_used_at) : undefined,
    }));
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    const doc = await this.collection.findOne({ session_id: sessionId });

    if (!doc) return null;

    return {
      id: doc._id,
      userId: doc.user_id,
      tokenHash: doc.token_hash,
      expiresAt: new Date(doc.expires_at),
      createdAt: new Date(doc.created_at),
      sessionId: doc.session_id || undefined,
      userAgent: doc.user_agent || undefined,
      ip: doc.ip || undefined,
      deviceId: doc.device_id || undefined,
      lastUsedAt: doc.last_used_at ? new Date(doc.last_used_at) : undefined,
    };
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.collection.deleteMany({ user_id: userId });
  }

  async deleteById(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: id });
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.collection.deleteMany({ session_id: sessionId });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.collection.deleteMany({
      expires_at: { $lt: new Date() },
    });
    return result.deletedCount;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { expires_at: expiresAt, last_used_at: new Date() } }
    );
  }
}
