import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { RefreshTokenStorage, StoredRefreshToken, SessionMetadata } from '../../src/types';

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
        created_at TEXT NOT NULL,
        session_id TEXT,
        user_agent TEXT,
        ip TEXT,
        device_id TEXT,
        last_used_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id ON refresh_tokens(session_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `);
  }

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO refresh_tokens (
        id, user_id, token_hash, expires_at, created_at,
        session_id, user_agent, ip, device_id, last_used_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      randomUUID(),
      userId,
      tokenHash,
      expiresAt.toISOString(),
      new Date().toISOString(),
      metadata?.sessionId || null,
      metadata?.userAgent || null,
      metadata?.ip || null,
      metadata?.deviceId || null,
      new Date().toISOString()
    );
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const stmt = this.db.prepare('SELECT * FROM refresh_tokens WHERE user_id = ?');
    const rows = stmt.all(userId) as any[];
    return rows.map(this.mapRow);
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    const stmt = this.db.prepare('SELECT * FROM refresh_tokens WHERE session_id = ?');
    const row = stmt.get(sessionId) as any;
    return row ? this.mapRow(row) : null;
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  }

  async deleteById(id: string): Promise<void> {
    this.db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(id);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    this.db.prepare('DELETE FROM refresh_tokens WHERE session_id = ?').run(sessionId);
  }

  async deleteExpired(): Promise<number> {
    const result = this.db
      .prepare('DELETE FROM refresh_tokens WHERE expires_at < ?')
      .run(new Date().toISOString());
    return result.changes;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    this.db
      .prepare('UPDATE refresh_tokens SET expires_at = ?, last_used_at = ? WHERE id = ?')
      .run(expiresAt.toISOString(), new Date().toISOString(), id);
  }

  private mapRow(row: any): StoredRefreshToken {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      sessionId: row.session_id || undefined,
      userAgent: row.user_agent || undefined,
      ip: row.ip || undefined,
      deviceId: row.device_id || undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    };
  }

  close() {
    this.db.close();
  }
}
