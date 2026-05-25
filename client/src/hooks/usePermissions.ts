import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { rolesAPI } from '../services/api';
import { Permission, Role } from '../types';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

function extractPermissionKeys(role: Role | null): string[] {
  if (!role?.permissions || !Array.isArray(role.permissions)) {
    return [];
  }

  return role.permissions
    .map((perm: Permission | string) => {
      if (typeof perm === 'object' && perm !== null && 'key' in perm) {
        return perm.active !== false ? perm.key : null;
      }
      if (typeof perm === 'string') {
        // Ignorar ObjectIds crus — não são chaves de permissão
        if (OBJECT_ID_RE.test(perm)) {
          return null;
        }
        return perm;
      }
      return null;
    })
    .filter((key): key is string => Boolean(key));
}

function userHasAdminAccess(user: { profile?: string; role?: Role | string | null } | null): boolean {
  if (!user) return false;
  if (user.profile === 'admin') return true;
  const role = typeof user.role === 'object' ? user.role : null;
  return role?.key === 'admin';
}

export const usePermissions = () => {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        setPermissions([]);
        setRole(null);
        setLoading(false);
        return;
      }

      if (userHasAdminAccess(user)) {
        setPermissions([]);
        setRole(typeof user.role === 'object' ? user.role : null);
        setLoading(false);
        return;
      }

      const roleId =
        typeof user.role === 'string'
          ? user.role
          : user.role?._id || user.role?.id;

      if (roleId) {
        try {
          const roleResponse = await rolesAPI.getById(roleId);
          if (cancelled) return;
          const fetchedRole = roleResponse.data.role as Role;
          setRole(fetchedRole);
          setPermissions(extractPermissionKeys(fetchedRole));
          setLoading(false);
          return;
        } catch (err) {
          console.error('[usePermissions] Erro ao buscar role:', err);
        }
      }

      // Fallback: role já veio populado no login
      const inlineRole = typeof user.role === 'object' ? user.role : null;
      if (inlineRole) {
        const keys = extractPermissionKeys(inlineRole);
        setRole(inlineRole);
        setPermissions(keys);
      } else if (user.profile === 'admin') {
        setPermissions([]);
      } else {
        setPermissions(['allocations.view']);
      }
      setLoading(false);
    };

    setLoading(true);
    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasPermission = (permissionKey: string): boolean => {
    if (userHasAdminAccess(user)) {
      return true;
    }
    return permissions.includes(permissionKey);
  };

  const hasAnyPermission = (...keys: string[]): boolean => {
    if (userHasAdminAccess(user)) {
      return true;
    }
    return keys.some((key) => permissions.includes(key));
  };

  const hasAllPermissions = (...keys: string[]): boolean => {
    if (userHasAdminAccess(user)) {
      return true;
    }
    return keys.every((key) => permissions.includes(key));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    permissions,
    role,
    loading,
  };
};
