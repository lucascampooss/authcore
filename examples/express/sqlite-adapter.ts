import Database from 'better-sqlite3';
import { RefreshTokenStorage, StoredRefreshToken } from '../../src/types';

// example sqlite adapter implementation
export class SQLiteStorage implements RefreshTokenStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createTable();
  }

  private createTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    `);
  }

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt.toISOString(),
      new Date().toISOString()
    );
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const stmt = this.db.prepare('SELECT * FROM refresh_tokens WHERE user_id = ?');
    const rows = stmt.all(userId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    }));
  }

  async deleteByUserId(userId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
    stmt.run(userId);
  }

  async deleteById(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM refresh_tokens WHERE id = ?');
    stmt.run(id);
  }

  async deleteExpired(): Promise<number> {
    const stmt = this.db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?');
    const result = stmt.run(new Date().toISOString());
    return result.changes;
  }
}
