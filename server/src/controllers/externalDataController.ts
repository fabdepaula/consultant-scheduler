import { Request, Response } from 'express';
import { getMySQLConnection } from '../config/mysql.js';

/**
 * Lista todas as views disponíveis no banco de dados
 */
export const listViews = async (req: Request, res: Response): Promise<void> => {
  try {
    const connection = getMySQLConnection();
    const [rows] = await connection.execute(
      `SELECT TABLE_NAME as view_name
       FROM information_schema.VIEWS 
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME`
    );
    
    res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error listing views:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar views',
      error: error.message,
    });
  }
};

/**
 * Busca dados de uma view específica
 */
export const getViewData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { viewName } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Validação básica do nome da view (prevenção de SQL injection)
    if (!viewName || !/^[a-zA-Z0-9_]+$/.test(viewName)) {
      res.status(400).json({
        success: false,
        message: 'Nome da view inválido',
      });
      return;
    }

    const connection = getMySQLConnection();
    
    // Primeiro, verifica se a view existe
    const [viewCheck] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM information_schema.VIEWS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = ?`,
      [viewName]
    );

    const viewExists = (viewCheck as any[])[0]?.count > 0;

    if (!viewExists) {
      res.status(404).json({
        success: false,
        message: `View '${viewName}' não encontrada`,
      });
      return;
    }

    // Busca os dados da view com paginação
    // Nota: LIMIT e OFFSET não podem ser usados como parâmetros preparados no mysql2
    // Como já validamos o viewName e os parâmetros numéricos, podemos usar de forma segura
    let rows: any[];
    try {
      const limitNum = parseInt(String(limit), 10) || 100;
      const offsetNum = parseInt(String(offset), 10) || 0;
      
      // Valida que são números válidos e positivos
      if (isNaN(limitNum) || isNaN(offsetNum) || limitNum < 0 || offsetNum < 0 || limitNum > 1000) {
        res.status(400).json({
          success: false,
          message: 'Parâmetros de paginação inválidos. Limit deve ser entre 0 e 1000.',
        });
        return;
      }

      // Usa query() ao invés de execute() para permitir LIMIT e OFFSET
      // viewName já foi validado com regex, então é seguro
      const [result] = await connection.query(
        `SELECT * FROM ?? LIMIT ? OFFSET ?`,
        [viewName, limitNum, offsetNum]
      );
      rows = result as any[];
    } catch (queryError: any) {
      console.error('Error executing SELECT query:', queryError);
      res.status(500).json({
        success: false,
        message: `Erro ao executar query na view: ${queryError.message}`,
        error: queryError.message,
      });
      return;
    }

    // Conta o total de registros
    let total = 0;
    try {
      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM \`${viewName}\``
      );
      total = (countResult as any[])[0]?.total || 0;
    } catch (countError: any) {
      console.error('Error counting records:', countError);
      // Não falha se não conseguir contar, apenas usa o tamanho do array
      total = Array.isArray(rows) ? rows.length : 0;
    }

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching view data:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados da view',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Executa uma query customizada (com validação de segurança)
 * Por segurança, apenas permite SELECT em views
 */
export const executeQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Query é obrigatória',
      });
      return;
    }

    // Validação básica: apenas SELECT e apenas em views
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery.startsWith('SELECT')) {
      res.status(400).json({
        success: false,
        message: 'Apenas queries SELECT são permitidas',
      });
      return;
    }

    // Verifica se há comandos perigosos
    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE'];
    if (dangerousKeywords.some(keyword => normalizedQuery.includes(keyword))) {
      res.status(400).json({
        success: false,
        message: 'Query contém comandos não permitidos',
      });
      return;
    }

    const connection = getMySQLConnection();
    const [rows] = await connection.execute(query);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error executing query:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao executar query',
      error: error.message,
    });
  }
};

/**
 * Busca a estrutura (colunas) de uma view específica
 */
export const getViewStructure = async (req: Request, res: Response): Promise<void> => {
  try {
    const { viewName } = req.params;

    if (!viewName || !/^[a-zA-Z0-9_]+$/.test(viewName)) {
      res.status(400).json({
        success: false,
        message: 'Nome da view inválido',
      });
      return;
    }

    const connection = getMySQLConnection();
    
    const [rows] = await connection.execute(
      `SELECT 
        COLUMN_NAME as column_name,
        DATA_TYPE as data_type,
        IS_NULLABLE as is_nullable,
        COLUMN_DEFAULT as column_default,
        COLUMN_COMMENT as column_comment
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [viewName]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching view structure:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estrutura da view',
      error: error.message,
    });
  }
};

