import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RefreshTokenStorage, StoredRefreshToken, SessionMetadata } from '../../src/types';

// schema.prisma:
// model RefreshToken {
//   id         String    @id @default(uuid())
//   userId     String    @map("user_id")
//   tokenHash  String    @map("token_hash")
//   expiresAt  DateTime  @map("expires_at")
//   createdAt  DateTime  @default(now()) @map("created_at")
//   sessionId  String?   @map("session_id")
//   userAgent  String?   @map("user_agent")
//   ip         String?
//   deviceId   String?   @map("device_id")
//   lastUsedAt DateTime? @map("last_used_at")
//   @@index([userId])
//   @@index([sessionId])
//   @@map("refresh_tokens")
// }

export class PrismaStorage implements RefreshTokenStorage {
  constructor(private prisma: PrismaClient) {}

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash,
        expiresAt,
        sessionId: metadata?.sessionId,
        userAgent: metadata?.userAgent,
        ip: metadata?.ip,
        deviceId: metadata?.deviceId,
        lastUsedAt: new Date(),
      },
    });
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId },
    });

    return tokens.map(token => ({
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      sessionId: token.sessionId || undefined,
      userAgent: token.userAgent || undefined,
      ip: token.ip || undefined,
      deviceId: token.deviceId || undefined,
      lastUsedAt: token.lastUsedAt || undefined,
    }));
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    const token = await this.prisma.refreshToken.findFirst({
      where: { sessionId },
    });

    if (!token) return null;

    return {
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      sessionId: token.sessionId || undefined,
      userAgent: token.userAgent || undefined,
      ip: token.ip || undefined,
      deviceId: token.deviceId || undefined,
      lastUsedAt: token.lastUsedAt || undefined,
    };
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.refreshToken.delete({
      where: { id },
    });
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { sessionId },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: {
        expiresAt,
        lastUsedAt: new Date(),
      },
    });
  }
}
