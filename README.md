# @lucascampooss/authcore

framework-agnostic authentication library with jwt, refresh tokens, and rbac.

## features

- jwt access & refresh tokens with automatic rotation
- bcrypt password hashing (configurable rounds)
- role-based access control (rbac)
- storage adapter pattern - use any database
- framework-agnostic middlewares
- typescript with full type safety

## installation

```bash
npm install @lucascampooss/authcore
```

## quick start

```typescript
import { createAuth, MemoryStorage } from '@lucascampooss/authcore';

const auth = createAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
  },
  storage: new MemoryStorage(), // use your own adapter in production
});

// hash password
const hash = await auth.hashPassword('password123');

// generate tokens
const tokens = await auth.generateTokens({
  userId: '123',
  email: 'user@example.com',
  role: UserRole.USER,
});

// verify token
const payload = auth.verifyAccessToken(tokens.accessToken);

// refresh tokens
const newTokens = await auth.refreshTokens(tokens.refreshToken);
```

## storage adapter

implement `RefreshTokenStorage` interface with **any database**:

```typescript
interface RefreshTokenStorage {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByUserId(userId: string): Promise<StoredRefreshToken[]>;
  deleteByUserId(userId: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
```

### supported databases

the library works with any database. see `examples/adapters/` for implementations:

- **sqlite** - better-sqlite3
- **postgres** - pg, drizzle, prisma
- **mongodb** - mongodb driver
- **redis** - redis with ttl
- **mysql** - mysql2
- **any orm** - prisma, drizzle, typeorm, sequelize, etc.

### example: sqlite adapter

```typescript
import Database from 'better-sqlite3';
import { RefreshTokenStorage, StoredRefreshToken } from '@lucascampooss/authcore';

class SQLiteStorage implements RefreshTokenStorage {
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
      )
    `);
  }

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(randomUUID(), userId, tokenHash, expiresAt.toISOString(), new Date().toISOString());
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const stmt = this.db.prepare('SELECT * FROM refresh_tokens WHERE user_id = ?');
    const rows = stmt.all(userId) as any[];
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
    const result = this.db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?')
      .run(new Date().toISOString());
    return result.changes;
  }
}
```

## express integration

```typescript
import express from 'express';
import { createAuth, createAuthMiddleware, UserRole } from '@lucascampooss/authcore';
import { SQLiteStorage } from './sqlite-adapter';

const auth = createAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
  },
  storage: new SQLiteStorage('./db.sqlite'),
});

const middleware = createAuthMiddleware(auth);

// create express-specific middlewares with error handlers
const authenticate = middleware.authenticate((error, req, res) => {
  res.status(401).json({ error: error.message });
});

const authorize = (...roles: UserRole[]) =>
  middleware.authorize(roles, (error, req, res) => {
    res.status(403).json({ error: error.message });
  });

const app = express();
app.use(express.json());

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // find user in your database
  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  
  // verify password
  const isValid = await auth.verifyPassword(password, user.passwordHash);
  if (!isValid) return res.status(401).json({ error: 'invalid credentials' });
  
  // generate tokens
  const tokens = await auth.generateTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  
  res.json(tokens);
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await auth.refreshTokens(refreshToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/auth/logout', authenticate, async (req, res) => {
  await auth.revokeTokens(req.user!.userId);
  res.json({ message: 'logged out' });
});

app.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.get('/admin', authenticate, authorize(UserRole.ADMIN, UserRole.SUPERADMIN), (req, res) => {
  res.json({ message: 'admin area' });
});

app.listen(3000);
```

## api reference

### `createAuth(config)`

creates auth instance with core methods.

**config:**
- `jwt.accessSecret` - secret for access tokens
- `jwt.refreshSecret` - secret for refresh tokens
- `jwt.accessExpiry` - access token expiry (default: '15m')
- `jwt.refreshExpiry` - refresh token expiry (default: '7d')
- `password.saltRounds` - bcrypt rounds (default: 12)
- `storage` - refresh token storage adapter

### `auth.hashPassword(password)`

hash password with bcrypt.

### `auth.verifyPassword(password, hash)`

verify password against hash.

### `auth.generateTokens(payload)`

generate access + refresh tokens. stores refresh token hash in storage.

### `auth.verifyAccessToken(token)`

verify and decode access token. throws if invalid.

### `auth.verifyRefreshToken(token)`

verify and decode refresh token. throws if invalid.

### `auth.refreshTokens(refreshToken)`

rotate refresh token and generate new access token. deletes old refresh token.

### `auth.revokeTokens(userId)`

revoke all user's refresh tokens (logout from all devices).

### `createAuthMiddleware(auth)`

create framework-agnostic middleware factory.

**returns:**
- `authenticate(onError?)` - extracts bearer token, validates, attaches user to request
- `authorize(roles, onError?)` - checks if user has required role

## rbac

```typescript
import { UserRole, hasRole, checkPermission } from '@lucascampooss/authcore';

// built-in roles with hierarchy
UserRole.USER         // level 1
UserRole.ADMIN        // level 2
UserRole.SUPERADMIN   // level 3

// check role hierarchy
hasRole(UserRole.ADMIN, UserRole.USER); // true
hasRole(UserRole.USER, UserRole.ADMIN); // false

// check permissions
checkPermission(UserRole.ADMIN, 'delete:all'); // throws if no permission
```

## validation

optional zod schemas included:

```typescript
import { authSchemas } from '@lucascampooss/authcore';

authSchemas.signup.parse({ email, password });
authSchemas.login.parse({ email, password });
authSchemas.refresh.parse({ refreshToken });
```

## security features

- **token rotation** - old refresh token deleted when refreshing
- **token hashing** - refresh tokens stored as bcrypt hashes
- **configurable bcrypt rounds** - default 12 for passwords, 10 for tokens
- **jwt expiry** - access tokens short-lived, refresh tokens long-lived
- **role hierarchy** - built-in rbac with extensible permissions

## database examples

see `examples/adapters/` for complete implementations with popular databases:

- **sqlite** - `sqlite-adapter.ts` (better-sqlite3)
- **postgres** - `postgres-adapter.ts` (pg driver)
- **mongodb** - `mongodb-adapter.ts` (mongodb driver)
- **redis** - `redis-adapter.ts` (redis with ttl)
- **prisma** - `prisma-adapter.ts` (prisma orm)
- **drizzle** - `drizzle-adapter.ts` (drizzle orm)

all adapters implement the same interface - switch databases without changing auth logic.

## documentation

- **README.md** - this file (quick start & api reference)
- **MINIMAL_ADAPTER.md** - minimal adapter implementation guide

## license

mit
