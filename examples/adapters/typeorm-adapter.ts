import { randomUUID } from 'crypto';
import { Column, DataSource, Entity, Index, PrimaryColumn, Repository } from 'typeorm';
import { RefreshTokenStorage, SessionMetadata, StoredRefreshToken } from '../../src/types';

@Entity('refresh_tokens')
@Index('idx_refresh_tokens_user_id', ['userId'])
@Index('idx_refresh_tokens_session_id', ['sessionId'])
@Index('idx_refresh_tokens_expires_at', ['expiresAt'])
export class RefreshTokenEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id!: string;

  @Column('varchar', { name: 'user_id', length: 255 })
  userId!: string;

  @Column('text', { name: 'token_hash' })
  tokenHash!: string;

  @Column('datetime', { name: 'expires_at' })
  expiresAt!: Date;

  @Column('datetime', { name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column('varchar', { name: 'session_id', length: 255, nullable: true })
  sessionId?: string;

  @Column('text', { name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column('varchar', { name: 'ip', length: 45, nullable: true })
  ip?: string;

  @Column('varchar', { name: 'device_id', length: 255, nullable: true })
  deviceId?: string;

  @Column('datetime', { name: 'last_used_at', nullable: true })
  lastUsedAt?: Date;
}

export class TypeORMStorage implements RefreshTokenStorage {
  private repository: Repository<RefreshTokenEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(RefreshTokenEntity);
  }

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    const token = this.repository.create({
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
    });

    await this.repository.save(token);
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const tokens = await this.repository.find({
      where: { userId },
    });

    return tokens.map(token => ({
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      sessionId: token.sessionId,
      userAgent: token.userAgent,
      ip: token.ip,
      deviceId: token.deviceId,
      lastUsedAt: token.lastUsedAt,
    }));
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    const token = await this.repository.findOne({
      where: { sessionId },
    });

    if (!token) return null;

    return {
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      sessionId: token.sessionId,
      userAgent: token.userAgent,
      ip: token.ip,
      deviceId: token.deviceId,
      lastUsedAt: token.lastUsedAt,
    };
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.repository.delete({ sessionId });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    await this.repository.update(
      { id },
      {
        expiresAt,
        lastUsedAt: new Date(),
      }
    );
  }
}