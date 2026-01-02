import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Permission, Role } from '../types';

export const usePermissions = () => {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[usePermissions] User changed:', user);
    if (!user) {
      setPermissions([]);
      setRole(null);
      setLoading(false);
      return;
    }

    // Se o usuário tem role populado, extrair permissões
    if (user.role) {
      const userRole = typeof user.role === 'object' ? user.role : null;
      console.log('[usePermissions] User role:', userRole);
      
      if (userRole && Array.isArray(userRole.permissions)) {
        console.log('[usePermissions] Role permissions array:', userRole.permissions);
        // Verificar se permissions são objetos ou strings
        const permissionKeys = userRole.permissions
          .map((perm: Permission | string) => {
            if (typeof perm === 'object' && perm.key) {
              console.log('[usePermissions] Permission object:', perm);
              return perm.active ? perm.key : null;
            }
            console.log('[usePermissions] Permission string:', perm);
            return perm; // Já é uma string (ID ou key)
          })
          .filter(Boolean) as string[];
        
        console.log('[usePermissions] Extracted permission keys:', permissionKeys);
        setPermissions(permissionKeys);
        setRole(userRole);
      } else {
        console.log('[usePermissions] Role permissions not array or role not object');
        // Se role é apenas um ID, precisaríamos buscar do backend
        // Por enquanto, usar profile como fallback
        if (user.profile === 'admin') {
          // Admin tem todas as permissões (será carregado do backend quando necessário)
          setPermissions([]); // Será populado quando necessário
        } else {
          setPermissions(['allocations.view']); // Usuário padrão
        }
      }
    } else if (user.profile === 'admin') {
      console.log('[usePermissions] User is admin (old system)');
      // Fallback para compatibilidade: admin tem todas as permissões
      setPermissions([]); // Será verificado no backend
    } else {
      console.log('[usePermissions] User has no role, using default permissions');
      setPermissions(['allocations.view']); // Usuário padrão
    }
    
    setLoading(false);
  }, [user]);

  const hasPermission = (permissionKey: string): boolean => {
    // Se for admin via profile antigo, sempre retorna true (compatibilidade)
    if (user?.profile === 'admin') {
      return true;
    }
    
    return permissions.includes(permissionKey);
  };

  const hasAnyPermission = (...keys: string[]): boolean => {
    // Se for admin via profile antigo, sempre retorna true
    if (user?.profile === 'admin') {
      return true;
    }
    
    return keys.some(key => permissions.includes(key));
  };

  const hasAllPermissions = (...keys: string[]): boolean => {
    // Se for admin via profile antigo, sempre retorna true
    if (user?.profile === 'admin') {
      return true;
    }
    
    return keys.every(key => permissions.includes(key));
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

