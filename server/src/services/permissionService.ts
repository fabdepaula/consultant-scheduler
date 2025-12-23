import User from '../models/User.js';
import { IUser, IRole, IPermission } from '../types/index.js';

/**
 * Obtém todas as permissões de um usuário
 */
export const getUserPermissions = async (userId: string): Promise<string[]> => {
  const user = await User.findById(userId).populate({
    path: 'role',
    populate: { path: 'permissions' }
  });

  if (!user || !user.role) {
    return [];
  }

  const role = user.role as IRole;
  if (!role.permissions || !Array.isArray(role.permissions)) {
    return [];
  }

  // Extrair as chaves das permissões ativas
  const permissions = role.permissions
    .filter((perm: IPermission) => perm.active)
    .map((perm: IPermission) => perm.key);

  return permissions;
};

/**
 * Verifica se o usuário tem uma permissão específica
 */
export const hasPermission = async (userId: string, permissionKey: string): Promise<boolean> => {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permissionKey);
};

/**
 * Verifica se o usuário tem pelo menos uma das permissões fornecidas (OR)
 */
export const hasAnyPermission = async (userId: string, permissionKeys: string[]): Promise<boolean> => {
  const permissions = await getUserPermissions(userId);
  return permissionKeys.some(key => permissions.includes(key));
};

/**
 * Verifica se o usuário tem todas as permissões fornecidas (AND)
 */
export const hasAllPermissions = async (userId: string, permissionKeys: string[]): Promise<boolean> => {
  const permissions = await getUserPermissions(userId);
  return permissionKeys.every(key => permissions.includes(key));
};

