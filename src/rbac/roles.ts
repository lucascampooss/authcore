import { UserRole } from '../types';

export { UserRole };

// hierarchical role system: higher number = more permissions
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.SUPERADMIN]: 3,
};

// checks if user role meets or exceeds required role
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function getRoleLevel(role: UserRole): number {
  return roleHierarchy[role];
}
