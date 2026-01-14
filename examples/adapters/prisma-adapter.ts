import type { PrismaClient } from '@prisma/client';
import { RefreshTokenStorage, StoredRefreshToken } from '../../src/types';

// prisma adapter example
// schema.prisma:
// model RefreshToken {
//   id         String   @id @default(uuid())
//   userId     String   @map("user_id")
//   tokenHash  String   @map("token_hash")
//   expiresAt  DateTime @map("expires_at")
//   createdAt  DateTime @default(now()) @map("created_at")
//   @@index([userId])
//   @@map("refresh_tokens")
// }

export class PrismaStorage implements RefreshTokenStorage {
  constructor(private prisma: PrismaClient) {}

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tokenHash,
        expiresAt,
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
    }));
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

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}
