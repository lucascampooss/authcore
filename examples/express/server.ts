import express, { Request, Response, NextFunction } from 'express';
import {
  createAuth,
  createAuthMiddleware,
  UserRole,
  AuthErrorCode,
  SessionMetadata,
  authSchemas,
} from '@lucascampooss/authcore';
import { SQLiteStorage } from './sqlite-adapter';
import rateLimit from 'express-rate-limit';

const auth = createAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiry: '15m',
    refreshExpiry: '7d',
    clockTolerance: 5, // tolerance for clock skew in distributed systems
  },
  password: {
    saltRounds: 12,
  },
  storage: new SQLiteStorage('./database.sqlite'),
  hooks: {
    onLogin: async (payload, metadata) => {
      console.log(`user ${payload.email} logged in from ${metadata?.ip}`);
    },
    onLogout: async (userId, sessionId) => {
      console.log(`user ${userId} logged out (session: ${sessionId})`);
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

const middleware = createAuthMiddleware(auth);

const authenticate = middleware.authenticate<Request, Response>((error, req, res) => {
  const statusCode = error.code === AuthErrorCode.TOKEN_EXPIRED ? 401 : 403;
  res.status(statusCode).json({
    error: error.message,
    code: error.code,
  });
});

const authorize = (...roles: UserRole[]) =>
  middleware.authorize<Request, Response>(roles, (error, req, res) => {
    res.status(403).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  });

const app = express();
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 60000,
  max: 5,
  message: { error: 'too many login attempts' },
});

function getSessionMetadata(req: Request): SessionMetadata {
  return {
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
    deviceId: req.headers['x-device-id'] as string | undefined,
  };
}

app.post('/auth/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = authSchemas.signup.parse(req.body);

    // check if user exists in your database
    // const existingUser = await userRepo.findByEmail(email);
    // if (existingUser) return res.status(409).json({ error: 'email exists' });

    const passwordHash = await auth.hashPassword(password);

    // create user in your database
    // const user = await userRepo.create(email, passwordHash);

    res.status(201).json({ message: 'user created' });
  } catch (error) {
    next(error);
  }
});

app.post('/auth/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = authSchemas.login.parse(req.body);

    // find user in your database
    // const user = await userRepo.findByEmail(email);
    // if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const user = { id: '123', email, passwordHash: 'hash', role: UserRole.USER };

    const isValid = await auth.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'invalid credentials',
        code: AuthErrorCode.INVALID_CREDENTIALS,
      });
    }

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
  } catch (error) {
    next(error);
  }
});

app.post('/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = authSchemas.refresh.parse(req.body);
    const metadata = getSessionMetadata(req);
    const tokens = await auth.refreshTokens(refreshToken, metadata);
    res.json(tokens);
  } catch (error: any) {
    return res.status(401).json({
      error: error.message,
      code: error.code || AuthErrorCode.TOKEN_INVALID,
    });
  }
});

app.post('/auth/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.user!.sessionId;
    if (sessionId) {
      await auth.revokeSession(sessionId);
      res.json({ message: 'logged out from this device' });
    } else {
      await auth.revokeTokens(req.user!.userId);
      res.json({ message: 'logged out' });
    }
  } catch (error) {
    next(error);
  }
});

app.post(
  '/auth/logout-all',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await auth.revokeTokens(req.user!.userId);
      res.json({ message: 'logged out from all devices' });
    } catch (error) {
      next(error);
    }
  }
);

app.get('/auth/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await auth.listSessions(req.user!.userId);
    res.json({
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        expiresAt: s.expiresAt,
        userAgent: s.userAgent,
        ip: s.ip,
        deviceId: s.deviceId,
        isCurrent: s.sessionId === req.user!.sessionId,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.delete(
  '/auth/sessions/:sessionId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const sessions = await auth.listSessions(req.user!.userId);
      const session = sessions.find(s => s.sessionId === sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'session not found',
          code: AuthErrorCode.SESSION_NOT_FOUND,
        });
      }

      await auth.revokeSession(sessionId);
      res.json({ message: 'session revoked' });
    } catch (error) {
      next(error);
    }
  }
);

app.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({
    user: req.user,
    sessionId: req.user!.sessionId,
  });
});

app.get(
  '/admin',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN),
  (req: Request, res: Response) => {
    res.json({ message: 'admin area' });
  }
);

app.listen(3000, () => {
  console.log('server running on port 3000');
});
