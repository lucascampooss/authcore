# changelog

all notable changes to this project will be documented in this file.

the format is based on [keep a changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-19

### added

#### session awareness

- added `sessionId` to token payload and response
- new method: `auth.listSessions(userId)` - list all active sessions for a user
- new method: `auth.revokeSession(sessionId)` - revoke specific session
- session metadata support: `userAgent`, `ip`, `deviceId`
- track `lastUsedAt` timestamp for each session

#### sliding refresh tokens

- optional sliding window for refresh tokens
- configure with `session.sliding` and `session.maxAge`
- extends session lifetime on activity while respecting maximum age
- reduces token rotation overhead
- added `maxRefreshes` option to limit refresh count (default: 100)
- added `refreshCount` field in stored refresh tokens

#### event hooks

- `hooks.onLogin` - triggered on successful login
- `hooks.onRefresh` - triggered on token refresh
- `hooks.onLogout` - triggered on logout
- `hooks.onTokenRevoked` - triggered on session revocation
- enables audit logging, analytics, notifications

#### standardized error codes

- new `AuthError` class with semantic error codes
- `AuthErrorCode` enum for type-safe error handling
- codes: `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`,
  `TOKEN_INVALID`, `SESSION_NOT_FOUND`, `INSUFFICIENT_PERMISSIONS`,
  `USER_NOT_AUTHENTICATED`, `TOKEN_BINDING_MISMATCH`
- improved error handling in middleware

#### token binding

- bind refresh tokens to device characteristics
- configure with `session.binding.userAgent`, `session.binding.ip`,
  `session.binding.deviceId`
- validates metadata on token refresh
- throws `TOKEN_BINDING_MISMATCH` on security violation

#### clock skew tolerance

- configure with `jwt.clockTolerance` (seconds)
- handles time differences in distributed systems
- prevents false token expiration errors

#### database adapters

- added mysql adapter (`mysql-adapter.ts`) - mysql2 driver support
- added supabase adapter (`supabase-adapter.ts`) - postgresql as a service
- added typeorm adapter (`typeorm-adapter.ts`) - typescript orm with decorators
- comprehensive database support for all major databases

#### security features

- **timing attack prevention** - constant-time token comparison in refresh flow
- **jwt algorithm enforcement** - explicitly enforces hs256 algorithm to prevent
  algorithm confusion attacks
- **strong secret validation** - minimum 32 characters required, rejects weak
  patterns
- **race condition protection** - stores new token before deleting old one
- **payload size limits** - maximum 4kb to prevent dos attacks
- **config sanitization** - jwt secrets redacted in exposed config
- added `validateSecret()` function for secret strength validation
- added `validateExpiry()` function for expiry format validation
- added security.md documentation

### changed

#### storage adapter interface

- `save()` now accepts optional `metadata` parameter
- added: `findBySessionId(sessionId)` method
- added: `deleteBySessionId(sessionId)` method
- added: optional `updateExpiry(id, expiresAt)` method for sliding tokens
- added: optional `incrementRefreshCount(id)` method for tracking refresh count
- `StoredRefreshToken` now includes: `sessionId`, `userAgent`, `ip`, `deviceId`,
  `lastUsedAt`, `refreshCount`

#### core methods

- `generateTokens()` now accepts optional `metadata` parameter
- `generateTokens()` now returns `sessionId` in response
- `refreshTokens()` now accepts optional `metadata` parameter
- middleware error handlers now receive `AuthError` instead of generic `Error`
- jwt token generation now explicitly sets algorithm to hs256
- token verification enforces hs256 algorithm
- config validation is more strict (secrets, expiry, salt rounds)
- token rotation order changed (store first, delete after)

### backward compatibility

all new features are **optional** and backward compatible:

- existing code continues to work without changes
- `metadata` parameter is optional
- `sessionId` is auto-generated if not provided
- hooks are optional
- token binding is disabled by default
- sliding tokens are disabled by default

---

## [0.1.1] - 2025-01-13

### added

- initial release
- jwt access & refresh tokens
- bcrypt password hashing
- role-based access control (rbac)
- storage adapter pattern
- framework-agnostic middlewares
- typescript support
- memory storage adapter
- zod validation schemas

### features

- token rotation on refresh
- configurable token expiry
- configurable bcrypt rounds
- role hierarchy (user → admin → superadmin)
- permission system
- express middleware examples
- multiple database adapter examples
