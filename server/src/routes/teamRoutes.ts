import { Router } from 'express';
import { authenticate, isAdmin } from '../middleware/auth.js';
import {
  getAllTeams,
  getActiveTeams,
  createTeam,
  updateTeam,
  deleteTeam,
} from '../controllers/teamController.js';

const router = Router();

// Rotas protegidas por autenticação
router.use(authenticate);

// Get all teams (admin can see all, others see only active)
router.get('/', getAllTeams);

// Get active teams only (for dropdowns)
router.get('/active', getActiveTeams);

// Admin only routes
router.post('/', isAdmin, createTeam);
router.put('/:id', isAdmin, updateTeam);
router.delete('/:id', isAdmin, deleteTeam);

export default router;

