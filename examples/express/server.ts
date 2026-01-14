import express, { Request, Response, NextFunction } from 'express';
import { createAuth, createAuthMiddleware, UserRole, authSchemas } from '@lucascampooss/authcore';
import { SQLiteStorage } from './sqlite-adapter';
import rateLimit from 'express-rate-limit';

const auth = createAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },
  password: {
    saltRounds: 12,
  },
  storage: new SQLiteStorage('./database.sqlite'),
});

const middleware = createAuthMiddleware(auth);

const authenticate = middleware.authenticate<Request, Response>(
  (error, req, res) => {
    res.status(401).json({ error: error.message });
  }
);

const authorize = (...roles: UserRole[]) => 
  middleware.authorize<Request, Response>(
    roles,
    (error, req, res) => {
      res.status(403).json({ error: error.message });
    }
  );

const app = express();
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 60000,
  max: 5,
  message: { error: 'too many login attempts' },
});

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
    
    // example: assuming user exists
    const user = { id: '123', email, passwordHash: 'hash', role: UserRole.USER };
    
    const isValid = await auth.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    
    const tokens = await auth.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    
    res.json(tokens);
  } catch (error) {
    next(error);
  }
});

app.post('/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = authSchemas.refresh.parse(req.body);
    const tokens = await auth.refreshTokens(refreshToken);
    res.json(tokens);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
});

app.post('/auth/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await auth.revokeTokens(req.user!.userId);
    res.json({ message: 'logged out' });
  } catch (error) {
    next(error);
  }
});

app.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

app.get('/admin', authenticate, authorize(UserRole.ADMIN, UserRole.SUPERADMIN), (req: Request, res: Response) => {
  res.json({ message: 'admin area' });
});

app.listen(3000, () => {
  console.log('server running on port 3000');
});
