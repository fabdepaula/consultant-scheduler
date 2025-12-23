import { Router } from 'express';
import { authenticate, isAdmin } from '../middleware/auth.js';
import {
  getAllTeams,
  getActiveTeams,
  getVisibleTeams,
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

// Get visible teams for current user (based on role permissions)
router.get('/visible', getVisibleTeams);

// Admin only routes
router.post('/', isAdmin, createTeam);
router.put('/:id', isAdmin, updateTeam);
router.delete('/:id', isAdmin, deleteTeam);

export default router;

