import { Router } from 'express';
import { authenticate, isAdmin } from '../middleware/auth.js';
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
router.use(isAdmin);

router.get('/', getAllConfigs);
router.get('/:id', getConfigById);
router.post('/', createConfig);
router.put('/:id', updateConfig);
router.delete('/:id', deleteConfig);
router.post('/:id/execute', executeConfig);

export default router;

