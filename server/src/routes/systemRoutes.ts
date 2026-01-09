import { Router } from 'express';
import { getSystemConfig } from '../controllers/systemController.js';

const router = Router();

// Rota pública para obter configurações do sistema
router.get('/config', getSystemConfig);

export default router;

