import { Router } from 'express';
import * as allocationController from '../controllers/allocationController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get allocations
router.get('/', allocationController.getAllocations);
router.get('/agenda', allocationController.getAgendaAllocations);
router.get('/:id', allocationController.getAllocationById);
router.get('/:id/history', allocationController.getAllocationHistory);

// CRUD operations (admin only)
router.post('/', isAdmin, allocationController.createAllocation);
router.post('/bulk', isAdmin, allocationController.createBulkAllocations);
router.post('/copy', isAdmin, allocationController.copyAllocations);
router.put('/:id', isAdmin, allocationController.updateAllocation);
router.delete('/:id', isAdmin, allocationController.deleteAllocation);
router.delete('/bulk/delete', isAdmin, allocationController.deleteBulkAllocations);

// Attachments (admin only)
router.post('/:id/attachments', isAdmin, upload.single('file'), allocationController.addAttachment);
router.delete('/:id/attachments/:attachmentId', isAdmin, allocationController.removeAttachment);

export default router;
