import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
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

    // Perfil Admin do sistema: todas as permissões ativas no banco
    if (role.key === 'admin') {
      const all = await Permission.find({ active: true }).select('key');
      return all.map((p) => p.key);
    }

    // Verificar se permissions está populado (tem .key) ou são só ObjectIds
    const isPopulated =
      role.permissions.length > 0 &&
      typeof role.permissions[0] === 'object' &&
      role.permissions[0] !== null &&
      'key' in (role.permissions[0] as object);

    if (isPopulated) {
      return (role.permissions as unknown as IPermission[])
        .filter((perm: IPermission) => perm?.active !== false)
        .map((perm: IPermission) => perm.key);
    }

    // ObjectIds sem populate — buscar documentos de permissão
    const permissionIds = role.permissions
      .map((p) => (typeof p === 'object' && p && '_id' in p ? (p as { _id: unknown })._id : p))
      .filter(Boolean);

    if (permissionIds.length === 0) {
      return [];
    }

    const docs = await Permission.find({ _id: { $in: permissionIds }, active: true }).select('key');
    return docs.map((p) => p.key);
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

  // Usuário com perfil Admin (role.key) tem acesso total
  if (user.role) {
    const roleId = typeof user.role === 'object' && '_id' in user.role ? user.role._id : user.role;
    const roleDoc = await Role.findById(roleId).select('key');
    if (roleDoc?.key === 'admin') {
      return true;
    }
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

