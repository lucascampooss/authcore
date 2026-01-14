import type { Pool } from 'pg';
import { RefreshTokenStorage, StoredRefreshToken } from '../../src/types';

// postgres adapter example
export class PostgresStorage implements RefreshTokenStorage {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.createTable();
  }

  private async createTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    `);
  }

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), userId, tokenHash, expiresAt]
    );
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const result = await this.pool.query(
      'SELECT * FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    }));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  }

  async deleteById(id: string): Promise<void> {
    await this.pool.query('DELETE FROM refresh_tokens WHERE id = $1', [id]);
  }

  async deleteExpired(): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id'
    );
    return result.rowCount || 0;
  }
}
