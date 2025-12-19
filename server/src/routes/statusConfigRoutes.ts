import { Router } from 'express';
import * as statusConfigController from '../controllers/statusConfigController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

// Get all status (authenticated users)
router.get('/', authenticate, statusConfigController.getAllStatuses);

// Admin only routes
router.post('/', authenticate, isAdmin, statusConfigController.createStatus);
router.put('/:id', authenticate, isAdmin, statusConfigController.updateStatus);
router.delete('/:id', authenticate, isAdmin, statusConfigController.deleteStatus);

export default router;

