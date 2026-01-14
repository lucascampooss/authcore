// implement this interface with your database of choice
export interface RefreshTokenStorage {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByUserId(userId: string): Promise<StoredRefreshToken[]>;
  deleteByUserId(userId: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}
