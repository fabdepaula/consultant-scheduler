import { Router } from 'express';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import {
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfig,
  deleteConfig,
  executeConfig,
} from '../controllers/dataSyncController.js';

const router = Router();

router.use(authenticate);

// Middleware híbrido: permite admin (via profile) OU usuário com permissão específica
const requireMiddlewarePermission = (permissionKey: string) => {
  return async (req: any, res: any, next: any) => {
    // Fallback: se for admin (via profile), sempre permitir (mesmo que tenha role)
    if (req.user?.profile === 'admin') {
      return next();
    }
    // Usar sistema de permissões
    return requirePermission(permissionKey)(req, res, next);
  };
};

router.get('/', requireMiddlewarePermission('middleware.view'), getAllConfigs);
router.get('/:id', requireMiddlewarePermission('middleware.view'), getConfigById);
router.post('/', requireMiddlewarePermission('middleware.create'), createConfig);
router.put('/:id', requireMiddlewarePermission('middleware.update'), updateConfig);
router.delete('/:id', requireMiddlewarePermission('middleware.update'), deleteConfig);
router.post('/:id/execute', requireMiddlewarePermission('middleware.execute'), executeConfig);

export default router;

