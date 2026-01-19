# architecture

## overview

authcore is a modular, framework-agnostic authentication library built with
typescript. it follows clean architecture principles with clear separation of
concerns and dependency inversion.

## design principles

### 1. framework agnostic

- no dependencies on specific web frameworks
- middleware factory pattern for framework integration
- works with express, fastify, koa, next.js, etc.

### 2. storage agnostic

- adapter pattern for data persistence
- works with any database (sql, nosql, in-memory)
- simple interface with 7 methods

### 3. security first

- timing attack prevention
- jwt algorithm enforcement
- strong secret validation
- token binding capabilities
- comprehensive error handling

### 4. modular design

- small, focused modules
- tree-shakeable exports
- easy to test and maintain
- extensible architecture

## project structure

```
src/
├── types/              # type definitions
│   ├── auth.ts         # core auth types
│   ├── errors.ts       # error codes and classes
│   ├── hooks.ts        # event hook types
│   ├── middleware.ts   # middleware types
│   ├── roles.ts        # rbac types
│   ├── session.ts      # session management types
│   ├── storage.ts      # storage adapter interface
│   └── index.ts        # type exports
│
├── core/               # core business logic
│   ├── auth.ts         # main auth factory
│   ├── password.ts     # password hashing
│   ├── validation.ts   # config validation
│   ├── tokens/         # jwt token management
│   │   ├── generate.ts # token generation
│   │   ├── verify.ts   # token verification
│   │   └── index.ts    # token exports
│   └── refresh/        # refresh token logic
│       ├── binding.ts  # token binding validation
│       ├── expiry.ts   # expiry calculations
│       ├── flow.ts     # refresh flow orchestration
│       ├── hash.ts     # token hashing utilities
│       ├── revoke.ts   # token revocation
│       └── index.ts    # refresh exports
│
├── session/            # session management
│   ├── manager.ts      # session operations
│   └── index.ts        # session exports
│
├── middleware/         # framework integration
│   ├── authenticate.ts # authentication middleware
│   ├── authorize.ts    # authorization middleware
│   ├── factories.ts    # middleware factory
│   └── index.ts        # middleware exports
│
├── rbac/               # role-based access control
│   ├── roles.ts        # role definitions and hierarchy
│   ├── permissions.ts  # permission system
│   └── index.ts        # rbac exports
│
├── adapters/           # storage implementations
│   └── memory.ts       # in-memory adapter (dev/test)
│
├── validation/         # input validation
│   └── schemas.ts      # zod schemas
│
└── index.ts            # main library export
```

## core components

### 1. auth factory (`core/auth.ts`)

the main entry point that orchestrates all components:

```typescript
export function createAuth(config: AuthConfig): AuthInstance;
```

**responsibilities:**

- validates configuration
- creates auth instance with all methods
- manages internal dependencies
- sanitizes exposed config

### 2. token management (`core/tokens/`)

handles jwt token lifecycle:

**generate.ts:**

- creates access and refresh tokens
- validates payload size (dos prevention)
- enforces hs256 algorithm

**verify.ts:**

- verifies token signatures
- handles clock skew tolerance
- provides structured error handling

### 3. refresh flow (`core/refresh/`)

manages refresh token operations:

**flow.ts:**

- orchestrates token refresh process
- implements sliding token logic
- handles token rotation with race condition protection

**binding.ts:**

- validates token binding (user agent, ip, device id)
- prevents session hijacking

**hash.ts:**

- hashes refresh tokens for storage
- uses constant-time comparison

### 4. session management (`session/`)

handles multi-device sessions:

**manager.ts:**

- lists active sessions
- provides session metadata
- filters expired sessions

### 5. middleware (`middleware/`)

framework integration layer:

**authenticate.ts:**

- extracts bearer tokens
- validates access tokens
- attaches user to request

**authorize.ts:**

- checks user roles
- validates permissions
- provides structured errors

### 6. storage adapter (`types/storage.ts`)

defines storage interface:

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
  updateExpiry?(id: string, expiresAt: Date): Promise<void>;
  incrementRefreshCount?(id: string): Promise<void>;
}
```

## data flow

### 1. login flow

```
user credentials → auth.generateTokens() → token generation → storage.save() → tokens returned
```

1. user provides credentials
2. app validates credentials
3. calls `auth.generateTokens(payload, metadata)`
4. generates access + refresh tokens
5. hashes refresh token
6. stores in database with metadata
7. returns tokens to client
8. triggers `onLogin` hook

### 2. request authentication

```
request → middleware.authenticate() → token verification → user attached to request
```

1. client sends request with bearer token
2. middleware extracts token
3. verifies token signature and expiry
4. attaches user payload to request
5. continues to protected route

### 3. token refresh

```
refresh token → auth.refreshTokens() → validation → new tokens → storage update
```

1. client sends refresh token
2. verifies refresh token signature
3. finds token in storage (constant-time search)
4. validates token binding
5. generates new tokens
6. updates/rotates stored token
7. returns new tokens
8. triggers `onRefresh` hook

### 4. session management

```
user id → storage.findByUserId() → filter active → return session list
```

1. client requests session list
2. queries storage by user id
3. filters expired sessions
4. maps to session info format
5. returns active sessions

## security architecture

### 1. defense in depth

**layer 1: input validation**

- strong secret validation
- payload size limits
- expiry format validation

**layer 2: cryptographic security**

- bcrypt password hashing
- jwt with enforced algorithm
- refresh token hashing

**layer 3: timing attack prevention**

- constant-time token comparison
- consistent response times

**layer 4: session security**

- token binding validation
- session metadata tracking
- configurable refresh limits

### 2. error handling

structured error system with semantic codes:

```typescript
enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  USER_NOT_AUTHENTICATED = 'USER_NOT_AUTHENTICATED',
  TOKEN_BINDING_MISMATCH = 'TOKEN_BINDING_MISMATCH',
}
```

### 3. configuration security

- secrets are validated for strength
- different secrets required for access/refresh
- config sanitization (secrets redacted)
- safe defaults for all options

## extensibility

### 1. storage adapters

implement `RefreshTokenStorage` interface:

```typescript
class CustomStorage implements RefreshTokenStorage {
  // implement 7 required methods + 2 optional
}
```

### 2. event hooks

react to authentication events:

```typescript
const auth = createAuth({
  hooks: {
    onLogin: async (payload, metadata) => {
      // custom logic: logging, analytics, notifications
    },
    onRefresh: async (payload, metadata) => {
      // custom logic: rate limiting, monitoring
    },
  },
});
```

### 3. middleware integration

create framework-specific wrappers:

```typescript
// express
const authenticate = middleware.authenticate((error, req, res) => {
  res.status(401).json({ error: error.message, code: error.code });
});

// fastify
const fastifyAuth = async (request, reply) => {
  try {
    const payload = auth.verifyAccessToken(token);
    request.user = payload;
  } catch (error) {
    reply.code(401).send({ error: error.message });
  }
};
```

## performance considerations

### 1. token operations

- **generation**: o(1) - jwt signing is fast
- **verification**: o(1) - jwt verification is fast
- **refresh**: o(n) - where n = user's active tokens (typically < 10)

### 2. storage operations

- **save**: depends on storage adapter
- **find**: should use database indexes on `user_id` and `session_id`
- **delete**: batch operations for efficiency

### 3. memory usage

- **tokens**: stored as hashes, not plaintext
- **sessions**: minimal metadata stored
- **config**: single instance, shared across requests

### 4. recommended indexes

```sql
-- essential indexes
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_session_id ON refresh_tokens(session_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- composite index for cleanup
CREATE INDEX idx_refresh_tokens_expires_user ON refresh_tokens(expires_at, user_id);
```

## testing strategy

### 1. unit tests

- each module tested in isolation
- mock dependencies
- test error conditions
- security edge cases

### 2. integration tests

- test complete flows
- real storage adapters
- middleware integration
- timing attack resistance

### 3. security tests

- weak secret rejection
- timing attack prevention
- token binding validation
- race condition handling

## deployment considerations

### 1. environment setup

```bash
# strong secrets (64+ characters)
JWT_ACCESS_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)

# database connection
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### 2. monitoring

- hook into authentication events
- monitor failed attempts
- track token binding violations
- alert on unusual patterns

### 3. maintenance

- regular secret rotation
- cleanup expired tokens
- monitor storage performance
- update dependencies

## migration guide

### from v0.1.x to v0.2.0

1. **storage adapter**: add new methods (optional, backward compatible)
2. **error handling**: update to use `AuthError` class
3. **configuration**: add session options (optional)
4. **metadata**: pass session metadata (optional)

all changes are backward compatible - existing code continues to work.

## future roadmap

### planned features

- **rate limiting**: built-in rate limiting for auth operations
- **token revocation list**: centralized token blacklist
- **audit logging**: comprehensive audit trail
- **multi-factor auth**: totp/sms integration

### architectural improvements

- **plugin system**: extensible plugin architecture
- **caching layer**: optional redis caching
- **metrics**: built-in prometheus metrics
- **clustering**: distributed session management

## contributing

### code organization

- one responsibility per file
- clear module boundaries
- comprehensive type definitions
- security-first mindset

### testing requirements

- 100% test coverage for security-critical code
- timing attack resistance tests
- integration tests for all adapters
- performance benchmarks

### documentation

- inline code documentation
- architecture decision records
- security considerations
- migration guides

---

this architecture enables authcore to be secure, performant, and extensible
while maintaining simplicity and ease of use.
