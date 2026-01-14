# minimal adapter implementation

this is the **absolute minimum** you need to implement to use @lucascampooss/authcore with any database.

## the interface

```typescript
interface RefreshTokenStorage {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByUserId(userId: string): Promise<StoredRefreshToken[]>;
  deleteByUserId(userId: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}
```

## minimal example (in-memory)

```typescript
import { RefreshTokenStorage, StoredRefreshToken } from '@lucascampooss/authcore';

class MinimalStorage implements RefreshTokenStorage {
  private tokens = new Map<string, StoredRefreshToken>();

  async save(userId: string, tokenHash: string, expiresAt: Date) {
    const token = {
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    };
    this.tokens.set(token.id, token);
  }

  async findByUserId(userId: string) {
    return Array.from(this.tokens.values())
      .filter(t => t.userId === userId);
  }

  async deleteByUserId(userId: string) {
    for (const [id, token] of this.tokens) {
      if (token.userId === userId) {
        this.tokens.delete(id);
      }
    }
  }

  async deleteById(id: string) {
    this.tokens.delete(id);
  }

  async deleteExpired() {
    const now = new Date();
    let count = 0;
    for (const [id, token] of this.tokens) {
      if (token.expiresAt < now) {
        this.tokens.delete(id);
        count++;
      }
    }
    return count;
  }
}
```

## what each method does

### `save(userId, tokenHash, expiresAt)`
- **when**: called when user logs in or refreshes token
- **what**: store a new refresh token hash
- **note**: library already hashed the token with bcrypt

### `findByUserId(userId)`
- **when**: called when refreshing tokens
- **what**: return all refresh tokens for a user
- **note**: library will verify which one matches

### `deleteByUserId(userId)`
- **when**: called when user logs out
- **what**: delete all refresh tokens for a user
- **note**: logs out from all devices

### `deleteById(id)`
- **when**: called during token rotation
- **what**: delete a specific token by id
- **note**: old token is deleted when refreshing

### `deleteExpired()`
- **when**: called by your cleanup job (optional)
- **what**: delete all expired tokens
- **note**: returns count of deleted tokens

## that's it!

implement these 5 methods and you can use @lucascampooss/authcore with **any database**.

## real-world example (postgres)

```typescript
import { Pool } from 'pg';
import { RefreshTokenStorage, StoredRefreshToken } from '@lucascampooss/authcore';

class PostgresStorage implements RefreshTokenStorage {
  constructor(private pool: Pool) {}

  async save(userId: string, tokenHash: string, expiresAt: Date) {
    await this.pool.query(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), userId, tokenHash, expiresAt]
    );
  }

  async findByUserId(userId: string) {
    const { rows } = await this.pool.query(
      'SELECT * FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    }));
  }

  async deleteByUserId(userId: string) {
    await this.pool.query(
      'DELETE FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );
  }

  async deleteById(id: string) {
    await this.pool.query(
      'DELETE FROM refresh_tokens WHERE id = $1',
      [id]
    );
  }

  async deleteExpired() {
    const { rowCount } = await this.pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
    );
    return rowCount || 0;
  }
}
```

## usage

```typescript
import { createAuth } from '@lucascampooss/authcore';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const auth = createAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
  },
  storage: new PostgresStorage(pool),
});

// done! now use auth.generateTokens(), auth.refreshTokens(), etc.
```
