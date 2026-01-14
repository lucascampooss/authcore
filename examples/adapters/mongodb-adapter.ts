import type { MongoClient, Db, Collection } from 'mongodb';
import { RefreshTokenStorage, StoredRefreshToken } from '../../src/types';

// mongodb adapter example
export class MongoDBStorage implements RefreshTokenStorage {
  private db!: Db;
  private collection!: Collection;

  constructor(private uri: string, private dbName: string) {
    this.connect();
  }

  private async connect() {
    const client = new MongoClient(this.uri);
    await client.connect();
    this.db = client.db(this.dbName);
    this.collection = this.db.collection('refresh_tokens');
    
    // create indexes
    await this.collection.createIndex({ user_id: 1 });
    await this.collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  }

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.collection.insertOne({
      _id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date(),
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
    }));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.collection.deleteMany({ user_id: userId });
  }

  async deleteById(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: id });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.collection.deleteMany({
      expires_at: { $lt: new Date() }
    });
    return result.deletedCount;
  }
}
