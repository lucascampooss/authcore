import { z } from 'zod';
import { UserRole } from '../types';

export const authSchemas = {
  signup: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),

  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),

  refresh: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),

  updateUser: z.object({
    email: z.string().email('Invalid email format').optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
  }),
};
