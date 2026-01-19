export interface SessionMetadata {
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  deviceId?: string;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
  deviceId?: string;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  deviceId?: string;
  lastUsedAt?: Date;
  refreshCount?: number; // track number of refreshes for sliding tokens
}
