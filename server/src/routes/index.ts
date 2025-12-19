import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import projectRoutes from './projectRoutes.js';
import allocationRoutes from './allocationRoutes.js';
import statusConfigRoutes from './statusConfigRoutes.js';
import functionConfigRoutes from './functionConfigRoutes.js';
import teamRoutes from './teamRoutes.js';
import externalDataRoutes from './externalDataRoutes.js';
import dataSyncRoutes from './dataSyncRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/allocations', allocationRoutes);
router.use('/status-config', statusConfigRoutes);
router.use('/function-config', functionConfigRoutes);
router.use('/teams', teamRoutes);
router.use('/external-data', externalDataRoutes);
router.use('/middleware', dataSyncRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
