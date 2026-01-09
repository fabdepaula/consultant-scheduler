import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getSessionLogs,
  getSessionStats,
} from '../controllers/sessionLogController.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar logs (apenas admin)
router.get('/', getSessionLogs);

// Estatísticas (opcional)
router.get('/stats', getSessionStats);

export default router;

