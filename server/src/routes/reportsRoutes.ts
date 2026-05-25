import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getConferenciaApontamentoEmbed } from '../controllers/reportsController.js';

const router = Router();

router.use(authenticate);

router.get(
  '/conferencia-apontamento/embed',
  requirePermission('reports.conferencia-apontamento.view'),
  getConferenciaApontamentoEmbed
);

export default router;
