import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, isGerente } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all consultants (both roles can view)
router.get('/', userController.getAllConsultants);
router.get('/:id', userController.getConsultantById);

// CRUD operations (gerente only)
router.post('/', isGerente, userController.createConsultant);
router.put('/:id', isGerente, userController.updateConsultant);
router.delete('/:id', isGerente, userController.deleteConsultant);
router.delete('/:id/permanent', isGerente, userController.hardDeleteConsultant);

export default router;


