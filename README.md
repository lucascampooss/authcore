# @lucascampooss/authcore

[![npm version](https://badge.fury.io/js/%40lucascampooss%2Fauthcore.svg)](https://www.npmjs.com/package/@lucascampooss/authcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

framework-agnostic authentication library with jwt, refresh tokens, and rbac.

## features

### core

- jwt access & refresh tokens with automatic rotation
- bcrypt password hashing (configurable rounds)
- role-based access control (rbac)
- storage adapter pattern - use any database
- framework-agnostic middlewares
- typescript with full type safety

### advanced

- **session awareness** - multi-device management
- **sliding refresh tokens** - extended sessions with security
- **event hooks** - extensible lifecycle events
- **standardized error codes** - type-safe error handling
- **token binding** - enhanced security (userAgent, ip, deviceId)
- **clock skew tolerance** - distributed system support

### security

- **timing attack prevention** - constant-time token comparison
- **jwt algorithm enforcement** - prevents algorithm confusion attacks
- **strong secret validation** - minimum 32 characters, rejects weak patterns
- **race condition protection** - safe token rotation
- **payload size limits** - prevents dos attacks
- **config sanitization** - secrets redacted in exposed config

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

### advanced usage

```typescript
import { createAuth, AuthErrorCode } from '@lucascampooss/authcore';

const auth = createAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    clockTolerance: 5, // seconds
  },
  storage: new YourStorage(),
  hooks: {
    onLogin: async (payload, metadata) => {
      console.log(`user ${payload.email} logged in from ${metadata?.ip}`);
    },
    onLogout: async (userId, sessionId) => {
      console.log(`user logged out: ${sessionId}`);
    },
  },
  session: {
    sliding: true, // extends token expiry on each refresh
    maxAge: '30d', // maximum session lifetime
    binding: {
      userAgent: true,
      deviceId: true,
    },
  },
});

// login with session metadata
const tokens = await auth.generateTokens(
  { userId: '123', email: 'user@example.com', role: UserRole.USER },
  {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    deviceId: req.headers['x-device-id'],
  }
);

// list active sessions (multi-device)
const sessions = await auth.listSessions('123');

// logout from specific device
await auth.revokeSession(sessionId);

// error handling with codes
try {
  await auth.refreshTokens(token);
} catch (error) {
  if (error.code === AuthErrorCode.TOKEN_EXPIRED) {
    // handle expired token
  }
}
```

## storage adapter

implement `RefreshTokenStorage` interface with **any database**:

```typescript
interface RefreshTokenStorage {
  save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void>;
  findByUserId(userId: string): Promise<StoredRefreshToken[]>;
  findBySessionId(sessionId: string): Promise<StoredRefreshToken | null>;
  deleteByUserId(userId: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteBySessionId(sessionId: string): Promise<void>;
  deleteExpired(): Promise<number>;
  updateExpiry?(id: string, expiresAt: Date): Promise<void>; // optional, for sliding tokens
  incrementRefreshCount?(id: string): Promise<void>; // optional, for refresh count tracking
}
```

### supported databases

the library works with any database. see `examples/adapters/` for
implementations:

- **sqlite** - better-sqlite3
- **postgres** - pg, drizzle, prisma
- **mongodb** - mongodb driver
- **redis** - redis with ttl
- **mysql** - mysql2
- **supabase** - postgresql as a service
- **typeorm** - typescript orm with decorators
- **any orm** - prisma, drizzle, sequelize, etc.

### example: sqlite adapter

```typescript
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  RefreshTokenStorage,
  StoredRefreshToken,
  SessionMetadata,
} from '@lucascampooss/authcore';

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
        created_at TEXT NOT NULL,
        session_id TEXT,
        user_agent TEXT,
        ip TEXT,
        device_id TEXT,
        last_used_at TEXT,
        refresh_count INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id ON refresh_tokens(session_id);
    `);
  }

  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: SessionMetadata
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO refresh_tokens (
        id, user_id, token_hash, expires_at, created_at,
        session_id, user_agent, ip, device_id, last_used_at, refresh_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      randomUUID(),
      userId,
      tokenHash,
      expiresAt.toISOString(),
      new Date().toISOString(),
      metadata?.sessionId || null,
      metadata?.userAgent || null,
      metadata?.ip || null,
      metadata?.deviceId || null,
      new Date().toISOString(),
      0
    );
  }

  async findByUserId(userId: string): Promise<StoredRefreshToken[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM refresh_tokens WHERE user_id = ?'
    );
    const rows = stmt.all(userId) as any[];
    return rows.map(row => ({
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
      refreshCount: row.refresh_count || 0,
    }));
  }

  async findBySessionId(sessionId: string): Promise<StoredRefreshToken | null> {
    const stmt = this.db.prepare(
      'SELECT * FROM refresh_tokens WHERE session_id = ?'
    );
    const row = stmt.get(sessionId) as any;
    return row ? this.mapRow(row) : null;
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  }

  async deleteById(id: string): Promise<void> {
    this.db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(id);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM refresh_tokens WHERE session_id = ?')
      .run(sessionId);
  }

  async deleteExpired(): Promise<number> {
    const result = this.db
      .prepare('DELETE FROM refresh_tokens WHERE expires_at < ?')
      .run(new Date().toISOString());
    return result.changes;
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    this.db
      .prepare(
        'UPDATE refresh_tokens SET expires_at = ?, last_used_at = ?, refresh_count = refresh_count + 1 WHERE id = ?'
      )
      .run(expiresAt.toISOString(), new Date().toISOString(), id);
  }

  private mapRow(row: any): StoredRefreshToken {
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
      refreshCount: row.refresh_count || 0,
    };
  }
}
```

## express integration

```typescript
import express from 'express';
import {
  createAuth,
  createAuthMiddleware,
  UserRole,
  AuthErrorCode,
} from '@lucascampooss/authcore';
import { SQLiteStorage } from './sqlite-adapter';

const auth = createAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    clockTolerance: 5,
  },
  storage: new SQLiteStorage('./db.sqlite'),
  hooks: {
    onLogin: async (payload, metadata) => {
      console.log(`user ${payload.email} logged in from ${metadata?.ip}`);
    },
  },
  session: {
    sliding: true,
    maxAge: '30d',
    binding: {
      userAgent: true,
      deviceId: true,
    },
  },
});

const middleware = createAuthMiddleware(auth);

const authenticate = middleware.authenticate((error, req, res) => {
  const statusCode = error.code === AuthErrorCode.TOKEN_EXPIRED ? 401 : 403;
  res.status(statusCode).json({
    error: error.message,
    code: error.code,
  });
});

const authorize = (...roles: UserRole[]) =>
  middleware.authorize(roles, (error, req, res) => {
    res.status(403).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  });

const app = express();
app.use(express.json());

function getSessionMetadata(req) {
  return {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    deviceId: req.headers['x-device-id'],
  };
}

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);
  if (!user)
    return res.status(401).json({
      error: 'invalid credentials',
      code: AuthErrorCode.INVALID_CREDENTIALS,
    });

  const isValid = await auth.verifyPassword(password, user.passwordHash);
  if (!isValid)
    return res.status(401).json({
      error: 'invalid credentials',
      code: AuthErrorCode.INVALID_CREDENTIALS,
    });

  const metadata = getSessionMetadata(req);
  const tokens = await auth.generateTokens(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    metadata
  );

  res.json(tokens);
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const metadata = getSessionMetadata(req);
    const tokens = await auth.refreshTokens(refreshToken, metadata);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({
      error: error.message,
      code: error.code || AuthErrorCode.TOKEN_INVALID,
    });
  }
});

app.post('/auth/logout', authenticate, async (req, res) => {
  const sessionId = req.user.sessionId;
  if (sessionId) {
    await auth.revokeSession(sessionId);
    res.json({ message: 'logged out from this device' });
  } else {
    await auth.revokeTokens(req.user.userId);
    res.json({ message: 'logged out' });
  }
});

app.get('/auth/sessions', authenticate, async (req, res) => {
  const sessions = await auth.listSessions(req.user.userId);
  res.json({ sessions });
});

app.delete('/auth/sessions/:sessionId', authenticate, async (req, res) => {
  await auth.revokeSession(req.params.sessionId);
  res.json({ message: 'session revoked' });
});

app.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
    sessionId: req.user.sessionId,
  });
});

app.get(
  '/admin',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN),
  (req, res) => {
    res.json({ message: 'admin area' });
  }
);

app.listen(3000);
```

## api reference

### `createAuth(config)`

creates auth instance with core methods.

**config:**

- `jwt.accessSecret` - secret for access tokens (min 32 chars)
- `jwt.refreshSecret` - secret for refresh tokens (min 32 chars, must be
  different)
- `jwt.accessExpiry` - access token expiry (default: '15m')
- `jwt.refreshExpiry` - refresh token expiry (default: '7d')
- `jwt.clockTolerance` - clock skew tolerance in seconds (default: 0)
- `password.saltRounds` - bcrypt rounds (default: 12, range: 10-20)
- `storage` - refresh token storage adapter
- `hooks` - optional event hooks (onLogin, onRefresh, onLogout, onTokenRevoked)
- `session.sliding` - enable sliding refresh tokens (default: false)
- `session.maxAge` - maximum session lifetime for sliding tokens
- `session.maxRefreshes` - maximum refresh count (default: 100)
- `session.binding` - token binding options (userAgent, ip, deviceId)

### `auth.hashPassword(password)`

hash password with bcrypt.

### `auth.verifyPassword(password, hash)`

verify password against hash.

### `auth.generateTokens(payload, metadata?)`

generate access + refresh tokens. stores refresh token hash in storage.

**new parameters:**

- `metadata` - optional session metadata (userAgent, ip, deviceId, sessionId)

**returns:**

- `{ accessToken, refreshToken, sessionId }`

### `auth.verifyAccessToken(token)`

verify and decode access token. throws `AuthError` if invalid.

### `auth.verifyRefreshToken(token)`

verify and decode refresh token. throws `AuthError` if invalid.

### `auth.refreshTokens(refreshToken, metadata?)`

rotate refresh token and generate new access token. validates token binding if
enabled.

### `auth.revokeTokens(userId)`

revoke all user's refresh tokens (logout from all devices).

### `auth.revokeSession(sessionId)`

revoke specific session (logout from one device).

### `auth.listSessions(userId)`

list all active sessions for a user.

**returns:**

```typescript
SessionInfo[] = {
  sessionId: string;
  userId: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
  deviceId?: string;
}[]
```

### `createAuthMiddleware(auth)`

create framework-agnostic middleware factory.

**returns:**

- `authenticate(onError?)` - extracts bearer token, validates, attaches user to
  request
- `authorize(roles, onError?)` - checks if user has required role

**error handling:**

- error handlers now receive `AuthError` with semantic codes
- `error.code` contains `AuthErrorCode` enum value
- `error.details` may contain additional context

## rbac

```typescript
import { UserRole, hasRole, checkPermission } from '@lucascampooss/authcore';

// built-in roles with hierarchy
UserRole.USER; // level 1
UserRole.ADMIN; // level 2
UserRole.SUPERADMIN; // level 3

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

- **timing attack prevention** - constant-time token comparison
- **jwt algorithm enforcement** - prevents algorithm confusion attacks
- **strong secret validation** - minimum 32 characters, rejects weak patterns
- **race condition protection** - safe token rotation order
- **payload size limits** - maximum 4kb to prevent dos attacks
- **token binding** - optional binding to user agent, ip, device id
- **token rotation** - old refresh token deleted when refreshing
- **token hashing** - refresh tokens stored as bcrypt hashes
- **configurable bcrypt rounds** - default 12 for passwords, 10 for tokens
- **jwt expiry** - access tokens short-lived, refresh tokens long-lived
- **role hierarchy** - built-in rbac with extensible permissions
- **config sanitization** - secrets redacted in exposed config
- **refresh limits** - configurable maximum refresh count for sliding tokens

## environment setup

```bash
# generate strong secrets (recommended)
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# or use openssl
JWT_ACCESS_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
```

**important:**

- secrets must be at least 32 characters
- access and refresh secrets must be different
- avoid weak patterns like 'secret', 'password', '123456'

## database examples

see `examples/adapters/` for complete implementations with popular databases:

- **sqlite** - `sqlite-adapter.ts` (better-sqlite3)
- **postgres** - `postgres-adapter.ts` (pg driver)
- **mongodb** - `mongodb-adapter.ts` (mongodb driver)
- **redis** - `redis-adapter.ts` (redis with ttl)
- **mysql** - `mysql-adapter.ts` (mysql2 driver)
- **supabase** - `supabase-adapter.ts` (postgresql as a service)
- **prisma** - `prisma-adapter.ts` (prisma orm)
- **drizzle** - `drizzle-adapter.ts` (drizzle orm)
- **typeorm** - `typeorm-adapter.ts` (typescript orm)

all adapters implement the same interface - switch databases without changing
auth logic.

## documentation

- **README.md** - this file (quick start & api reference)
- **ARCHITECTURE.md** - detailed architecture documentation
- **SECURITY.md** - security features and best practices
- **CHANGELOG.md** - version history and changes
- **MINIMAL_ADAPTER.md** - minimal adapter implementation guide

## examples

complete examples available in `examples/` directory:

- **express server** - `examples/express/server.ts`
- **database adapters** - `examples/adapters/`
  - sqlite (better-sqlite3)
  - postgres (pg driver)
  - mongodb (mongodb driver)
  - redis (redis with ttl)
  - mysql (mysql2 driver)
  - supabase (postgresql as a service)
  - prisma (prisma orm)
  - drizzle (drizzle orm)
  - typeorm (typescript orm)

## contributing

contributions welcome! please read:

1. **security first** - all changes must maintain security standards
2. **backward compatibility** - don't break existing apis
3. **comprehensive tests** - include unit and integration tests
4. **documentation** - update relevant docs

## support

- 📖 [documentation](./ARCHITECTURE.md)
- 🔒 [security guide](./SECURITY.md)
- 🐛 [issues](https://github.com/lucascampooss/authcore/issues)
- 💬 [discussions](https://github.com/lucascampooss/authcore/discussions)

## license

mit - see [license](./LICENSE) file for details
