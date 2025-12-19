import { Router } from 'express';
import * as functionConfigController from '../controllers/functionConfigController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

// Get all functions (authenticated users)
router.get('/', authenticate, functionConfigController.getAllFunctions);

// Admin only routes
router.post('/', authenticate, isAdmin, functionConfigController.createFunction);
router.put('/:id', authenticate, isAdmin, functionConfigController.updateFunction);
router.delete('/:id', authenticate, isAdmin, functionConfigController.deleteFunction);

export default router;

