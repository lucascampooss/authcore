import { UserRole, hasRole as checkRoleHierarchy } from './roles';

export type Permission = string;

// extensible permission system - customize as needed
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.USER]: ['read:own', 'update:own'],
  [UserRole.ADMIN]: ['read:own', 'update:own', 'read:all', 'update:all', 'delete:all'],
  [UserRole.SUPERADMIN]: ['*'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  return permissions.includes('*') || permissions.includes(permission);
}

export function checkPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`role ${role} does not have permission: ${permission}`);
  }
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return checkRoleHierarchy(userRole, requiredRole);
}
