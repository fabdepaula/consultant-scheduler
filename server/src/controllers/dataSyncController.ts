import { Request, Response } from 'express';
import { DataSyncConfig } from '../models/index.js';
import { executeDataSync } from '../services/dataSyncService.js';
import { rescheduleAllConfigs } from '../jobs/syncScheduler.js';

export const getAllConfigs = async (req: Request, res: Response) => {
  const configs = await DataSyncConfig.find().sort({ createdAt: -1 });
  console.log('[DataSync] getAllConfigs - retornando', configs.length, 'configurações');
  configs.forEach((config, index) => {
    console.log(`[DataSync] Config ${index + 1} (${config.name}):`, config.mappings?.length, 'mappings');
  });
  res.json({ success: true, data: configs });
};

export const getConfigById = async (req: Request, res: Response) => {
  const config = await DataSyncConfig.findById(req.params.id);
  if (!config) {
    return res.status(404).json({ success: false, message: 'Configuração não encontrada' });
  }
  res.json({ success: true, data: config });
};

export const createConfig = async (req: Request, res: Response) => {
  try {
    console.log('[DataSync] Creating config with payload:', JSON.stringify(req.body, null, 2));
    
    // Validações básicas antes de criar
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Erro ao criar configuração', 
        error: 'Nome é obrigatório',
      });
    }
    
    if (!req.body.sourceView || !req.body.sourceView.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Erro ao criar configuração', 
        error: 'View de origem é obrigatória',
      });
    }
    
    if (!req.body.targetCollection || !['projects', 'users', 'teams'].includes(req.body.targetCollection)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Erro ao criar configuração', 
        error: 'Tabela de destino inválida',
      });
    }
    
    if (!req.body.sourceKeyField || !req.body.targetKeyField) {
      return res.status(400).json({ 
        success: false, 
        message: 'Erro ao criar configuração', 
        error: 'Campos chave (origem e destino) são obrigatórios',
      });
    }
    
    // Garantir que schedule tem estrutura correta
    const body = {
      ...req.body,
      schedule: req.body.schedule || { mode: 'none' },
      history: req.body.history || [],
      active: req.body.active !== undefined ? req.body.active : true,
      mappings: req.body.mappings || [],
    };
    
    const config = new DataSyncConfig(body);
    await config.save();
    await rescheduleAllConfigs();
    res.status(201).json({ success: true, data: config });
  } catch (error: any) {
    console.error('[DataSync] Error creating config:', error);
    console.error('[DataSync] Error details:', JSON.stringify(error, null, 2));
    
    let errorMessage = error.message || 'Erro desconhecido';
    let validationErrors = '';
    
    // Extrair erros de validação do Mongoose
    if (error.errors) {
      validationErrors = Object.keys(error.errors)
        .map(key => {
          const err = error.errors[key];
          return `${key}: ${err.message || err}`;
        })
        .join('\n');
      errorMessage = validationErrors || errorMessage;
    }
    
    // Se for erro de validação do schema
    if (error.name === 'ValidationError') {
      errorMessage = `Erro de validação: ${errorMessage}`;
    }
    
    res.status(400).json({ 
      success: false, 
      message: 'Erro ao criar configuração', 
      error: errorMessage,
      validationErrors: validationErrors || undefined,
      fieldErrors: error.errors ? Object.keys(error.errors).reduce((acc: any, key) => {
        acc[key] = error.errors[key].message;
        return acc;
      }, {}) : undefined,
    });
  }
};

export const updateConfig = async (req: Request, res: Response) => {
  try {
    console.log('[DataSync] Updating config:', req.params.id);
    console.log('[DataSync] Update payload:', JSON.stringify(req.body, null, 2));
    console.log('[DataSync] Mappings recebidos:', JSON.stringify(req.body.mappings, null, 2));
    console.log('[DataSync] Número de mappings:', req.body.mappings?.length);
    
    // Não sobrescrever history se não foi fornecido
    const updateData: any = { ...req.body };
    if (!updateData.history) {
      // Se history não foi fornecido, não incluir no update para preservar o existente
      delete updateData.history;
    }
    
    // Tratar campos opcionais vazios - usar $unset para remover campos quando estão vazios
    const $set: any = { ...updateData };
    const $unset: any = {};
    
    // Se description foi enviado como string vazia, remover o campo
    if ('description' in req.body && req.body.description === '') {
      delete $set.description;
      $unset.description = '';
    } else if ('description' in req.body && req.body.description) {
      $set.description = req.body.description.trim();
    }
    
    // Se filterClause foi enviado como string vazia, remover o campo
    if ('filterClause' in req.body && req.body.filterClause === '') {
      delete $set.filterClause;
      $unset.filterClause = '';
    } else if ('filterClause' in req.body && req.body.filterClause) {
      $set.filterClause = req.body.filterClause.trim();
    }
    
    // Tratar cronExpression
    if (req.body.schedule && 'cronExpression' in req.body.schedule) {
      if (req.body.schedule.cronExpression === '') {
        // Se está vazio, remover do schedule
        if ($set.schedule) {
          delete $set.schedule.cronExpression;
        }
        $unset['schedule.cronExpression'] = '';
      } else if (req.body.schedule.cronExpression) {
        if (!$set.schedule) $set.schedule = {};
        $set.schedule.cronExpression = req.body.schedule.cronExpression.trim();
      }
    }
    
    // Garantir que mappings está presente e é um array
    if (!Array.isArray($set.mappings)) {
      return res.status(400).json({
        success: false,
        message: 'Erro ao atualizar configuração',
        error: 'Mapeamentos devem ser um array'
      });
    }
    
    // Montar query de update
    const updateQuery: any = {};
    if (Object.keys($set).length > 0) {
      updateQuery.$set = $set;
    }
    if (Object.keys($unset).length > 0) {
      updateQuery.$unset = $unset;
    }
    
    console.log('[DataSync] Update query:', JSON.stringify(updateQuery, null, 2));
    console.log('[DataSync] Mappings no $set:', JSON.stringify(updateQuery.$set?.mappings, null, 2));
    
    // Usar $set e $unset para garantir que campos vazios sejam removidos
    const config = await DataSyncConfig.findByIdAndUpdate(
      req.params.id,
      updateQuery,
      {
        new: true,
        runValidators: true,
      }
    );
    
    if (!config) {
      return res.status(404).json({ success: false, message: 'Configuração não encontrada' });
    }
    
    console.log('[DataSync] Config atualizada com sucesso');
    console.log('[DataSync] Mappings salvos:', JSON.stringify(config.mappings, null, 2));
    console.log('[DataSync] Número de mappings salvos:', config.mappings?.length);
    await rescheduleAllConfigs();
    res.json({ success: true, data: config });
  } catch (error: any) {
    console.error('[DataSync] Error updating config:', error);
    let errorMessage = error.message || 'Erro desconhecido';
    if (error.errors) {
      errorMessage = Object.keys(error.errors)
        .map(key => `${key}: ${error.errors[key].message || error.errors[key]}`)
        .join('\n');
    }
    res.status(400).json({ success: false, message: 'Erro ao atualizar configuração', error: errorMessage });
  }
};

export const deleteConfig = async (req: Request, res: Response) => {
  const config = await DataSyncConfig.findByIdAndDelete(req.params.id);
  if (!config) {
    return res.status(404).json({ success: false, message: 'Configuração não encontrada' });
  }
  await rescheduleAllConfigs();
  res.json({ success: true });
};

export const executeConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const result = await executeDataSync(req.params.id, userId);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

