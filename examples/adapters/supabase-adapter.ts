import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { RefreshTokenStorage, SessionMetadata, StoredRefreshToken } from '../../src/types';

// create table refresh_tokens (
//   id text primary key,
//   user_id text not null,
//   token_hash text not null,
//   expires_at timestamp with time zone not null,
//   created_at timestamp with time zone not null default now(),
//   session_id text,
//   user_agent text,
//   ip text,
//   device_id text,
//   last_used_at timestamp with time zone
// );
// create index idx_refresh_tokens_user_id on refresh_tokens(user_id);
// create index idx_refresh_tokens_session_id on refresh_tokens(session_id);
// create index idx_refresh_tokens_expires_at on refresh_tokens(expires_at);

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  session_id: string | null;
  user_agent: string | null;
  ip: string | null;
  device_id: string | null;
  last_used_at: string | null;
}

export class SupabaseStorage implements RefreshTokenStorage {
  constructor(private supabase: SupabaseClient) {}

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    const { error } = await this.supabase.from('refresh_tokens').insert({
      id: randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      session_id: metadata?.sessionId || null,
      user_agent: metadata?.userAgent || null,
      ip: metadata?.ip || null,
      device_id: metadata?.deviceId || null,
      last_used_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`failed to save refresh token: ${error.message}`);
    }
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`failed to find tokens by user id: ${error.message}`);
    }

    return (data as RefreshTokenRow[]).map(row => ({
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
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // no rows returned
      throw new Error(`failed to find token by session id: ${error.message}`);
    }

    const row = data as RefreshTokenRow;
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
    const { error } = await this.supabase
      .from('refresh_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`failed to delete tokens by user id: ${error.message}`);
    }
  }

  async deleteById(id: string): Promise<void> {
    const { error } = await this.supabase.from('refresh_tokens').delete().eq('id', id);

    if (error) {
      throw new Error(`failed to delete token by id: ${error.message}`);
    }
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('refresh_tokens')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`failed to delete token by session id: ${error.message}`);
    }
  }

  async deleteExpired(): Promise<number> {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      throw new Error(`failed to delete expired tokens: ${error.message}`);
    }

    return data?.length || 0;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    const { error } = await this.supabase
      .from('refresh_tokens')
      .update({
        expires_at: expiresAt.toISOString(),
        last_used_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`failed to update token expiry: ${error.message}`);
    }
  }
}