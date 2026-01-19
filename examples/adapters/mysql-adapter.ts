import { randomUUID } from 'crypto';
import type { Connection, Pool } from 'mysql2/promise';
import { RefreshTokenStorage, SessionMetadata, StoredRefreshToken } from '../../src/types';

export class MySQLStorage implements RefreshTokenStorage {
  private connection: Connection | Pool;

  constructor(connection: Connection | Pool) {
    this.connection = connection;
    this.createTable();
  }

  private async createTable() {
    await this.connection.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        session_id VARCHAR(255),
        user_agent TEXT,
        ip VARCHAR(45),
        device_id VARCHAR(255),
        last_used_at DATETIME,
        INDEX idx_user_id (user_id),
        INDEX idx_session_id (session_id),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    await this.connection.execute(
      `INSERT INTO refresh_tokens (
        id, user_id, token_hash, expires_at, session_id, user_agent, ip, device_id, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        tokenHash,
        expiresAt,
        metadata?.sessionId || null,
        metadata?.userAgent || null,
        metadata?.ip || null,
        metadata?.deviceId || null,
        new Date(),
      ]
    );
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const [rows] = await this.connection.execute(
      'SELECT * FROM refresh_tokens WHERE user_id = ?',
      [userId]
    );

    return (rows as any[]).map(row => ({
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
    }));
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    const [rows] = await this.connection.execute(
      'SELECT * FROM refresh_tokens WHERE session_id = ? LIMIT 1',
      [sessionId]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return null;

    const row = rowsArray[0];
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

  async deleteByUserId(userId: string): Promise<void> {
    await this.connection.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }

  async deleteById(id: string): Promise<void> {
    await this.connection.execute('DELETE FROM refresh_tokens WHERE id = ?', [id]);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.connection.execute('DELETE FROM refresh_tokens WHERE session_id = ?', [sessionId]);
  }

  async deleteExpired(): Promise<number> {
    const [result] = await this.connection.execute(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
    );
    return (result as any).affectedRows || 0;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    await this.connection.execute(
      'UPDATE refresh_tokens SET expires_at = ?, last_used_at = ? WHERE id = ?',
      [expiresAt, new Date(), id]
    );
  }
}