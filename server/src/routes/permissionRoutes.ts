import { Router } from 'express';
import * as permissionController from '../controllers/permissionController.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Middleware híbrido: permite admin (via profile) OU usuário com permissão roles.manage
const requireRoleManagement = async (req: any, res: any, next: any) => {
  // Se for admin via profile antigo, permite
  if (req.user?.profile === 'admin') {
    return next();
  }
  
  // Caso contrário, verifica permissão
  return requirePermission('roles.manage')(req, res, next);
};

// Visualização de permissões requer permissão de gerenciar perfis (ou ser admin)
router.use(requireRoleManagement);

// Rotas de leitura (permissões são criadas apenas via seed)
router.get('/', permissionController.getAllPermissions);
router.get('/category/:category', permissionController.getPermissionsByCategory);
router.get('/:id', permissionController.getPermissionById);

export default router;

