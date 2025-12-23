import { Router } from 'express';
import * as roleController from '../controllers/roleController.js';
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

// Todas as rotas requerem permissão de gerenciar perfis (ou ser admin)
router.use(requireRoleManagement);

// Rotas CRUD
router.get('/', roleController.getAllRoles);
router.get('/:id', roleController.getRoleById);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

export default router;

