import { Router } from 'express';
import * as allocationController from '../controllers/allocationController.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get allocations
router.get('/', allocationController.getAllocations);
router.get('/agenda', allocationController.getAgendaAllocations);
router.get('/:id', allocationController.getAllocationById);
router.get('/:id/history', allocationController.getAllocationHistory);

// CRUD operations - usar sistema de permissões com fallback para admin antigo
const requireAllocationPermission = (permissionKey: string) => {
  return async (req: any, res: any, next: any) => {
    // Fallback: se for admin antigo (sem role), permitir
    if (req.user?.profile === 'admin' && !req.user?.role) {
      return next();
    }
    // Usar sistema de permissões
    return requirePermission(permissionKey)(req, res, next);
  };
};

router.post('/', requireAllocationPermission('allocations.create'), allocationController.createAllocation);
router.post('/bulk', requireAllocationPermission('allocations.bulk'), allocationController.createBulkAllocations);
router.post('/copy', requireAllocationPermission('allocations.bulk'), allocationController.copyAllocations);
router.put('/:id', requireAllocationPermission('allocations.update'), allocationController.updateAllocation);
router.delete('/:id', requireAllocationPermission('allocations.delete'), allocationController.deleteAllocation);
router.delete('/bulk/delete', requireAllocationPermission('allocations.delete'), allocationController.deleteBulkAllocations);

// Attachments - usar permissões de update
router.post('/:id/attachments', requireAllocationPermission('allocations.update'), upload.single('file'), allocationController.addAttachment);
router.delete('/:id/attachments/:attachmentId', requireAllocationPermission('allocations.update'), allocationController.removeAttachment);

export default router;
