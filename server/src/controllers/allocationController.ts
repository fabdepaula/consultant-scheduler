import { Request, Response, NextFunction } from 'express';
import Allocation from '../models/Allocation.js';
import StatusConfig from '../models/StatusConfig.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { getAllowedTeamsForUser } from '../services/teamVisibilityService.js';

// Helper para criar Date a partir de string "yyyy-MM-dd" no timezone local
// Evita problemas de conversão UTC quando new Date() interpreta string como UTC
// PROBLEMA: Quando você faz new Date("2024-01-12"), JavaScript interpreta como UTC meia-noite
// e converte para o timezone local, podendo resultar no dia anterior
// SOLUÇÃO: Parse manual da string e criação de Date usando construtor local
const parseLocalDate = (dateString: string | Date): Date => {
  // Se já é um Date object, normalizar para meio-dia local
  if (dateString instanceof Date) {
    const d = dateString as Date;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  }
  
  // Parse da string "yyyy-MM-dd" e criar Date no timezone local
  // Formato esperado: "2024-01-12"
  const str = dateString as string;
  const parts = str.split('-');
  if (parts.length !== 3) {
    // Se não for formato esperado, tentar parse normal e normalizar
    const d = new Date(str);
    if (isNaN(d.getTime())) {
      throw new Error(`Formato de data inválido: ${str}`);
    }
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month é 0-indexed em JavaScript (0 = Janeiro)
  const day = parseInt(parts[2], 10);
  
  // Validar valores
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Data inválida: ${str}`);
  }
  
  // Criar Date no timezone LOCAL usando construtor local (não UTC)
  // O construtor new Date(year, month, day, hour, minute, second) sempre usa timezone local
  // Definir para meio-dia (12:00) para evitar problemas de timezone em queries
  const localDate = new Date(year, month, day, 12, 0, 0, 0);
  
  // Verificar se a data criada corresponde ao que foi parseado (evita datas inválidas como 31/02)
  if (localDate.getFullYear() !== year || localDate.getMonth() !== month || localDate.getDate() !== day) {
    throw new Error(`Data inválida: ${str} (ex: 31 de fevereiro)`);
  }
  
  return localDate;
};

// Helper para formatar data como "yyyy-MM-dd" no timezone local
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get allocations with filters
export const getAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consultantId, projectId, startDate, endDate, status, period } = req.query;
    
    const query: any = {};
    
    if (consultantId) {
      query.consultantId = consultantId;
    }
    
    if (projectId) {
      query.projectId = projectId;
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        // Usar parseLocalDate para evitar problemas de timezone
        const start = parseLocalDate(startDate as string);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        // Usar parseLocalDate para evitar problemas de timezone
        const end = parseLocalDate(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    
    if (status) {
      query.status = status;
    }
    
    if (period) {
      query.period = period;
    }

    const allocations = await Allocation.find(query)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .populate('history.changedBy', 'name')
      .populate('attachments.uploadedBy', 'name')
      .sort({ date: 1, timeSlot: 1 });

    res.json({ allocations });
  } catch (error) {
    next(error);
  }
};

// Get single allocation with full details
export const getAllocationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allocation = await Allocation.findById(req.params.id)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .populate('history.changedBy', 'name')
      .populate('attachments.uploadedBy', 'name');

    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    res.json({ allocation });
  } catch (error) {
    next(error);
  }
};

// Get allocations for agenda view (optimized for grid)
export const getAgendaAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate e endDate são obrigatórios' });
    }

    // Obter equipes permitidas para o usuário atual
    const userId = req.user?._id?.toString();
    let allowedTeamIds: string[] | null = null;
    
    if (userId) {
      allowedTeamIds = await getAllowedTeamsForUser(userId);
    }

    console.log('[getAgendaAllocations] Allowed teams:', {
      userId,
      allowedTeamIds,
      isNull: allowedTeamIds === null,
      length: allowedTeamIds?.length
    });

    // Se o usuário tem restrição de equipes, filtrar consultores
    let consultantFilter: any = { active: true, hasAgenda: true };
    if (allowedTeamIds !== null) {
      // Se é array vazio, não pode ver nenhuma equipe
      if (allowedTeamIds.length === 0) {
        console.log('[getAgendaAllocations] No allowed teams - returning empty');
        return res.json({ allocations: [], grouped: {} });
      }
      // Converter IDs de string para ObjectId para comparação correta
      const teamObjectIds = allowedTeamIds.map(id => new mongoose.Types.ObjectId(id));
      console.log('[getAgendaAllocations] Filtering consultants by teams:', teamObjectIds);
      // Filtrar consultores que pertencem às equipes permitidas
      consultantFilter.teams = { $in: teamObjectIds };
    } else {
      console.log('[getAgendaAllocations] No team restrictions (null) - showing all consultants');
    }

    // Parse das datas no timezone local para evitar problemas de conversão UTC
    const start = parseLocalDate(startDate as string);
    start.setHours(0, 0, 0, 0);
    const end = parseLocalDate(endDate as string);
    end.setHours(23, 59, 59, 999);
    
    const query: any = {
      date: {
        $gte: start,
        $lte: end,
      },
    };

    // Buscar consultores visíveis primeiro
    const visibleConsultants = await User.find(consultantFilter)
      .select('_id name email teams')
      .populate('teams', '_id name');
    
    console.log('[getAgendaAllocations] Visible consultants found:', {
      count: visibleConsultants.length,
      consultants: visibleConsultants.map(c => ({
        id: c._id,
        name: c.name,
        teams: c.teams
      }))
    });
    
    const consultantIds = visibleConsultants.map(c => c._id);

    // Se não há consultores visíveis, retornar vazio
    if (consultantIds.length === 0) {
      console.log('[getAgendaAllocations] No visible consultants - returning empty');
      return res.json({ allocations: [], grouped: {} });
    }

    // Filtrar alocações apenas dos consultores visíveis
    query.consultantId = { $in: consultantIds };

    const allocations = await Allocation.find(query)
      .populate('consultantId', 'name email profile functions teams')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .sort({ consultantId: 1, date: 1, timeSlot: 1 });

    // Group allocations by consultant and date
    const grouped: Record<string, Record<string, any[]>> = {};
    
    allocations.forEach((allocation) => {
      const consultantId = allocation.consultantId._id.toString();
      // Usar formatação local em vez de toISOString para evitar problemas de timezone
      const dateKey = formatDateLocal(allocation.date);
      
      if (!grouped[consultantId]) {
        grouped[consultantId] = {};
      }
      if (!grouped[consultantId][dateKey]) {
        grouped[consultantId][dateKey] = [];
      }
      
      grouped[consultantId][dateKey].push(allocation);
    });

    res.json({ 
      allocations,
      grouped,
    });
  } catch (error) {
    next(error);
  }
};

// Create allocation (admin only)

export const createAllocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consultantId, projectId, date, period, timeSlot, status, artiaActivity, notes } = req.body;
    
    // VALIDAÇÃO: Verificar se o status requer projeto
    if (status && status !== 'conflito') {
      const statusConfig = await StatusConfig.findOne({ key: status, active: true });
      if (statusConfig && statusConfig.requiresProject !== false && !projectId) {
        return res.status(400).json({ 
          message: `O status "${statusConfig.label}" requer que um projeto seja selecionado.` 
        });
      }
    }
    
    // Parse da data no timezone local (evita conversão UTC)
    // IMPORTANTE: date deve vir como string "yyyy-MM-dd" do frontend
    const allocationDate = parseLocalDate(date);
    
    // Criar datas separadas para query (início e fim do dia no timezone local)
    const startOfDay = new Date(allocationDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(allocationDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Verificar se já existem alocações no mesmo slot ANTES de criar
    const existingAllocations = await Allocation.find({
      consultantId,
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      timeSlot
    });

    // Se já existem alocações, a nova deve ser criada como conflito
    const finalStatus = existingAllocations.length > 0 ? 'conflito' : status;

    const allocation = await Allocation.create({
      consultantId,
      projectId: projectId || null,
      date: allocationDate, // Usar a data parseada no timezone local
      period,
      timeSlot,
      status: finalStatus,
      artiaActivity,
      notes,
      createdBy: req.user!._id,
      history: [{
        action: 'created',
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: existingAllocations.length > 0 
          ? 'Alocação criada com status CONFLITO (slot já ocupado)' 
          : 'Alocação criada',
      }],
    });

    // Se havia alocações existentes, atualizar TODAS para conflito
    if (existingAllocations.length > 0) {
      for (const existing of existingAllocations) {
        if (existing.status !== 'conflito') {
          existing.status = 'conflito';
          existing.history = existing.history || [];
          existing.history.push({
            action: 'status_changed',
            field: 'status',
            oldValue: existing.status,
            newValue: 'conflito',
            changedBy: req.user!._id,
            changedAt: new Date(),
            description: 'Status alterado para CONFLITO automaticamente (nova alocação no mesmo slot)',
          });
          await existing.save();
        }
      }
    }

    const populatedAllocation = await Allocation.findById(allocation._id)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name');

    res.status(201).json({
      message: existingAllocations.length > 0 
        ? 'Alocação criada com CONFLITO (já existiam alocações neste slot)'
        : 'Alocação criada com sucesso',
      allocation: populatedAllocation,
      hasConflict: existingAllocations.length > 0,
    });
  } catch (error) {
    next(error);
  }
};

// Create multiple allocations at once (admin only)
export const createBulkAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { allocations } = req.body;
    
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ message: 'Array de alocações é obrigatório' });
    }

    const results = {
      created: [] as any[],
      errors: [] as any[],
    };

    for (const alloc of allocations) {
      try {
        // Parse da data no timezone local para evitar problemas de conversão UTC
        const allocationDate = parseLocalDate(alloc.date);
        
        const allocation = await Allocation.create({
          ...alloc,
          date: allocationDate, // Usar data parseada no timezone local
          createdBy: req.user!._id,
          history: [{
            action: 'created',
            changedBy: req.user!._id,
            changedAt: new Date(),
            description: 'Alocação criada em massa',
          }],
        });

        results.created.push(allocation);
      } catch (err: any) {
        results.errors.push({
          ...alloc,
          error: err.message,
        });
      }
    }

    res.status(201).json({
      message: `Criadas ${results.created.length} alocações`,
      ...results,
    });
  } catch (error) {
    next(error);
  }
};

// Update allocation (admin only)
export const updateAllocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, period, timeSlot, status, artiaActivity, notes, date } = req.body;
    const id = req.params.id;

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    // VALIDAÇÃO: Se está alterando o status, verificar se o novo status requer projeto
    if (status && allocation.status !== status) {
      const newStatusConfig = await StatusConfig.findOne({ key: status, active: true });
      if (newStatusConfig && newStatusConfig.requiresProject !== false) {
        // Verificar se a alocação terá projeto após a atualização
        // Se projectId foi fornecido no body, usar ele; senão, usar o atual da alocação
        const finalProjectId = projectId !== undefined ? (projectId || null) : allocation.projectId;
        
        if (!finalProjectId) {
          return res.status(400).json({ 
            message: `O status "${newStatusConfig.label}" requer que um projeto seja selecionado.` 
          });
        }
      }
    }

    // Registrar alterações no histórico
    const changes: any[] = [];

    if (projectId !== undefined && allocation.projectId?.toString() !== projectId) {
      changes.push({
        action: 'updated',
        field: 'projectId',
        oldValue: allocation.projectId,
        newValue: projectId || null,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Projeto alterado',
      });
      allocation.projectId = projectId || undefined;
    }

    if (period && allocation.period !== period) {
      changes.push({
        action: 'updated',
        field: 'period',
        oldValue: allocation.period,
        newValue: period,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Período alterado',
      });
      allocation.period = period;
    }

    if (timeSlot && allocation.timeSlot !== timeSlot) {
      changes.push({
        action: 'updated',
        field: 'timeSlot',
        oldValue: allocation.timeSlot,
        newValue: timeSlot,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Horário alterado',
      });
      allocation.timeSlot = timeSlot;
    }

    if (status && allocation.status !== status) {
      changes.push({
        action: 'status_changed',
        field: 'status',
        oldValue: allocation.status,
        newValue: status,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: `Status alterado de "${allocation.status}" para "${status}"`,
      });
      allocation.status = status;

      // Verifica se o novo status requer projeto
      const statusConfig = await StatusConfig.findOne({ key: status, active: true });
      if (statusConfig && statusConfig.requiresProject === false) {
        // Se o status não requer projeto, limpa o projeto
        if (allocation.projectId) {
          changes.push({
            action: 'updated',
            field: 'projectId',
            oldValue: allocation.projectId,
            newValue: null,
            changedBy: req.user!._id,
            changedAt: new Date(),
            description: 'Projeto removido automaticamente (status não requer projeto)',
          });
          allocation.projectId = undefined;
        }
      }
    }

    if (artiaActivity !== undefined && allocation.artiaActivity !== artiaActivity) {
      changes.push({
        action: 'updated',
        field: 'artiaActivity',
        oldValue: allocation.artiaActivity,
        newValue: artiaActivity,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Atividade Artia alterada',
      });
      allocation.artiaActivity = artiaActivity;
    }

    if (notes !== undefined && allocation.notes !== notes) {
      changes.push({
        action: 'updated',
        field: 'notes',
        oldValue: allocation.notes,
        newValue: notes,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Observações alteradas',
      });
      allocation.notes = notes;
    }

    // Se a data foi fornecida, atualizar (parse no timezone local)
    if (date !== undefined) {
      const newDate = parseLocalDate(date);
      // Comparar apenas ano, mês e dia (ignorar hora)
      const oldDateStr = formatDateLocal(allocation.date);
      const newDateStr = formatDateLocal(newDate);
      
      if (oldDateStr !== newDateStr) {
        changes.push({
          action: 'updated',
          field: 'date',
          oldValue: oldDateStr,
          newValue: newDateStr,
          changedBy: req.user?._id,
          changedAt: new Date(),
          description: `Data alterada de ${oldDateStr} para ${newDateStr}`,
        });
        allocation.date = newDate;
      }
    }

    // Adicionar alterações ao histórico
    if (changes.length > 0) {
      allocation.history = [...(allocation.history || []), ...changes];
    }

    await allocation.save();

    const populatedAllocation = await Allocation.findById(allocation._id)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .populate('history.changedBy', 'name');

    res.json({
      message: 'Alocação atualizada com sucesso',
      allocation: populatedAllocation,
    });
  } catch (error) {
    next(error);
  }
};

// Add attachment to allocation
export const addAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Arquivo é obrigatório' });
    }

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      // Remove arquivo se alocação não existir
      if (file.path) fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    const attachment = {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedBy: req.user!._id,
      uploadedAt: new Date(),
    };

    allocation.attachments = [...(allocation.attachments || []), attachment];
    
    // Registrar no histórico
    allocation.history = [...(allocation.history || []), {
      action: 'attachment_added',
      field: 'attachments',
      newValue: file.originalname,
      changedBy: req.user!._id,
      changedAt: new Date(),
      description: `Arquivo "${file.originalname}" anexado`,
    }];

    await allocation.save();

    const populatedAllocation = await Allocation.findById(allocation._id)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .populate('attachments.uploadedBy', 'name');

    res.json({
      message: 'Arquivo anexado com sucesso',
      allocation: populatedAllocation,
    });
  } catch (error) {
    next(error);
  }
};

// Remove attachment from allocation
export const removeAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, attachmentId } = req.params;

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    const attachment = allocation.attachments?.find(
      (a: any) => a._id.toString() === attachmentId
    );

    if (!attachment) {
      return res.status(404).json({ message: 'Anexo não encontrado' });
    }

    // Remove arquivo do disco
    if (attachment.path && fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }

    // Remove do array
    allocation.attachments = allocation.attachments?.filter(
      (a: any) => a._id.toString() !== attachmentId
    );

    // Registrar no histórico
    allocation.history = [...(allocation.history || []), {
      action: 'attachment_removed',
      field: 'attachments',
      oldValue: attachment.originalName,
      changedBy: req.user!._id,
      changedAt: new Date(),
      description: `Arquivo "${attachment.originalName}" removido`,
    }];

    await allocation.save();

    res.json({ message: 'Anexo removido com sucesso' });
  } catch (error) {
    next(error);
  }
};

// Get allocation history
export const getAllocationHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allocation = await Allocation.findById(req.params.id)
      .select('history')
      .populate('history.changedBy', 'name email');

    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    res.json({ history: allocation.history || [] });
  } catch (error) {
    next(error);
  }
};

// Delete allocation (admin only)
export const deleteAllocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    // Guardar dados do slot antes de excluir para verificar conflitos depois
    const { consultantId, date, timeSlot } = allocation;
    const allocationDate = new Date(date);

    // Remove arquivos anexados
    if (allocation.attachments && allocation.attachments.length > 0) {
      for (const attachment of allocation.attachments) {
        if (attachment.path && fs.existsSync(attachment.path)) {
          fs.unlinkSync(attachment.path);
        }
      }
    }

    await Allocation.findByIdAndDelete(id);

    // Verificar se restam alocações no mesmo slot
    const remainingAllocations = await Allocation.find({
      consultantId,
      date: {
        $gte: new Date(new Date(allocationDate).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(allocationDate).setHours(23, 59, 59, 999))
      },
      timeSlot
    });

    // Se restar apenas 1 alocação e ela estiver com status conflito, mudar para a_confirmar
    if (remainingAllocations.length === 1) {
      const remaining = remainingAllocations[0];
      if (remaining.status === 'conflito') {
        remaining.status = 'a_confirmar';
        remaining.history = remaining.history || [];
        remaining.history.push({
          action: 'status_changed',
          field: 'status',
          oldValue: 'conflito',
          newValue: 'a_confirmar',
          changedBy: req.user!._id,
          changedAt: new Date(),
          description: 'Status alterado para À CONFIRMAR automaticamente (conflito resolvido)',
        });
        await remaining.save();
      }
    }

    res.json({ 
      message: 'Alocação removida com sucesso',
      conflictResolved: remainingAllocations.length === 1
    });
  } catch (error) {
    next(error);
  }
};

// Delete multiple allocations (admin only)
export const deleteBulkAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Array de IDs é obrigatório' });
    }

    // Remove arquivos anexados de todas as alocações
    const allocations = await Allocation.find({
      _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
    });

    for (const allocation of allocations) {
      if (allocation.attachments && allocation.attachments.length > 0) {
        for (const attachment of allocation.attachments) {
          if (attachment.path && fs.existsSync(attachment.path)) {
            fs.unlinkSync(attachment.path);
          }
        }
      }
    }

    const result = await Allocation.deleteMany({
      _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
    });

    res.json({ 
      message: `${result.deletedCount} alocações removidas`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

// Copy allocations from one period to another (admin only)
export const copyAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceStartDate, sourceEndDate, targetStartDate, consultantIds } = req.body;

    const sourceStart = new Date(sourceStartDate);
    const sourceEnd = new Date(sourceEndDate);
    const targetStart = new Date(targetStartDate);

    const daysDiff = Math.floor((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));

    const query: any = {
      date: {
        $gte: sourceStart,
        $lte: sourceEnd,
      },
    };

    if (consultantIds && consultantIds.length > 0) {
      query.consultantId = { $in: consultantIds };
    }

    const sourceAllocations = await Allocation.find(query);

    let created = 0;

    for (const alloc of sourceAllocations) {
      const newDate = new Date(alloc.date);
      newDate.setDate(newDate.getDate() + daysDiff);

      await Allocation.create({
        consultantId: alloc.consultantId,
        projectId: alloc.projectId,
        date: newDate,
        period: alloc.period,
        timeSlot: alloc.timeSlot,
        status: alloc.status,
        artiaActivity: alloc.artiaActivity,
        notes: alloc.notes,
        createdBy: req.user!._id,
        history: [{
          action: 'created',
          changedBy: req.user?._id,
          changedAt: new Date(),
          description: 'Alocação copiada',
        }],
      });

      created++;
    }

    res.json({
      message: `Copiadas ${created} alocações`,
      created,
    });
  } catch (error) {
    next(error);
  }
};
