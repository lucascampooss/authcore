# getting started with @lucascampooss/authcore

## installation

```bash
npm install @lucascampooss/authcore
```

## step 1: create storage adapter

implement the `RefreshTokenStorage` interface with your database:

```typescript
// sqlite-adapter.ts
import Database from 'better-sqlite3';
import {
  RefreshTokenStorage,
  StoredRefreshToken,
} from '@lucascampooss/authcore';

export class SQLiteStorage implements RefreshTokenStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
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

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<void> {
    this.db
      .prepare(
        `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(
        crypto.randomUUID(),
        userId,
        tokenHash,
        expiresAt.toISOString(),
        new Date().toISOString()
      );
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const rows = this.db
      .prepare('SELECT * FROM refresh_tokens WHERE user_id = ?')
      .all(userId) as any[];
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    }));
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  }

  async deleteById(id: string): Promise<void> {
    this.db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(id);
  }

  async deleteExpired(): Promise<number> {
    const result = this.db
      .prepare('DELETE FROM refresh_tokens WHERE expires_at < ?')
      .run(new Date().toISOString());
    return result.changes;
  }
}
```

## step 2: initialize authcore

```typescript
// auth.ts
import { createAuth } from '@lucascampooss/authcore';
import { SQLiteStorage } from './sqlite-adapter';

export const auth = createAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiry: '15m', // optional, default: '15m'
    refreshExpiry: '7d', // optional, default: '7d'
  },
  password: {
    saltRounds: 12, // optional, default: 12
  },
  storage: new SQLiteStorage('./database.sqlite'),
});
```

## step 3: use in your app (express example)

```typescript
// server.ts
import express from 'express';
import { createAuthMiddleware, UserRole } from '@lucascampooss/authcore';
import { auth } from './auth';

const app = express();
app.use(express.json());

// create middlewares
const middleware = createAuthMiddleware(auth);

const authenticate = middleware.authenticate((error, req, res) => {
  res.status(401).json({ error: error.message });
});

const authorize = (...roles: UserRole[]) =>
  middleware.authorize(roles, (error, req, res) => {
    res.status(403).json({ error: error.message });
  });

// signup
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  // check if user exists (your code)
  // const existingUser = await db.findUserByEmail(email);
  // if (existingUser) return res.status(409).json({ error: 'email exists' });

  // hash password
  const passwordHash = await auth.hashPassword(password);

  // create user (your code)
  // await db.createUser({ email, passwordHash, role: UserRole.USER });

  res.status(201).json({ message: 'user created' });
});

// login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // find user (your code)
  // const user = await db.findUserByEmail(email);
  // if (!user) return res.status(401).json({ error: 'invalid credentials' });

  // example user
  const user = {
    id: '123',
    email: 'user@example.com',
    passwordHash: '$2b$12$...',
    role: UserRole.USER,
  };

  // verify password
  const isValid = await auth.verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  // generate tokens
  const tokens = await auth.generateTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  res.json(tokens);
});

// refresh tokens
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await auth.refreshTokens(refreshToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: (error as Error).message });
  }
});

// logout
app.post('/auth/logout', authenticate, async (req, res) => {
  await auth.revokeTokens(req.user!.userId);
  res.json({ message: 'logged out' });
});

// protected route
app.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// admin only route
app.get(
  '/admin',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN),
  (req, res) => {
    res.json({ message: 'admin area' });
  }
);

app.listen(3000, () => {
  console.log('server running on port 3000');
});
```

## api reference

### `createAuth(config)`

creates auth instance.

**config:**

- `jwt.accessSecret` - secret for access tokens (required)
- `jwt.refreshSecret` - secret for refresh tokens (required)
- `jwt.accessExpiry` - access token expiry (default: '15m')
- `jwt.refreshExpiry` - refresh token expiry (default: '7d')
- `password.saltRounds` - bcrypt rounds (default: 12)
- `storage` - refresh token storage adapter (required)

### `auth.hashPassword(password)`

hash password with bcrypt.

```typescript
const hash = await auth.hashPassword('mypassword');
```

### `auth.verifyPassword(password, hash)`

verify password against hash.

```typescript
const isValid = await auth.verifyPassword('mypassword', hash);
```

### `auth.generateTokens(payload)`

generate access + refresh tokens.

```typescript
const tokens = await auth.generateTokens({
  userId: '123',
  email: 'user@example.com',
  role: UserRole.USER,
});
// returns: { accessToken: '...', refreshToken: '...' }
```

### `auth.verifyAccessToken(token)`

verify and decode access token.

```typescript
const payload = auth.verifyAccessToken(token);
// returns: { userId, email, role, ... }
```

### `auth.refreshTokens(refreshToken)`

rotate refresh token and generate new access token.

```typescript
const newTokens = await auth.refreshTokens(refreshToken);
// returns: { accessToken: '...', refreshToken: '...' }
```

### `auth.revokeTokens(userId)`

revoke all user's refresh tokens (logout from all devices).

```typescript
await auth.revokeTokens(userId);
```

### `createAuthMiddleware(auth)`

create framework-agnostic middleware factory.

```typescript
const middleware = createAuthMiddleware(auth);

// authenticate
const authenticate = middleware.authenticate((error, req, res) => {
  res.status(401).json({ error: error.message });
});

// authorize
const authorize = (...roles) =>
  middleware.authorize(roles, (error, req, res) => {
    res.status(403).json({ error: error.message });
  });
```

## environment variables

```env
JWT_ACCESS_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
DATABASE_PATH=./database.sqlite
```

## testing

use `MemoryStorage` for tests:

```typescript
import { createAuth, MemoryStorage } from '@lucascampooss/authcore';

const testAuth = createAuth({
  jwt: {
    accessSecret: 'test-secret',
    refreshSecret: 'test-refresh-secret',
  },
  storage: new MemoryStorage(),
});
```

## next steps

- see `MINIMAL_ADAPTER.md` for adapter implementation guide
- see `examples/adapters/` for database-specific adapters
- see `examples/express/` for complete express integration
