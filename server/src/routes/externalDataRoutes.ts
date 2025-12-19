import { Router } from 'express';
import {
  listViews,
  getViewData,
  executeQuery,
  getViewStructure,
} from '../controllers/externalDataController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { testMySQLConnection } from '../config/mysql.js';

const router = Router();

// Rota de teste (sem autenticação) - apenas para verificar conexão
router.get('/test-connection', async (req, res) => {
  try {
    const isConnected = await testMySQLConnection();
    if (isConnected) {
      res.json({
        success: true,
        message: 'Conexão MySQL estabelecida com sucesso!',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Falha na conexão MySQL',
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Erro ao testar conexão',
      error: error.message,
    });
  }
});

// Todas as outras rotas requerem autenticação primeiro, depois verificação de admin
router.use(authenticate);
router.use(isAdmin);

// Lista todas as views disponíveis
router.get('/views', listViews);

// Busca a estrutura (colunas) de uma view específica
router.get('/views/:viewName/structure', getViewStructure);

// Busca dados de uma view específica (com paginação)
router.get('/views/:viewName', getViewData);

// Executa uma query customizada (apenas SELECT)
router.post('/query', executeQuery);

export default router;

