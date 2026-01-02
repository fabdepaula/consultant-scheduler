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

  // Verificar se role está populado (não é apenas ObjectId)
  if (typeof user.role === 'object' && '_id' in user.role) {
    const role = user.role as unknown as IRole;
    if (!role.permissions || !Array.isArray(role.permissions)) {
      return [];
    }

    // Verificar se permissions está populado (é IPermission[]) ou não (é ObjectId[])
    // Se o primeiro elemento tem a propriedade 'key', está populado
    const isPopulated = role.permissions.length > 0 && 
      typeof role.permissions[0] === 'object' && 
      'key' in (role.permissions[0] as any);

    if (!isPopulated) {
      // Se não está populado, retornar array vazio (não temos as informações necessárias)
      return [];
    }

    // Extrair as chaves das permissões ativas (agora sabemos que são IPermission[])
    const permissions = (role.permissions as unknown as IPermission[])
      .filter((perm: IPermission) => perm.active)
      .map((perm: IPermission) => perm.key);

    return permissions;
  }

  return [];
};

/**
 * Verifica se o usuário tem uma permissão específica
 */
export const hasPermission = async (userId: string, permissionKey: string): Promise<boolean> => {
  const user = await User.findById(userId);
  
  if (!user) {
    console.log(`[hasPermission] User ${userId} not found`);
    return false;
  }

  // Fallback: Se é admin antigo (sem role), tem todas as permissões
  if (!user.role && user.profile === 'admin') {
    console.log(`[hasPermission] User ${userId} is old admin - granting all permissions`);
    return true;
  }

  if (!user.role) {
    console.log(`[hasPermission] User ${userId} has no role assigned`);
    return false;
  }

  const permissions = await getUserPermissions(userId);
  console.log(`[hasPermission] User ${userId} permissions:`, permissions, `Checking for: ${permissionKey}`);
  const hasAccess = permissions.includes(permissionKey);
  console.log(`[hasPermission] User ${userId} has permission ${permissionKey}:`, hasAccess);
  return hasAccess;
};

/**
 * Verifica se o usuário tem pelo menos uma das permissões fornecidas (OR)
 */
export const hasAnyPermission = async (userId: string, permissionKeys: string[]): Promise<boolean> => {
  const user = await User.findById(userId);
  
  if (!user) {
    return false;
  }

  // Fallback: Se é admin antigo (sem role), tem todas as permissões
  if (!user.role && user.profile === 'admin') {
    return true;
  }

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

