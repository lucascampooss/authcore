# security

## security features

this library implements multiple security best practices:

### 1. timing attack prevention

- constant-time token comparison in refresh flow
- all stored tokens are checked, preventing timing-based token discovery

### 2. jwt algorithm enforcement

- explicitly enforces hs256 algorithm
- prevents algorithm confusion attacks (e.g., switching to 'none')

### 3. strong secret validation

- minimum 32 characters required for jwt secrets
- rejects common weak patterns (secret, password, 123, etc.)
- enforces different secrets for access and refresh tokens
- validates character diversity (not only numbers or letters)

### 4. race condition protection

- new refresh tokens are stored before old ones are deleted
- prevents token loss during rotation process

### 5. payload size limits

- maximum 4kb payload size to prevent dos attacks
- validates payload before token generation

### 6. sliding token limits

- configurable maximum refresh count (default: 100)
- prevents infinite session extension
- forces re-authentication after limit

### 7. bcrypt configuration

- enforces salt rounds between 10-20
- default 12 rounds for passwords
- 10 rounds for token hashing (faster, still secure for short-lived tokens)

### 8. token binding

- optional binding to user agent, ip, device id
- detects session hijacking attempts
- configurable per deployment needs

### 9. config sanitization

- jwt secrets are redacted in exposed config
- prevents accidental secret leakage

### 10. clock skew tolerance

- configurable tolerance for distributed systems
- prevents false token expiration

## configuration recommendations

### production secrets

```typescript
// generate strong secrets
import crypto from 'crypto';

const accessSecret = crypto.randomBytes(64).toString('hex');
const refreshSecret = crypto.randomBytes(64).toString('hex');

const auth = createAuth({
  jwt: {
    accessSecret,
    refreshSecret,
    accessExpiry: '15m',
    refreshExpiry: '7d',
    clockTolerance: 5,
  },
  password: {
    saltRounds: 12, // balance between security and performance
  },
  storage: new YourStorage(),
  session: {
    sliding: true,
    maxAge: '30d', // force re-login after 30 days
    maxRefreshes: 100, // limit refresh count
    binding: {
      userAgent: true, // recommended
      deviceId: true, // recommended
      ip: false, // careful with dynamic ips
    },
  },
});
```

### environment variables

```bash
# generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=your-64-char-hex-string-here
JWT_REFRESH_SECRET=your-different-64-char-hex-string-here
```

## security best practices

### 1. secret management

- never commit secrets to version control
- use environment variables or secret management services
- rotate secrets periodically
- use different secrets for different environments

### 2. token expiry

- keep access tokens short-lived (15 minutes recommended)
- refresh tokens can be longer (7 days recommended)
- use sliding tokens with maxage for better ux with security

### 3. storage security

- always use https in production
- implement proper database security
- regularly clean expired tokens
- consider encrypting tokens at rest

### 4. rate limiting

- implement rate limiting on login endpoints
- limit refresh token usage per time window
- monitor for suspicious patterns

### 5. monitoring

- use hooks to log authentication events
- monitor failed login attempts
- alert on unusual patterns (many refreshes, binding mismatches)

### 6. session management

- allow users to view active sessions
- provide logout from all devices functionality
- implement session timeout warnings

## vulnerability disclosure

if you discover a security vulnerability, please email: [your-email]

please do not open public issues for security vulnerabilities.

## security updates

- check changelog for security-related updates
- subscribe to github releases for notifications
- keep dependencies updated

## audit history

- 2026-01-15: initial security audit and fixes
  - fixed timing attack in token comparison
  - added jwt algorithm enforcement
  - implemented strong secret validation
  - fixed race condition in token rotation
  - added payload size limits
  - implemented sliding token limits
  - sanitized config exposure

## dependencies

this library depends on:

- `jsonwebtoken` - jwt implementation
- `bcrypt` - password hashing
- `zod` - validation (peer dependency)

keep these dependencies updated for security patches.

## compliance

this library implements security practices aligned with:

- owasp authentication cheat sheet
- nist digital identity guidelines
- oauth 2.0 security best practices

## license

mit - see license file for details
