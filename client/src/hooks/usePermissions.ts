import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';

export const usePermissions = () => {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isFullAdmin, setIsFullAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        setPermissions([]);
        setIsFullAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data } = await authAPI.getMyPermissions();
        if (cancelled) return;
        setPermissions(data.permissions || []);
        setIsFullAdmin(Boolean(data.isFullAdmin));
      } catch (err) {
        console.error('[usePermissions] Erro ao carregar permissões:', err);
        if (cancelled) return;
        // Fallback legado
        const legacyAdmin = user.profile === 'admin';
        setIsFullAdmin(legacyAdmin);
        setPermissions(legacyAdmin ? [] : ['allocations.view']);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasPermission = (permissionKey: string): boolean => {
    if (isFullAdmin) return true;
    return permissions.includes(permissionKey);
  };

  const hasAnyPermission = (...keys: string[]): boolean => {
    if (isFullAdmin) return true;
    return keys.some((key) => permissions.includes(key));
  };

  const hasAllPermissions = (...keys: string[]): boolean => {
    if (isFullAdmin) return true;
    return keys.every((key) => permissions.includes(key));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    permissions,
    isFullAdmin,
    loading,
  };
};
