import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Permission, Role } from '../types';

export const usePermissions = () => {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setRole(null);
      setLoading(false);
      return;
    }

    // Se o usuário tem role populado, extrair permissões
    if (user.role) {
      const userRole = typeof user.role === 'object' ? user.role : null;
      
      if (userRole && Array.isArray(userRole.permissions)) {
        // Verificar se permissions são objetos ou strings
        const permissionKeys = userRole.permissions
          .map((perm: Permission | string) => {
            if (typeof perm === 'object' && perm.key) {
              return perm.active ? perm.key : null;
            }
            return perm; // Já é uma string (ID ou key)
          })
          .filter(Boolean) as string[];
        
        setPermissions(permissionKeys);
        setRole(userRole);
      } else {
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
      // Fallback para compatibilidade: admin tem todas as permissões
      setPermissions([]); // Será verificado no backend
    } else {
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

