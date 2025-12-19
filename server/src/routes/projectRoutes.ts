import { Router } from 'express';
import * as projectController from '../controllers/projectController.js';
import { authenticate, isGerente } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get projects (both roles can view)
router.get('/', projectController.getAllProjects);
router.get('/clients', projectController.getClients);
router.get('/types', projectController.getProjectTypes);
router.get('/:id', projectController.getProjectById);

// CRUD operations (gerente only)
router.post('/', isGerente, projectController.createProject);
router.put('/:id', isGerente, projectController.updateProject);
router.delete('/:id', isGerente, projectController.deleteProject);

export default router;


